import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useCustomerAuthStore } from '../store/customerAuthStore';
import { useCartStore } from '../store/cartStore';
import { useTheme } from '../theme/ThemeProvider';
import CustomerLoginModal from '../components/CustomerLoginModal';
import api from '../services/api';

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

const CheckoutPage = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { customer } = useCustomerAuthStore();
    const { items: cartItems, getTotal, updateQuantity, removeItem, clearCart, orderMode, tableNumber } = useCartStore();
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
    const [selectedAddressId, setSelectedAddressId] = useState(null);
    const [deliveryType, setDeliveryType] = useState(isDineIn ? 'dine_in' : (restaurant?.deliveryEnabled ? 'delivery' : 'pickup'));
    const [paymentMethod, setPaymentMethod] = useState('cash');
    const [comment, setComment] = useState('');
    const [showNewAddressForm, setShowNewAddressForm] = useState(false);
    const [newAddress, setNewAddress] = useState({ address: '', entrance: '', floor: '', apartment: '', comment: '' });
    const [checkoutStep, setCheckoutStep] = useState(1);

    useEffect(() => {
        if (!restaurant || !cartItems || cartItems.length === 0) {
            navigate(-1);
            return;
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [restaurant, cartItems?.length]);

    // Загружаем адреса только когда выбран тип "доставка"
    useEffect(() => {
        if (customer?.id && deliveryType === 'delivery') {
            loadAddresses();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [customer?.id, deliveryType]);

    const loadAddresses = async () => {
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
        }
    };

    const handleAddAddress = async () => {
        if (!newAddress.address.trim()) {
            toast.error('Укажите адрес');
            return;
        }

        try {
            await api.post('/customers/addresses', newAddress);
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

        // Для dine_in авторизация не обязательна
        if (!isDineIn && !customer?.id) {
            setShowLoginModal(true);
            return;
        }

        if (deliveryType === 'delivery' && !selectedAddressId) {
            toast.error('Выберите адрес доставки');
            return;
        }

        setLoading(true);
        try {
            const payload = {
                restaurantId: restaurant?.id,
                items: cartItems.map(item => ({
                    id: item.dish?.id,
                    quantity: item.quantity,
                    price: item.totalPrice,
                    selectedModifiers: item.modifiers?.map(m => ({ id: m.id, name: m.name, price: m.price })) || []
                })),
                total: Number(finalTotal),
                deliveryType: isDineIn ? 'dine_in' : deliveryType,
                tableNumber: isDineIn ? tableNumber : null,
                customerAddressId: deliveryType === 'delivery' ? selectedAddressId : null,
                paymentMethod,
                comment
            };

            // Для dine_in без авторизации — отправляем на общий endpoint
            const endpoint = customer?.id ? '/customers/orders' : '/orders';
            const response = await api.post(endpoint, payload);
            clearCart();
            toast.success(isDineIn ? 'Заказ отправлен на кухню!' : 'Заказ оформлен');
            const orderId = response?.data?.order?.id || response?.data?.id;
            if (customer?.id && orderId) {
                navigate(`/customer/orders/${orderId}`);
            } else {
                navigate(-1);
            }
        } catch (error) {
            console.error('Failed to place order', error);
            toast.error('Не удалось оформить заказ');
        } finally {
            setLoading(false);
        }
    };

    const total = Number(getTotal() || 0);
    const deliveryFee = deliveryType === 'delivery' ? Number(restaurant?.deliveryFee || 0) : 0;
    const finalTotal = (total + deliveryFee).toFixed(2);

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
                            <div className="text-sm font-semibold text-gray-900 whitespace-nowrap">{(item.totalPrice * item.quantity).toFixed(2)} {currency}</div>
                        </div>
                    </div>
                ))}
            </div>

            <div className="pt-3 space-y-1.5 text-sm">
                <div className="flex justify-between text-gray-600">
                    <span>Сумма заказа</span>
                    <span>{total.toFixed(2)} {currency}</span>
                </div>
                {deliveryFee > 0 && (
                    <div className="flex justify-between text-gray-600">
                        <span>Доставка</span>
                        <span>{deliveryFee.toFixed(2)} {currency}</span>
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
        <div className="min-h-screen bg-gray-50 pb-32">
            <div className="max-w-[480px] mx-auto px-4 pt-4 pb-24 space-y-4">
                <div className="flex items-center gap-3">
                    <button onClick={() => navigate(-1)} className="text-primary-600 text-sm">← Назад</button>
                    <h1 className="text-xl font-bold">Оформление заказа</h1>
                </div>

                <div className="bg-white rounded-lg shadow-sm p-4">
                    <div className="flex items-center justify-between text-sm text-gray-600 mb-3">
                        <span>Шаг {checkoutStep} из 2</span>
                        {checkoutStep === 2 && (
                            <button onClick={() => setCheckoutStep(1)} className="text-primary-600 font-semibold">
                                ← К блюдам
                            </button>
                        )}
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
                                    <div className="grid grid-cols-2 gap-3">
                                        <button
                                            disabled={!restaurant?.deliveryEnabled}
                                            onClick={() => restaurant?.deliveryEnabled && setDeliveryType('delivery')}
                                            className={`p-3 rounded-lg border-2 transition-all ${deliveryType === 'delivery' ? 'border-primary-600 bg-primary-50' : 'border-primary-200 active:border-primary-300'} ${!restaurant?.deliveryEnabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                                        >
                                            <div className="text-2xl mb-1">🚗</div>
                                            <div className="font-semibold text-sm">Доставка</div>
                                            {restaurant?.deliveryFee > 0 && (
                                                <div className="text-xs text-gray-500">{restaurant.deliveryFee} {currency}</div>
                                            )}
                                        </button>
                                        <button
                                            onClick={() => setDeliveryType('pickup')}
                                            className={`p-3 rounded-lg border-2 transition-all ${deliveryType === 'pickup' ? 'border-primary-600 bg-primary-50' : 'border-primary-200 active:border-primary-300'}`}
                                        >
                                            <div className="text-2xl mb-1">🏃</div>
                                            <div className="font-semibold text-sm">Самовывоз</div>
                                            <div className="text-xs text-gray-500">Бесплатно</div>
                                        </button>
                                    </div>
                                </div>
                            )}

                            {!isDineIn && deliveryType === 'delivery' && (
                                <div className="bg-white rounded-lg shadow-sm p-4">
                                    <div className="flex justify-between items-center mb-3">
                                        <h2 className="font-semibold text-base">Адрес доставки</h2>
                                        <button onClick={() => setShowNewAddressForm(!showNewAddressForm)} className="text-primary-600 text-xs font-medium">
                                            + Добавить
                                        </button>
                                    </div>

                                    {showNewAddressForm && (
                                        <div className="mb-3 p-3 bg-gray-50 rounded-lg space-y-2">
                                            <input
                                                type="text"
                                                placeholder="Улица, дом"
                                                value={newAddress.address}
                                                onChange={(e) => setNewAddress({ ...newAddress, address: e.target.value })}
                                                className="input-field w-full text-sm"
                                            />
                                            <div className="grid grid-cols-3 gap-2">
                                                <input
                                                    type="text"
                                                    placeholder="Подъезд"
                                                    value={newAddress.entrance}
                                                    onChange={(e) => setNewAddress({ ...newAddress, entrance: e.target.value })}
                                                    className="input-field text-sm"
                                                />
                                                <input
                                                    type="text"
                                                    placeholder="Этаж"
                                                    value={newAddress.floor}
                                                    onChange={(e) => setNewAddress({ ...newAddress, floor: e.target.value })}
                                                    className="input-field text-sm"
                                                />
                                                <input
                                                    type="text"
                                                    placeholder="Кв/офис"
                                                    value={newAddress.apartment}
                                                    onChange={(e) => setNewAddress({ ...newAddress, apartment: e.target.value })}
                                                    className="input-field text-sm"
                                                />
                                            </div>
                                            <input
                                                type="text"
                                                placeholder="Комментарий"
                                                value={newAddress.comment}
                                                onChange={(e) => setNewAddress({ ...newAddress, comment: e.target.value })}
                                                className="input-field w-full text-sm"
                                            />
                                            <div className="flex gap-2">
                                                <button onClick={handleAddAddress} className="btn-primary flex-1 text-sm py-2">
                                                    Сохранить
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        setShowNewAddressForm(false);
                                                        setNewAddress({ address: '', entrance: '', floor: '', apartment: '', comment: '' });
                                                    }}
                                                    className="btn-secondary flex-1 text-sm py-2"
                                                >
                                                    Отмена
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    <div className="space-y-2">
                                        {addresses.length === 0 ? (
                                            <p className="text-gray-500 text-center py-3 text-sm">Нет сохраненных адресов. Добавьте новый адрес.</p>
                                        ) : (
                                            addresses.map((addr) => (
                                                <div
                                                    key={addr.id}
                                                    className={`relative p-3 rounded-lg border-2 transition-all ${selectedAddressId === addr.id ? 'border-primary-600 bg-primary-50' : 'border-primary-200'}`}
                                                >
                                                    <button onClick={() => setSelectedAddressId(addr.id)} className="w-full text-left pr-8">
                                                        <div className="font-medium text-sm">{addr.address}</div>
                                                        {(addr.entrance || addr.floor || addr.apartment) && (
                                                            <div className="text-xs text-gray-600">
                                                                {[addr.entrance && `подъезд ${addr.entrance}`, addr.floor && `этаж ${addr.floor}`, addr.apartment && `кв. ${addr.apartment}`]
                                                                    .filter(Boolean)
                                                                    .join(', ')}
                                                            </div>
                                                        )}
                                                        {addr.isDefault && (
                                                            <span className="inline-block mt-1 text-xs bg-primary-100 text-primary-700 px-2 py-0.5 rounded">По умолчанию</span>
                                                        )}
                                                    </button>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleDeleteAddress(addr.id);
                                                        }}
                                                        className="absolute top-3 right-3 text-red-500 active:text-red-700"
                                                    >
                                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

                            <div className="bg-white rounded-lg shadow-sm p-4">
                                <h2 className="font-semibold text-base mb-3">Комментарий к заказу</h2>
                                <textarea
                                    placeholder="Особые пожелания, уточнения..."
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
                <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-50">
                    <div className="max-w-[480px] mx-auto p-3 space-y-2">
                        <button onClick={() => setCheckoutStep(2)} className="btn-primary w-full py-3 text-base shadow-lg">
                            Далее
                        </button>
                    </div>
                </div>
            ) : (
                <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-50">
                    <div className="max-w-[480px] mx-auto p-3 space-y-2">
                        <button
                            onClick={handlePlaceOrder}
                            disabled={loading || (!isDineIn && deliveryType === 'delivery' && !selectedAddressId)}
                            className="btn-primary w-full py-3 text-base disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                        >
                            {loading ? 'Оформление...' : isDineIn
                                ? `Заказать на ${finalTotal} ${currency}`
                                : `Оформить на ${finalTotal} ${currency}`
                            }
                        </button>
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
