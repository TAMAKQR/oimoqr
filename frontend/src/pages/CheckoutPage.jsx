import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useCustomerAuthStore } from '../store/customerAuthStore';
import { useCartStore } from '../store/cartStore';
import { useTheme } from '../theme/ThemeProvider';
import CustomerLoginModal from '../components/CustomerLoginModal';
import AddressAutocomplete from '../components/AddressAutocomplete';
import api from '../services/api';
import customerService from '../services/customerService';
import { restaurantService } from '../services/restaurantService';

const GUEST_DELIVERY_LOCATION_KEY = 'guest-delivery-location';
const GUEST_CHECKOUT_CONTACT_KEY = 'guest-checkout-contact';
const GUEST_CHECKOUT_ADDRESS_DETAILS_KEY = 'guest-checkout-address-details';

/* ---- palette builder (same as MenuPage) ---- */
const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
const hexToHsl = (hex) => {
    let r = 0, g = 0, b = 0;
    if (hex.length === 4) { r = parseInt(hex[1] + hex[1], 16); g = parseInt(hex[2] + hex[2], 16); b = parseInt(hex[3] + hex[3], 16); }
    else { r = parseInt(hex.slice(1, 3), 16); g = parseInt(hex.slice(3, 5), 16); b = parseInt(hex.slice(5, 7), 16); }
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
    let h = 0, s = 0, l = (max + min) / 2;
    if (d) { s = l > 0.5 ? d / (2 - max - min) : d / (max + min); switch (max) { case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break; case g: h = ((b - r) / d + 2) / 6; break; default: h = ((r - g) / d + 4) / 6; } }
    return { h, s, l };
};
const hslToHex = ({ h, s, l }) => {
    const hue2rgb = (p, q, t) => { if (t < 0) t += 1; if (t > 1) t -= 1; if (t < 1 / 6) return p + (q - p) * 6 * t; if (t < 1 / 2) return q; if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6; return p; };
    let r, g, b; if (!s) { r = g = b = l; } else { const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q; r = hue2rgb(p, q, h + 1 / 3); g = hue2rgb(p, q, h); b = hue2rgb(p, q, h - 1 / 3); }
    const toHex = v => Math.round(v * 255).toString(16).padStart(2, '0');
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};
const buildPaletteFromBase = (baseHex = '#374B6A') => {
    const hsl = hexToHsl(baseHex);
    const steps = { 50: .38, 100: .32, 200: .26, 300: .2, 400: .14, 500: 0, 600: -.06, 700: -.12, 800: -.18, 900: -.24 };
    const palette = {};
    Object.entries(steps).forEach(([tone, delta]) => { palette[tone] = hslToHex({ h: hsl.h, s: hsl.s, l: clamp(hsl.l + delta, 0.05, 0.95) }); });
    return palette;
};
const hasHouseNumber = (address = '') => /\d/.test(String(address || '').trim());

const CheckoutPage = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { customer } = useCustomerAuthStore();
    const {
        items: cartItems,
        getTotal,
        updateQuantity,
        removeItem,
        clearCart,
        orderMode,
        tableNumber,
        restaurantId: cartRestaurantId,
        reconcileWithRestaurantMenu
    } = useCartStore();
    const { restaurant, currency } = location.state || {};
    const { setTheme, setCustomColors } = useTheme();

    // Apply restaurant theme on mount so checkout inherits the QR-menu style
    useEffect(() => {
        if (restaurant?.primaryColor) {
            const palette = buildPaletteFromBase(restaurant.primaryColor);
            setCustomColors(palette);
            setTheme('custom');
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [restaurant?.primaryColor]);

    const isDineIn = orderMode === 'dine_in';

    const [loading, setLoading] = useState(false);
    const [showLoginModal, setShowLoginModal] = useState(false);
    const [addresses, setAddresses] = useState([]);
    const [addressesLoading, setAddressesLoading] = useState(false);
    const [selectedAddressId, setSelectedAddressId] = useState(null);
    const [guestDeliveryLocation, setGuestDeliveryLocation] = useState(null);
    const [deliveryType, setDeliveryType] = useState(isDineIn ? 'dine_in' : 'delivery');

    // Гарантируем правильный режим при переключении (QR vs Доставка)
    useEffect(() => {
        if (isDineIn) {
            setDeliveryType('dine_in');
        } else if (deliveryType === 'dine_in') {
            setDeliveryType('delivery');
        }
    }, [isDineIn]);

    const [paymentMethod, setPaymentMethod] = useState('cash');
    const [comment, setComment] = useState('');
    const [showNewAddressForm, setShowNewAddressForm] = useState(false);
    const [newAddress, setNewAddress] = useState({ address: '', entrance: '', floor: '', apartment: '', comment: '' });
    const [showGuestAddressForm, setShowGuestAddressForm] = useState(false);
    const [guestAddressDraft, setGuestAddressDraft] = useState('');
    const [guestAddressCoords, setGuestAddressCoords] = useState(null);
    const [guestAddressCity, setGuestAddressCity] = useState('');
    const [guestAddressDetails, setGuestAddressDetails] = useState({ entrance: '', floor: '', apartment: '' });
    const [guestContactName, setGuestContactName] = useState('');
    const [guestContactPhone, setGuestContactPhone] = useState('');
    const [newAddressCity, setNewAddressCity] = useState('');
    const [checkoutStep, setCheckoutStep] = useState(1);

    // Delivery zone check via Yandex Geocoder
    const [zoneStatus, setZoneStatus] = useState(null); // null | 'checking' | 'ok' | 'outside' | 'error' | 'no-zone'
    const [zoneMessage, setZoneMessage] = useState('');
    const [zoneDistance, setZoneDistance] = useState(null);
    const [servingRestaurant, setServingRestaurant] = useState(null);
    const [selectedDeliveryCoords, setSelectedDeliveryCoords] = useState(null);
    const [isReconcilingCart, setIsReconcilingCart] = useState(false);
    const [isCompletingOrder, setIsCompletingOrder] = useState(false);
    const [bonusBalance, setBonusBalance] = useState(0);
    const [bonusLoading, setBonusLoading] = useState(false);
    const [useBonuses, setUseBonuses] = useState(false);
    const [bonusRequested, setBonusRequested] = useState('0');

    useEffect(() => {
        if (!isCompletingOrder && (!restaurant || !cartItems || cartItems.length === 0)) {
            navigate(-1);
            return;
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [restaurant, cartItems?.length, isCompletingOrder]);

    useEffect(() => {
        const city = String(restaurant?.city || '').trim();
        if (!city) return;
        setGuestAddressCity((prev) => String(prev || '').trim() || city);
        setNewAddressCity((prev) => String(prev || '').trim() || city);
    }, [restaurant?.city]);

    useEffect(() => {
        if (!customer?.id) {
            setBonusBalance(0);
            setUseBonuses(false);
            setBonusRequested('0');
            return;
        }

        const loadAvailableBonuses = async () => {
            setBonusLoading(true);
            try {
                const summary = await customerService.getBonusSummary(1);
                const available = Math.max(0, Math.floor(Number(summary?.activePoints || 0)));
                setBonusBalance(available);
                setBonusRequested(String(available));
            } catch (error) {
                console.error('Failed to load bonus balance', error);
                setBonusBalance(0);
                setUseBonuses(false);
                setBonusRequested('0');
            } finally {
                setBonusLoading(false);
            }
        };

        loadAvailableBonuses();
    }, [customer?.id]);

    // Загружаем адреса только когда выбран тип "доставка"
    useEffect(() => {
        if (customer?.id && deliveryType === 'delivery') {
            loadAddresses();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [customer?.id, deliveryType]);

    useEffect(() => {
        if (customer?.id) {
            setGuestDeliveryLocation(null);
            return;
        }

        try {
            const raw = localStorage.getItem(GUEST_DELIVERY_LOCATION_KEY);
            if (!raw) {
                setGuestDeliveryLocation(null);
                return;
            }
            const parsed = JSON.parse(raw);
            const latitude = Number(parsed?.latitude);
            const longitude = Number(parsed?.longitude);
            if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
                setGuestDeliveryLocation(null);
                return;
            }
            setGuestDeliveryLocation({
                latitude,
                longitude,
                address: parsed?.address || '',
                confirmed: Boolean(parsed?.confirmed)
            });
            setGuestAddressDraft(parsed?.address || '');
            setGuestAddressCoords({ latitude, longitude });
        } catch {
            setGuestDeliveryLocation(null);
        }
    }, [customer?.id, deliveryType]);

    useEffect(() => {
        if (customer?.id) {
            setGuestContactName('');
            setGuestContactPhone('');
            return;
        }

        try {
            const raw = localStorage.getItem(GUEST_CHECKOUT_CONTACT_KEY);
            if (!raw) return;
            const parsed = JSON.parse(raw);
            setGuestContactName(String(parsed?.name || ''));
            setGuestContactPhone(String(parsed?.phone || ''));
        } catch {
            // ignore storage errors
        }
    }, [customer?.id]);

    useEffect(() => {
        if (customer?.id) return;
        localStorage.setItem(GUEST_CHECKOUT_CONTACT_KEY, JSON.stringify({
            name: guestContactName,
            phone: guestContactPhone
        }));
    }, [customer?.id, guestContactName, guestContactPhone]);

    useEffect(() => {
        if (customer?.id) {
            setGuestAddressDetails({ entrance: '', floor: '', apartment: '' });
            return;
        }

        try {
            const raw = localStorage.getItem(GUEST_CHECKOUT_ADDRESS_DETAILS_KEY);
            if (!raw) return;
            const parsed = JSON.parse(raw);
            setGuestAddressDetails({
                entrance: String(parsed?.entrance || ''),
                floor: String(parsed?.floor || ''),
                apartment: String(parsed?.apartment || '')
            });
        } catch {
            // ignore storage errors
        }
    }, [customer?.id]);

    useEffect(() => {
        if (customer?.id) return;
        localStorage.setItem(GUEST_CHECKOUT_ADDRESS_DETAILS_KEY, JSON.stringify({
            entrance: guestAddressDetails.entrance,
            floor: guestAddressDetails.floor,
            apartment: guestAddressDetails.apartment
        }));
    }, [customer?.id, guestAddressDetails]);

    // Сбрасываем зону при смене типа
    useEffect(() => {
        if (deliveryType !== 'delivery') {
            setZoneStatus(null);
            setServingRestaurant(null);
            setSelectedDeliveryCoords(null);
        }
    }, [deliveryType]);

    // Проверяем зону при выборе адреса
    useEffect(() => {
        if (deliveryType !== 'delivery' || !selectedAddressId || !restaurant?.id) return;
        const addr = addresses.find(a => a.id === selectedAddressId);
        if (!addr) return;

        // Если у адреса уже есть координаты — проверяем сразу
        if (addr.latitude && addr.longitude) {
            checkZoneByCoords(addr.latitude, addr.longitude);
        } else {
            // Геокодируем адрес через Yandex
            geocodeAndCheck(addr.address);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedAddressId, addresses]);

    useEffect(() => {
        if (deliveryType !== 'delivery' || customer?.id || !restaurant?.id) return;
        const latitude = Number(guestDeliveryLocation?.latitude);
        const longitude = Number(guestDeliveryLocation?.longitude);
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;

        checkZoneByCoords(latitude, longitude);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [deliveryType, customer?.id, restaurant?.id, guestDeliveryLocation?.latitude, guestDeliveryLocation?.longitude]);

    useEffect(() => {
        if (deliveryType !== 'delivery') return;
        if (!servingRestaurant?.id || !restaurant?.subdomain) return;
        if (!selectedDeliveryCoords?.latitude || !selectedDeliveryCoords?.longitude) return;
        if (!cartItems?.length) return;
        if (servingRestaurant.id === cartRestaurantId) return;

        let cancelled = false;

        const reconcileCartForServingPoint = async () => {
            setIsReconcilingCart(true);
            try {
                const nearestMenu = await restaurantService.getBySubdomain(
                    restaurant.subdomain,
                    undefined,
                    {
                        latitude: selectedDeliveryCoords.latitude,
                        longitude: selectedDeliveryCoords.longitude,
                        forceRefresh: true
                    }
                );

                if (cancelled || !nearestMenu?.id) return;

                const summary = reconcileWithRestaurantMenu(nearestMenu);

                if (summary?.removedItems > 0) {
                    toast.error(`Удалено недоступных позиций: ${summary.removedItems}. Корзина обновлена по ближайшей точке.`, { duration: 5000 });
                } else if (summary?.updatedItems > 0) {
                    toast('Корзина обновлена по ближайшей точке доставки.', { icon: '📍' });
                }
            } catch (error) {
                console.error('Failed to reconcile cart for serving point', error);
            } finally {
                if (!cancelled) {
                    setIsReconcilingCart(false);
                }
            }
        };

        reconcileCartForServingPoint();

        return () => {
            cancelled = true;
        };
    }, [
        deliveryType,
        servingRestaurant?.id,
        restaurant?.subdomain,
        selectedDeliveryCoords?.latitude,
        selectedDeliveryCoords?.longitude,
        cartItems?.length,
        cartRestaurantId,
        reconcileWithRestaurantMenu
    ]);

    const checkZoneByCoords = async (lat, lng) => {
        setZoneStatus('checking');
        setSelectedDeliveryCoords({ latitude: lat, longitude: lng });
        try {
            const resp = await api.get('/geolocation/check-delivery', {
                params: { subdomain: restaurant.subdomain, latitude: lat, longitude: lng }
            });
            const data = resp.data;
            setZoneDistance(data.distance);
            if (data.deliveryAvailable) {
                setZoneStatus('ok');
                setZoneMessage(
                    data.servingRestaurant?.name
                        ? `Доставка доступна (${data.distance} км). Обслуживает: ${data.servingRestaurant.name}`
                        : `Доставка доступна (${data.distance} км)`
                );
                setServingRestaurant(data.servingRestaurant || null);
            } else {
                setZoneStatus('outside');
                setZoneMessage(data.message || `Адрес за пределами зоны доставки (${data.deliveryRadius} км)`);
                setServingRestaurant(null);
            }
        } catch (err) {
            console.error('Zone check failed:', err);
            setZoneStatus('error');
            setZoneMessage('Не удалось проверить зону доставки');
            setServingRestaurant(null);
        }
    };

    const geocodeAndCheck = async (addressText) => {
        setZoneStatus('checking');
        try {
            // Добавляем город ресторана для точности
            const city = String(restaurant?.city || '').trim();
            const query = city ? `${city}, ${addressText}` : addressText;
            const geoResp = await api.get('/geolocation/geocode', {
                params: {
                    address: query,
                    city: city || undefined,
                    strictCity: Boolean(city)
                }
            });
            const geo = geoResp.data;
            if (!geo.found) {
                if (geo.cityMismatch) {
                    setZoneStatus('outside');
                    setZoneMessage(geo.message || (city ? `Адрес должен быть в городе ${city}` : 'Адрес вне доступного города'));
                } else {
                    setZoneStatus('error');
                    setZoneMessage('Не удалось определить координаты адреса');
                }
                return;
            }
            // Сохраняем координаты для адреса (обновляем в фоне)
            const addr = addresses.find(a => a.id === selectedAddressId);
            if (addr && customer?.id) {
                api.put(`/customers/addresses/${selectedAddressId}`, {
                    address: addr.address,
                    latitude: geo.latitude,
                    longitude: geo.longitude
                }).catch(() => { });
            }
            await checkZoneByCoords(geo.latitude, geo.longitude);
        } catch (err) {
            console.error('Geocoding failed:', err);
            setZoneStatus('error');
            setZoneMessage('Не удалось определить координаты адреса');
        }
    };

    const handleSaveGuestAddress = async () => {
        const draft = String(guestAddressDraft || '').trim();
        let latitude = Number(guestAddressCoords?.latitude);
        let longitude = Number(guestAddressCoords?.longitude);
        let finalAddress = draft || guestDeliveryLocation?.address || '';
        let geocodeErrorMessage = '';
        const city = String(guestAddressCity || restaurant?.city || '').trim();

        if (finalAddress) {
            try {
                const query = city ? `${city}, ${finalAddress}` : finalAddress;
                const geoResp = await api.get('/geolocation/geocode', {
                    params: {
                        address: query,
                        city: city || undefined,
                        strictCity: Boolean(city)
                    }
                });
                if (geoResp.data?.found) {
                    latitude = Number(geoResp.data.latitude);
                    longitude = Number(geoResp.data.longitude);
                    finalAddress = geoResp.data.formattedAddress || finalAddress;
                } else if (geoResp.data?.cityMismatch) {
                    geocodeErrorMessage = geoResp.data?.message || (city ? `Адрес должен быть в городе ${city}` : '');
                }
            } catch {
                // keep fallback error below
            }
        }

        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
            toast.error(geocodeErrorMessage || 'Не удалось определить координаты адреса');
            return;
        }
        if (!hasHouseNumber(finalAddress)) {
            toast.error('Укажите улицу и номер дома');
            return;
        }

        const payload = {
            latitude,
            longitude,
            address: finalAddress,
            confirmed: true,
            updatedAt: new Date().toISOString()
        };
        localStorage.setItem(GUEST_DELIVERY_LOCATION_KEY, JSON.stringify(payload));
        setGuestDeliveryLocation(payload);
        setGuestAddressDraft(finalAddress);
        setGuestAddressCoords({ latitude, longitude });
        setShowGuestAddressForm(false);
        await checkZoneByCoords(latitude, longitude);
        toast.success('Адрес обновлен');
    };

    const loadAddresses = async () => {
        setAddressesLoading(true);
        try {
            const response = await api.get('/customers/addresses');
            const list = response.data?.addresses || response.data || [];
            setAddresses(Array.isArray(list) ? list : []);
            const defaultAddress = (Array.isArray(list) ? list : []).find((addr) => addr.isDefault);
            if (defaultAddress) {
                setSelectedAddressId(defaultAddress.id);
            } else if (list.length > 0) {
                setSelectedAddressId(list[0].id);
            }
        } catch (error) {
            console.error('Failed to load addresses', error);
            toast.error('Не удалось загрузить адреса');
        } finally {
            setAddressesLoading(false);
        }
    };

    const handleAddAddress = async () => {
        if (!customer?.id) {
            setShowLoginModal(true);
            return;
        }
        if (!newAddress.address.trim()) {
            toast.error('Укажите адрес');
            return;
        }
        if (!hasHouseNumber(newAddress.address)) {
            toast.error('Укажите улицу и номер дома');
            return;
        }

        try {
            // Используем координаты из автокомплита, или геокодируем
            let lat = Number(newAddress.latitude);
            let lng = Number(newAddress.longitude);
            const city = String(newAddressCity || restaurant?.city || '').trim();
            if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
                try {
                    const query = city ? `${city}, ${newAddress.address}` : newAddress.address;
                    const geoResp = await api.get('/geolocation/geocode', {
                        params: {
                            address: query,
                            city: city || undefined,
                            strictCity: Boolean(city)
                        }
                    });
                    if (geoResp.data?.found) {
                        lat = Number(geoResp.data.latitude);
                        lng = Number(geoResp.data.longitude);
                    } else if (geoResp.data?.cityMismatch) {
                        toast.error(geoResp.data?.message || (city ? `Адрес должен быть в городе ${city}` : 'Адрес не подходит'));
                        return;
                    }
                } catch (geoErr) {
                    console.warn('Geocoding failed for new address, saving without coords:', geoErr);
                }
            }

            if ((!Number.isFinite(lat) || !Number.isFinite(lng)) && city) {
                toast.error(`Адрес должен быть в городе ${city}`);
                return;
            }

            const { latitude, longitude, ...addrData } = newAddress;
            await api.post('/customers/addresses', {
                ...addrData,
                ...(Number.isFinite(lat) && Number.isFinite(lng) ? { latitude: lat, longitude: lng } : {})
            });
            toast.success('Адрес сохранен');
            setShowNewAddressForm(false);
            setNewAddress({ address: '', entrance: '', floor: '', apartment: '', comment: '' });
            loadAddresses();
        } catch (error) {
            console.error('Failed to add address', error);
            toast.error('Не удалось сохранить адрес');
        }
    };

    const handleDeleteAddress = async (id) => {
        try {
            await api.delete(`/customers/addresses/${id}`);
            toast.success('Адрес удален');
            if (selectedAddressId === id) {
                setSelectedAddressId(null);
            }
            loadAddresses();
        } catch (error) {
            console.error('Failed to delete address', error);
            toast.error('Не удалось удалить адрес');
        }
    };

    const handlePlaceOrder = async () => {
        if (!cartItems || cartItems.length === 0) {
            toast.error('Корзина пуста');
            return;
        }

        if (!customer?.id && !isDineIn) {
            if (!String(guestContactName || '').trim() || guestPhoneDigits.length < 8) {
                toast.error('Укажите имя и телефон для связи');
                return;
            }
        }

        if (deliveryType === 'delivery') {
            if (customer?.id && !selectedAddressId) {
                toast.error('Выберите адрес доставки');
                return;
            }

            if (customer?.id) {
                const selectedAddress = addresses.find((addr) => addr.id === selectedAddressId);
                if (!hasHouseNumber(selectedAddress?.address || '')) {
                    toast.error('Укажите улицу и номер дома в адресе доставки');
                    return;
                }
            }

            if (!customer?.id) {
                const lat = Number(guestDeliveryLocation?.latitude);
                const lng = Number(guestDeliveryLocation?.longitude);
                if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
                    toast.error('Сначала укажите адрес в меню');
                    return;
                }
                if (!hasHouseNumber(guestDeliveryLocation?.address || '')) {
                    toast.error('Укажите улицу и номер дома');
                    return;
                }
            }
        }

        setLoading(true);
        try {
            setIsCompletingOrder(true);
            const guestLat = Number(guestDeliveryLocation?.latitude);
            const guestLng = Number(guestDeliveryLocation?.longitude);
            const normalizedComment = String(comment || '').trim();
            const guestAddressMeta = !customer?.id && deliveryType === 'delivery' && guestAddressDetailParts.length > 0
                ? `Детали адреса: ${guestAddressDetailParts.join(', ')}`
                : '';
            const orderComment = [normalizedComment, guestAddressMeta].filter(Boolean).join('\n');
            const guestAddressPayload = !customer?.id && deliveryType === 'delivery'
                ? {
                    deliveryAddress: guestDeliveryLocation?.address || null,
                    deliveryLatitude: Number.isFinite(guestLat) ? guestLat : null,
                    deliveryLongitude: Number.isFinite(guestLng) ? guestLng : null
                }
                : {};

            const payload = {
                restaurantId: servingRestaurant?.id || cartRestaurantId || restaurant?.id,
                items: cartItems.map(item => ({
                    id: item.dish?.id,
                    quantity: item.quantity,
                    price: getItemUnitPrice(item),
                    selectedModifiers: item.modifiers?.map(m => ({ id: m.id, name: m.name, price: m.price })) || []
                })),
                total: Number(baseTotalWithDelivery.toFixed(2)),
                bonusToSpend: customer?.id ? appliedBonus : 0,
                deliveryType: isDineIn ? 'dine_in' : deliveryType,
                tableNumber: isDineIn ? tableNumber : null,
                customerAddressId: customer?.id && deliveryType === 'delivery' ? selectedAddressId : null,
                paymentMethod,
                comment: orderComment || null,
                ...(!customer?.id ? {
                    customerName: String(guestContactName || '').trim() || 'Гость',
                    customerPhone: String(guestContactPhone || '').trim()
                } : {}),
                ...guestAddressPayload
            };

            // Для dine_in без авторизации — отправляем на общий endpoint
            const endpoint = customer?.id ? '/customers/orders' : '/orders';
            const response = await api.post(endpoint, payload);
            clearCart();
            const orderData = response?.data?.order || response?.data;
            const successPayload = {
                order: orderData,
                restaurant,
                currency
            };

            sessionStorage.setItem('last-order-success', JSON.stringify(successPayload));

            navigate('/order-success', {
                replace: true,
                state: successPayload
            });
        } catch (error) {
            setIsCompletingOrder(false);
            console.error('Failed to place order', error);
            const stoppedDishes = error.response?.data?.stoppedDishes;
            if (Array.isArray(stoppedDishes) && stoppedDishes.length > 0) {
                const dishesText = stoppedDishes
                    .map((x) => x.name ? `${x.name}${x.reason ? ` (${x.reason})` : ''}` : x.dishId)
                    .join(', ');
                toast.error(`Некоторые блюда временно недоступны: ${dishesText}`, { duration: 6000 });
            } else {
                const message = error.response?.data?.error || 'Не удалось оформить заказ';
                toast.error(message);
            }
        } finally {
            setLoading(false);
        }
    };

    const getItemModifiersTotal = (item) => {
        if (!Array.isArray(item?.modifiers)) return 0;
        return item.modifiers.reduce((sum, modifier) => sum + (Number(modifier?.price) || 0), 0);
    };

    const getItemUnitPrice = (item) => {
        const dish = item?.dish || {};
        const isDeliveryMode = deliveryType !== 'dine_in';
        const basePrice = isDeliveryMode && dish.deliveryPrice !== null && dish.deliveryPrice !== undefined
            ? Number(dish.deliveryPrice)
            : Number(dish.price);

        return Number(((Number.isFinite(basePrice) ? basePrice : 0) + getItemModifiersTotal(item)).toFixed(2));
    };

    const total = cartItems.reduce((sum, item) => {
        const quantity = Number(item?.quantity) || 0;
        return sum + (getItemUnitPrice(item) * quantity);
    }, 0);
    const deliveryPricingSource = deliveryType === 'delivery' && servingRestaurant ? servingRestaurant : restaurant;
    const freeDeliveryThreshold = Number(deliveryPricingSource?.freeDeliveryThreshold || 0);
    const isFreeDelivery = freeDeliveryThreshold > 0 && total >= freeDeliveryThreshold;
    const deliveryFee = deliveryType === 'delivery' && !isFreeDelivery ? Number(deliveryPricingSource?.deliveryFee || 0) : 0;
    const baseTotalWithDelivery = total + deliveryFee;
    const maxBonusApplicable = Math.max(0, Math.floor(baseTotalWithDelivery));
    const normalizedRequestedBonus = Math.floor(Number(bonusRequested || 0));
    const safeRequestedBonus = Number.isFinite(normalizedRequestedBonus) && normalizedRequestedBonus > 0 ? normalizedRequestedBonus : 0;
    const appliedBonus = useBonuses
        ? Math.min(safeRequestedBonus, bonusBalance, maxBonusApplicable)
        : 0;
    const finalTotal = (baseTotalWithDelivery - appliedBonus).toFixed(2);
    const totalDishCount = cartItems.reduce((sum, item) => sum + (Number(item?.quantity) || 0), 0);
    const isGuestContactRequired = !customer?.id && !isDineIn;
    const guestPhoneDigits = String(guestContactPhone || '').replace(/\D/g, '');
    const isGuestContactValid = !isGuestContactRequired
        || (String(guestContactName || '').trim().length >= 2 && guestPhoneDigits.length >= 8);
    const selectedAddressForSummary = customer?.id
        ? (addresses.find((addr) => addr.id === selectedAddressId) || null)
        : guestDeliveryLocation;
    const hasExactDeliveryAddress = useMemo(() => hasHouseNumber(selectedAddressForSummary?.address || ''), [selectedAddressForSummary?.address]);
    const deliveryMethodLabel = isDineIn
        ? (tableNumber ? `В зале · стол ${tableNumber}` : 'В зале')
        : deliveryType === 'delivery'
            ? 'Доставка'
            : 'Самовывоз';
    const compactDeliveryAddress = useMemo(() => {
        const raw = selectedAddressForSummary?.address || '';
        if (!raw) return '';
        const parts = raw.split(',').map((part) => part.trim()).filter(Boolean);
        const partsWithoutCountry = parts.filter((part) => !/^(казахстан|кыргызстан|киргизия|россия|kazakhstan|kyrgyzstan|russia)$/i.test(part));
        const source = partsWithoutCountry.length ? partsWithoutCountry : parts;
        const withNumber = source.filter((part) => /\d/.test(part));
        if (withNumber.length > 0) {
            const lastDetailed = withNumber[withNumber.length - 1];
            const detailedIndex = source.lastIndexOf(lastDetailed);
            const prev = detailedIndex > 0 ? source[detailedIndex - 1] : '';
            const lastLooksOnlyHouseNumber = /^\d+[a-zа-я]?(?:[\/-]\d+[a-zа-я]?)?$/i.test(lastDetailed);
            const prevIsStreetLike = prev && !/(район|область|город|г\.)/i.test(prev);
            if (lastLooksOnlyHouseNumber && prevIsStreetLike) {
                return `${prev}, ${lastDetailed}`;
            }
            return lastDetailed;
        }
        return source.slice(-2).join(', ') || raw;
    }, [selectedAddressForSummary?.address]);
    const guestAddressDetailParts = useMemo(() => ([
        guestAddressDetails.entrance && `подъезд ${guestAddressDetails.entrance}`,
        guestAddressDetails.floor && `этаж ${guestAddressDetails.floor}`,
        guestAddressDetails.apartment && `кв. ${guestAddressDetails.apartment}`
    ].filter(Boolean)), [guestAddressDetails]);

    const placeOrderDisabledReason = useMemo(() => {
        if (loading) return 'Оформляем заказ...';
        if (!customer?.id && !isDineIn && !isGuestContactValid) return 'Укажите имя и телефон для связи';
        if (!isDineIn && deliveryType === 'delivery' && isReconcilingCart) return 'Обновляем корзину по ближайшей точке...';
        if (!isDineIn && deliveryType === 'delivery' && addressesLoading) return 'Загружаем адреса...';
        if (!isDineIn && deliveryType === 'delivery' && customer?.id && !selectedAddressId) return 'Выберите адрес доставки';
        if (!isDineIn && deliveryType === 'delivery' && !customer?.id) {
            const lat = Number(guestDeliveryLocation?.latitude);
            const lng = Number(guestDeliveryLocation?.longitude);
            if (!Number.isFinite(lat) || !Number.isFinite(lng)) return 'Сначала укажите адрес в меню';
            if (!hasExactDeliveryAddress) return 'Укажите улицу и номер дома';
        }
        if (!isDineIn && deliveryType === 'delivery' && customer?.id && !hasExactDeliveryAddress) return 'Укажите улицу и номер дома';
        if (!isDineIn && deliveryType === 'delivery' && zoneStatus === 'checking') return 'Проверяем зону доставки...';
        if (!isDineIn && deliveryType === 'delivery' && zoneStatus === 'outside') return 'Адрес вне зоны доставки';
        return '';
    }, [loading, isDineIn, deliveryType, isReconcilingCart, addressesLoading, selectedAddressId, zoneStatus, customer?.id, guestDeliveryLocation?.latitude, guestDeliveryLocation?.longitude, isGuestContactValid, hasExactDeliveryAddress]);

    const isPlaceOrderDisabled = Boolean(placeOrderDisabledReason);

    const orderSection = (
        <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
                <h2 className="font-semibold text-base">Ваш заказ</h2>
                <span className="text-xs text-gray-500">{cartItems.length} поз.</span>
            </div>

            <div className="divide-y divide-gray-100">
                {cartItems.map((item) => (
                    <div key={item.itemId} className="py-3 flex justify-between items-start gap-3">
                        <div className="flex-1 min-w-0 space-y-1">
                            <div className="font-medium text-sm text-gray-900 break-words">{item.dish.name}</div>
                            {item.modifiers?.length > 0 && (
                                <div className="text-xs text-gray-500 break-words">{item.modifiers.map((m) => m.name).join(', ')}</div>
                            )}
                        </div>
                        <div className="flex flex-col items-end gap-2">
                            <div className="flex items-center gap-2 rounded-full border border-gray-200 px-2 py-1 bg-gray-50">
                                <button
                                    onClick={() => updateQuantity(item.itemId, item.quantity - 1)}
                                    className="w-7 h-7 rounded-full flex items-center justify-center text-base text-gray-700 hover:bg-gray-200 active:scale-95 transition"
                                >
                                    -
                                </button>
                                <span className="min-w-[28px] text-center text-sm font-semibold">{item.quantity}</span>
                                <button
                                    onClick={() => updateQuantity(item.itemId, item.quantity + 1)}
                                    className="w-7 h-7 rounded-full flex items-center justify-center text-base text-gray-700 hover:bg-gray-200 active:scale-95 transition"
                                >
                                    +
                                </button>
                            </div>
                            <div className="text-sm font-semibold text-gray-900 whitespace-nowrap">{(getItemUnitPrice(item) * item.quantity).toFixed(2)} {currency}</div>
                        </div>
                    </div>
                ))}
            </div>

            <div className="pt-3 space-y-1.5 text-sm">
                <div className="flex justify-between text-gray-600">
                    <span>Сумма заказа</span>
                    <span>{total.toFixed(2)} {currency}</span>
                </div>
                {deliveryType === 'delivery' && (
                    <div className="flex justify-between text-gray-600">
                        <span>Доставка</span>
                        {isFreeDelivery ? (
                            <span className="text-green-600 font-medium">Бесплатно ✓</span>
                        ) : (
                            <span>{deliveryFee > 0 ? `${deliveryFee.toFixed(2)} ${currency}` : 'Бесплатно'}</span>
                        )}
                    </div>
                )}
                {deliveryType === 'delivery' && !isFreeDelivery && freeDeliveryThreshold > 0 && (
                    <div className="text-xs text-green-600 bg-green-50 rounded-lg px-3 py-1.5">
                        Бесплатная доставка от {freeDeliveryThreshold.toFixed(0)} {currency} — добавьте ещё {(freeDeliveryThreshold - total).toFixed(0)} {currency}
                    </div>
                )}
                {customer?.id && appliedBonus > 0 && (
                    <div className="flex justify-between text-green-700">
                        <span>Списано бонусов</span>
                        <span>-{appliedBonus} {currency}</span>
                    </div>
                )}
                <div className="flex justify-between text-base font-bold text-gray-900">
                    <span>Итого</span>
                    <span>{finalTotal} {currency}</span>
                </div>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-gray-50" style={{ paddingBottom: 'calc(136px + env(safe-area-inset-bottom, 0px))' }}>
            <div className="max-w-[480px] mx-auto px-4 pt-4 pb-8 space-y-4">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => {
                            if (checkoutStep === 2) {
                                setCheckoutStep(1);
                                return;
                            }
                            navigate(-1);
                        }}
                        aria-label={checkoutStep === 2 ? 'К корзине' : 'Назад'}
                        title={checkoutStep === 2 ? 'К корзине' : 'Назад'}
                        className="w-8 h-8 rounded-full border border-primary-200 text-primary-600 flex items-center justify-center"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                    </button>
                    <h1 className="text-xl font-bold">Оформление заказа</h1>
                </div>

                <div className="bg-white rounded-lg shadow-sm p-4">
                    <div className="flex items-center justify-between text-sm text-gray-600 mb-3">
                        <span>Шаг {checkoutStep} из 2</span>
                    </div>

                    <div className="mb-4 grid grid-cols-2 gap-2">
                        <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2">
                            <div className="text-[11px] uppercase tracking-wide text-gray-500">Блюд</div>
                            <div className="text-sm font-semibold text-gray-900">{totalDishCount}</div>
                        </div>
                        <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2">
                            <div className="text-[11px] uppercase tracking-wide text-gray-500">Метод</div>
                            <div className="text-sm font-semibold text-gray-900">{deliveryMethodLabel}</div>
                        </div>
                        {!isDineIn && deliveryType === 'delivery' && (
                            <div className="col-span-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2">
                                <div className="text-[11px] uppercase tracking-wide text-gray-500">Адрес</div>
                                <div className="text-sm font-semibold text-gray-900 truncate">
                                    {compactDeliveryAddress || (customer?.id ? 'Выберите адрес доставки' : 'Сначала укажите адрес в меню')}
                                </div>
                            </div>
                        )}
                        <div className="col-span-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600">
                            {servingRestaurant?.name
                                ? `Обслуживает: ${servingRestaurant.name}`
                                : `Ресторан: ${restaurant?.name || '—'}`}
                        </div>
                    </div>

                    {checkoutStep === 1 ? (
                        orderSection
                    ) : (
                        <div className="space-y-4">
                            {/* Для dine_in показываем номер стола */}
                            {isDineIn ? (
                                <div className="bg-white rounded-lg shadow-sm p-4">
                                    <h2 className="font-semibold text-base mb-3">Заказ в зале</h2>
                                    <div className="flex items-center gap-3 p-3 bg-primary-50 rounded-lg border-2 border-primary-600">
                                        <div className="text-3xl">🍽️</div>
                                        <div>
                                            <div className="font-semibold text-base">{tableNumber ? `Стол ${tableNumber}` : 'Заказ в зале'}</div>
                                            <div className="text-xs text-gray-500">Заказ будет отправлен на кухню</div>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="bg-white rounded-lg shadow-sm p-4">
                                    <h2 className="font-semibold text-base mb-3">Способ получения</h2>
                                    <div className="grid grid-cols-2 gap-2 rounded-xl bg-gray-100 p-1.5">
                                        <button
                                            onClick={() => setDeliveryType('delivery')}
                                            className={`rounded-lg px-3 py-2.5 text-left transition-all ${deliveryType === 'delivery'
                                                ? 'bg-white border border-primary-500 shadow-sm'
                                                : 'border border-transparent text-gray-700'
                                                }`}
                                        >
                                            <div className="font-semibold text-sm">Доставка</div>
                                            {isFreeDelivery ? (
                                                <div className="text-xs text-green-600 font-medium">Бесплатно ✓</div>
                                            ) : restaurant?.deliveryFee > 0 ? (
                                                <div className="text-xs text-gray-500">{restaurant.deliveryFee} {currency}</div>
                                            ) : null}
                                        </button>
                                        <button
                                            onClick={() => setDeliveryType('pickup')}
                                            className={`rounded-lg px-3 py-2.5 text-left transition-all ${deliveryType === 'pickup'
                                                ? 'bg-white border border-primary-500 shadow-sm'
                                                : 'border border-transparent text-gray-700'
                                                }`}
                                        >
                                            <div className="font-semibold text-sm">Самовывоз</div>
                                            <div className="text-xs text-gray-500">Бесплатно</div>
                                        </button>
                                    </div>
                                </div>
                            )}

                            {!customer?.id && !isDineIn && (
                                <div className="bg-white rounded-lg shadow-sm p-4">
                                    <h2 className="font-semibold text-base mb-3">Контактные данные</h2>
                                    <div className="space-y-2.5">
                                        <label className="block text-xs font-medium text-gray-600 mb-1">Имя</label>
                                        <input
                                            type="text"
                                            placeholder="Например, Азамат"
                                            value={guestContactName}
                                            onChange={(e) => setGuestContactName(e.target.value)}
                                            className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-100 outline-none transition"
                                        />
                                        <label className="block text-xs font-medium text-gray-600 mb-1">Телефон</label>
                                        <input
                                            type="tel"
                                            inputMode="tel"
                                            autoComplete="tel"
                                            placeholder="+996 700 000 000"
                                            value={guestContactPhone}
                                            onChange={(e) => setGuestContactPhone(e.target.value)}
                                            className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-100 outline-none transition"
                                        />
                                        <p className="text-xs text-gray-500">
                                            Нужны только для связи по заказу.
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* Статус зоны доставки */}
                            {!isDineIn && deliveryType === 'delivery' && zoneStatus && zoneStatus !== 'no-zone' && (
                                <div className={`rounded-lg p-3 text-sm flex items-center gap-2 ${zoneStatus === 'checking' ? 'bg-blue-50 text-blue-700' :
                                    zoneStatus === 'ok' ? 'bg-green-50 text-green-700' :
                                        zoneStatus === 'outside' ? 'bg-red-50 text-red-700' :
                                            'bg-yellow-50 text-yellow-700'
                                    }`}>
                                    {zoneStatus === 'checking' && (
                                        <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg> Проверяем зону доставки...</>
                                    )}
                                    {zoneStatus === 'ok' && (
                                        <><span>📍</span> {zoneMessage}</>
                                    )}
                                    {zoneStatus === 'outside' && (
                                        <><span>⚠️</span> {zoneMessage}</>
                                    )}
                                    {zoneStatus === 'error' && (
                                        <><span>📍</span> {zoneMessage}
                                            <button onClick={() => {
                                                if (customer?.id) {
                                                    const addr = addresses.find(a => a.id === selectedAddressId);
                                                    if (addr) geocodeAndCheck(addr.address);
                                                    return;
                                                }
                                                const lat = Number(guestDeliveryLocation?.latitude);
                                                const lng = Number(guestDeliveryLocation?.longitude);
                                                if (Number.isFinite(lat) && Number.isFinite(lng)) {
                                                    checkZoneByCoords(lat, lng);
                                                }
                                            }} className="ml-auto text-xs underline font-medium">Повторить</button>
                                        </>
                                    )}
                                </div>
                            )}

                            {!isDineIn && deliveryType === 'delivery' && !customer?.id && (
                                <div className="bg-white rounded-lg shadow-sm p-4">
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="min-w-0">
                                            <h2 className="font-semibold text-base">Адрес доставки</h2>
                                            <p className="text-sm text-gray-700 truncate mt-0.5">
                                                {compactDeliveryAddress || 'Сначала укажите адрес в меню'}
                                            </p>
                                        </div>
                                        <button
                                            onClick={() => setShowGuestAddressForm((prev) => !prev)}
                                            className="shrink-0 rounded-lg px-3 py-1.5 border border-gray-300 bg-white text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
                                        >
                                            {showGuestAddressForm ? 'Скрыть' : (guestAddressDetailParts.length > 0 ? 'Изменить' : 'Детали')}
                                        </button>
                                    </div>
                                    <p className={`mt-2 text-xs ${guestAddressDetailParts.length > 0 ? 'text-gray-500' : 'text-amber-700'}`}>
                                        {guestAddressDetailParts.length > 0
                                            ? guestAddressDetailParts.join(' · ')
                                            : 'Добавьте подъезд, этаж и квартиру в «Детали»'}
                                    </p>

                                    {showGuestAddressForm && (
                                        <div className="mt-3 space-y-3">
                                            <div>
                                                <label className="block text-xs font-medium text-gray-600 mb-1">Город (если определился неверно)</label>
                                                <input
                                                    type="text"
                                                    placeholder={restaurant?.city || 'Город'}
                                                    value={guestAddressCity}
                                                    onChange={(e) => setGuestAddressCity(e.target.value)}
                                                    className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-100 outline-none transition"
                                                />
                                            </div>
                                            <AddressAutocomplete
                                                value={guestAddressDraft}
                                                onChange={(value) => {
                                                    setGuestAddressDraft(value);
                                                    setGuestAddressCoords(null);
                                                }}
                                                onSelect={(suggestion) => {
                                                    setGuestAddressDraft(suggestion.fullAddress || suggestion.title || '');
                                                    setGuestAddressCoords({
                                                        latitude: suggestion.latitude,
                                                        longitude: suggestion.longitude
                                                    });
                                                }}
                                                placeholder="Улица, дом"
                                                className="w-full px-3.5 py-3 border border-gray-300 rounded-xl text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-100 outline-none transition"
                                                restaurant={restaurant}
                                                cityOverride={guestAddressCity}
                                            />
                                            <div className="grid grid-cols-3 gap-2.5">
                                                <div>
                                                    <label className="block text-xs font-medium text-gray-600 mb-1">Подъезд</label>
                                                    <input
                                                        type="text"
                                                        placeholder="—"
                                                        value={guestAddressDetails.entrance}
                                                        onChange={(e) => setGuestAddressDetails((prev) => ({ ...prev, entrance: e.target.value }))}
                                                        className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm text-center focus:border-primary-500 focus:ring-2 focus:ring-primary-100 outline-none transition"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-medium text-gray-600 mb-1">Этаж</label>
                                                    <input
                                                        type="text"
                                                        placeholder="—"
                                                        value={guestAddressDetails.floor}
                                                        onChange={(e) => setGuestAddressDetails((prev) => ({ ...prev, floor: e.target.value }))}
                                                        className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm text-center focus:border-primary-500 focus:ring-2 focus:ring-primary-100 outline-none transition"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-medium text-gray-600 mb-1">Кв/офис</label>
                                                    <input
                                                        type="text"
                                                        placeholder="—"
                                                        value={guestAddressDetails.apartment}
                                                        onChange={(e) => setGuestAddressDetails((prev) => ({ ...prev, apartment: e.target.value }))}
                                                        className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm text-center focus:border-primary-500 focus:ring-2 focus:ring-primary-100 outline-none transition"
                                                    />
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-2">
                                                <button
                                                    onClick={() => {
                                                        setShowGuestAddressForm(false);
                                                        setGuestAddressDraft(guestDeliveryLocation?.address || '');
                                                        const lat = Number(guestDeliveryLocation?.latitude);
                                                        const lng = Number(guestDeliveryLocation?.longitude);
                                                        if (Number.isFinite(lat) && Number.isFinite(lng)) {
                                                            setGuestAddressCoords({ latitude: lat, longitude: lng });
                                                        } else {
                                                            setGuestAddressCoords(null);
                                                        }
                                                    }}
                                                    className="rounded-xl py-2.5 border border-gray-300 text-gray-700 text-sm font-semibold hover:bg-gray-50 transition-colors"
                                                >
                                                    Отмена
                                                </button>
                                                <button
                                                    onClick={handleSaveGuestAddress}
                                                    className="rounded-xl py-2.5 bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 transition-colors"
                                                >
                                                    Сохранить
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {!isDineIn && deliveryType === 'delivery' && customer?.id && (
                                <div className="bg-white rounded-lg shadow-sm p-4">
                                    <div className="flex justify-between items-center mb-3">
                                        <div>
                                            <h2 className="font-semibold text-base">Адрес доставки</h2>
                                            <p className="text-xs text-gray-500 mt-0.5">Выберите адрес, куда привезти заказ</p>
                                        </div>
                                        <button onClick={() => setShowNewAddressForm(!showNewAddressForm)} className="inline-flex items-center gap-1.5 text-primary-700 text-xs font-semibold px-2.5 py-1.5 rounded-full bg-primary-50 border border-primary-100">
                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                            </svg>
                                            Добавить
                                        </button>
                                    </div>

                                    {showNewAddressForm && (
                                        <div className="mb-4 p-4 bg-gray-50 rounded-xl space-y-3 border border-gray-200">
                                            <div>
                                                <label className="block text-xs font-medium text-gray-600 mb-1.5">Город</label>
                                                <input
                                                    type="text"
                                                    value={newAddressCity}
                                                    onChange={(e) => setNewAddressCity(e.target.value)}
                                                    placeholder={restaurant?.city || 'Город'}
                                                    className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-100 outline-none transition"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-gray-600 mb-1.5">Адрес *</label>
                                                <AddressAutocomplete
                                                    value={newAddress.address}
                                                    onChange={(val) => setNewAddress(prev => ({ ...prev, address: val, latitude: null, longitude: null }))}
                                                    onSelect={(suggestion) => {
                                                        setNewAddress(prev => ({
                                                            ...prev,
                                                            address: suggestion.fullAddress || suggestion.title,
                                                            latitude: suggestion.latitude || null,
                                                            longitude: suggestion.longitude || null
                                                        }));
                                                    }}
                                                    placeholder="Улица, дом"
                                                    className="w-full px-3.5 py-3 border border-gray-300 rounded-xl text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-100 outline-none transition"
                                                    restaurant={restaurant}
                                                    cityOverride={newAddressCity}
                                                />
                                            </div>
                                            <div className="grid grid-cols-3 gap-2.5">
                                                <div>
                                                    <label className="block text-xs font-medium text-gray-600 mb-1">Подъезд</label>
                                                    <input
                                                        type="text"
                                                        placeholder="—"
                                                        value={newAddress.entrance}
                                                        onChange={(e) => setNewAddress({ ...newAddress, entrance: e.target.value })}
                                                        className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm text-center focus:border-primary-500 focus:ring-2 focus:ring-primary-100 outline-none transition"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-medium text-gray-600 mb-1">Этаж</label>
                                                    <input
                                                        type="text"
                                                        placeholder="—"
                                                        value={newAddress.floor}
                                                        onChange={(e) => setNewAddress({ ...newAddress, floor: e.target.value })}
                                                        className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm text-center focus:border-primary-500 focus:ring-2 focus:ring-primary-100 outline-none transition"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-medium text-gray-600 mb-1">Кв/офис</label>
                                                    <input
                                                        type="text"
                                                        placeholder="—"
                                                        value={newAddress.apartment}
                                                        onChange={(e) => setNewAddress({ ...newAddress, apartment: e.target.value })}
                                                        className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm text-center focus:border-primary-500 focus:ring-2 focus:ring-primary-100 outline-none transition"
                                                    />
                                                </div>
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-gray-600 mb-1">Комментарий для курьера</label>
                                                <input
                                                    type="text"
                                                    placeholder="Домофон, ориентир..."
                                                    value={newAddress.comment}
                                                    onChange={(e) => setNewAddress({ ...newAddress, comment: e.target.value })}
                                                    className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-100 outline-none transition"
                                                />
                                            </div>
                                            <div className="flex gap-2.5 pt-1">
                                                <button onClick={handleAddAddress} className="btn-primary flex-1 text-sm py-2.5 rounded-xl">
                                                    Сохранить
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        setShowNewAddressForm(false);
                                                        setNewAddress({ address: '', entrance: '', floor: '', apartment: '', comment: '' });
                                                    }}
                                                    className="btn-secondary flex-1 text-sm py-2.5 rounded-xl"
                                                >
                                                    Отмена
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    <div className="space-y-2">
                                        {addressesLoading ? (
                                            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-center">
                                                <p className="text-gray-600 text-sm">Загрузка адресов...</p>
                                            </div>
                                        ) : addresses.length === 0 ? (
                                            <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-4 text-center">
                                                <p className="text-gray-600 text-sm">Нет сохранённых адресов</p>
                                                <p className="text-xs text-gray-500 mt-1">Нажмите «Добавить», чтобы сохранить первый адрес доставки</p>
                                            </div>
                                        ) : (
                                            addresses.map((addr) => (
                                                <div
                                                    key={addr.id}
                                                    className={`relative rounded-xl border transition-all ${selectedAddressId === addr.id ? 'border-primary-500 bg-primary-50 shadow-sm' : 'border-gray-200 bg-white'}`}
                                                >
                                                    <button onClick={() => setSelectedAddressId(addr.id)} className="w-full text-left p-3 pr-10">
                                                        <div className="flex items-start gap-3">
                                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${selectedAddressId === addr.id ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-500'}`}>
                                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a2 2 0 01-2.828 0l-4.243-4.243a8 8 0 1111.314 0z" />
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                                                </svg>
                                                            </div>
                                                            <div className="min-w-0 flex-1">
                                                                <div className="flex items-center gap-2 flex-wrap">
                                                                    <p className="font-medium text-sm text-gray-900 break-words">{addr.address}</p>
                                                                    {selectedAddressId === addr.id && (
                                                                        <span className="text-[11px] font-semibold text-primary-700 bg-primary-100 px-2 py-0.5 rounded-full">Выбран</span>
                                                                    )}
                                                                    {addr.isDefault && (
                                                                        <span className="text-[11px] font-semibold text-primary-700 bg-primary-100 px-2 py-0.5 rounded-full">По умолчанию</span>
                                                                    )}
                                                                </div>
                                                                {(addr.entrance || addr.floor || addr.apartment) && (
                                                                    <div className="text-xs text-gray-600 mt-1">
                                                                        {[addr.entrance && `подъезд ${addr.entrance}`, addr.floor && `этаж ${addr.floor}`, addr.apartment && `кв. ${addr.apartment}`]
                                                                            .filter(Boolean)
                                                                            .join(' · ')}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </button>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleDeleteAddress(addr.id);
                                                        }}
                                                        className="absolute top-3 right-3 w-7 h-7 rounded-full bg-red-50 text-red-500 active:text-red-700 flex items-center justify-center"
                                                        title="Удалить адрес"
                                                    >
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                        </svg>
                                                    </button>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            )}

                            {!isDineIn && (
                                <div className="bg-white rounded-lg shadow-sm p-4">
                                    <h2 className="font-semibold text-base mb-3">Способ оплаты</h2>
                                    <select
                                        value={paymentMethod}
                                        onChange={(e) => setPaymentMethod(e.target.value)}
                                        className="input-field w-full text-sm"
                                    >
                                        <option value="cash">Наличными</option>
                                        <option value="card">Картой курьеру</option>
                                    </select>
                                </div>
                            )}

                            {customer?.id && (
                                <div className="bg-white rounded-lg shadow-sm p-4">
                                    <h2 className="font-semibold text-base mb-3">Списание бонусов</h2>
                                    {bonusLoading ? (
                                        <p className="text-sm text-gray-500">Загрузка бонусного баланса...</p>
                                    ) : (
                                        <div className="space-y-3">
                                            <p className="text-sm text-gray-600">Доступно: <span className="font-semibold text-gray-900">{bonusBalance}</span></p>
                                            <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                                                <input
                                                    type="checkbox"
                                                    checked={useBonuses}
                                                    onChange={(e) => {
                                                        const enabled = e.target.checked;
                                                        setUseBonuses(enabled);
                                                        if (enabled) {
                                                            setBonusRequested(String(Math.min(bonusBalance, maxBonusApplicable)));
                                                        }
                                                    }}
                                                    disabled={bonusBalance <= 0}
                                                />
                                                Использовать бонусы в этом заказе
                                            </label>
                                            {useBonuses && (
                                                <div>
                                                    <label className="block text-xs font-medium text-gray-600 mb-1.5">Сколько списать</label>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        max={Math.min(bonusBalance, maxBonusApplicable)}
                                                        step="1"
                                                        value={bonusRequested}
                                                        onChange={(e) => setBonusRequested(e.target.value)}
                                                        className="input-field w-full text-sm"
                                                    />
                                                    <p className="mt-1 text-xs text-gray-500">Будет применено: {appliedBonus}</p>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}

                            <div className="bg-white rounded-lg shadow-sm p-4">
                                <h2 className="font-semibold text-base mb-1.5">Комментарий (необязательно)</h2>
                                {!isDineIn && deliveryType === 'delivery' && !customer?.id && (
                                    <p className="text-xs text-gray-500 mb-3">
                                        Для подъезда, этажа и квартиры используйте блок «Адрес доставки».
                                    </p>
                                )}
                                <textarea
                                    placeholder="Пожелания по заказу (например, не звонить в дверь)"
                                    value={comment}
                                    onChange={(e) => setComment(e.target.value)}
                                    className="input-field w-full text-sm"
                                    rows={3}
                                />
                            </div>

                            {/* На втором шаге оставляем только параметры доставки и оплаты для минимализма */}
                        </div>
                    )}
                </div>
            </div>

            {checkoutStep === 1 ? (
                <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-gray-200 shadow-lg z-50">
                    <div className="max-w-[480px] mx-auto p-3 space-y-2" style={{ paddingBottom: 'calc(8px + env(safe-area-inset-bottom, 0px))' }}>
                        <button onClick={() => setCheckoutStep(2)} className="btn-primary w-full py-3 text-base shadow-lg">
                            Далее
                        </button>
                    </div>
                </div>
            ) : (
                <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-gray-200 shadow-lg z-50">
                    <div className="max-w-[480px] mx-auto p-3 space-y-2" style={{ paddingBottom: 'calc(8px + env(safe-area-inset-bottom, 0px))' }}>
                        <button
                            onClick={handlePlaceOrder}
                            disabled={isPlaceOrderDisabled}
                            className="btn-primary w-full py-3 text-base disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                        >
                            {loading ? 'Оформление...' : isDineIn
                                ? `Заказать на ${finalTotal} ${currency}`
                                : `Оформить на ${finalTotal} ${currency}`
                            }
                        </button>
                        {isPlaceOrderDisabled && (
                            <p className="text-xs text-gray-500 text-center">{placeOrderDisabledReason}</p>
                        )}
                    </div>
                </div>
            )}

            <CustomerLoginModal
                isOpen={showLoginModal}
                onClose={() => setShowLoginModal(false)}
                onLoginSuccess={() => {
                    setShowLoginModal(false);
                    toast.success('Вы успешно вошли!');
                    loadAddresses();
                }}
                restaurantId={restaurant?.id}
            />
        </div>
    );
};

export default CheckoutPage;
