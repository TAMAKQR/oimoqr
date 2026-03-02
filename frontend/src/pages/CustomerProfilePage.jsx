import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import customerService from '../services/customerService';
import CustomerBottomNav from '../components/CustomerBottomNav';
import DishModal from '../components/DishModal';
import FloatingMenuWidget from '../components/FloatingMenuWidget';
import { useCartStore } from '../store/cartStore';

const currencySymbols = {
    RUB: '₽',
    KZT: '₸',
    USD: '$',
    EUR: '€',
    GBP: '£',
    UAH: '₴',
    TRY: '₺',
    AMD: '֏',
    GEL: '₾',
    UZS: "so'm",
    KGS: 'с',
    VND: '₫'
};

const getCurrencySymbol = (currencyCode) => currencySymbols[currencyCode] || '₽';

const getLastRestaurantPath = () => {
    try {
        const raw = localStorage.getItem('customer-last-restaurant');
        if (raw) {
            const data = JSON.parse(raw);
            if (data?.subdomain) {
                return `/${data.subdomain}`;
            }
        }
    } catch (e) {
        // ignore JSON errors and fall back
    }
    return '/';
};

const setLastRestaurantFromDish = (dish) => {
    try {
        const subdomain = dish?.restaurant?.subdomain;
        if (!subdomain) return;
        const payload = {
            id: dish?.restaurant?.id,
            subdomain,
            name: dish?.restaurant?.name,
            logo: dish?.restaurant?.logo,
        };
        localStorage.setItem('customer-last-restaurant', JSON.stringify(payload));
    } catch (e) {
        // ignore
    }
};

export default function CustomerProfilePage() {
    const navigate = useNavigate();
    const location = useLocation();
    const addItem = useCartStore((state) => state.addItem);
    const cartItemCount = useCartStore((state) => state.getItemCount());
    const [activeTab, setActiveTab] = useState('profile');
    const [customer, setCustomer] = useState(null);
    const [orders, setOrders] = useState([]);
    const [favorites, setFavorites] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [loadError, setLoadError] = useState('');
    const [selectedDish, setSelectedDish] = useState(null);
    const [dishCurrency, setDishCurrency] = useState('₽');
    const [isDishModalOpen, setDishModalOpen] = useState(false);
    const [favoriteToggling, setFavoriteToggling] = useState(false);

    useEffect(() => {
        if (location.pathname.startsWith('/customer/orders')) {
            setActiveTab('orders');
        } else if (location.pathname === '/customer/favorites') {
            setActiveTab('favorites');
        } else {
            setActiveTab('profile');
        }
    }, [location.pathname]);

    const loadData = useCallback(async ({ isRefresh = false } = {}) => {
        if (isRefresh) {
            setRefreshing(true);
        }
        setLoadError('');
        try {
            const [profileData, ordersData, favoritesData] = await Promise.all([
                customerService.getProfile(),
                customerService.getOrderHistory(),
                customerService.getFavorites()
            ]);
            setCustomer(profileData);
            setOrders(ordersData.orders || []);
            setFavorites(favoritesData || []);
        } catch (error) {
            console.error('Error loading data:', error);
            if (error.response?.status === 401) {
                customerService.logout();
                navigate('/customer/login');
                return;
            }
            setLoadError('Не удалось загрузить данные профиля. Проверьте подключение и попробуйте снова.');
            toast.error('Не удалось загрузить данные профиля');
        } finally {
            setLoading(false);
            if (isRefresh) {
                setRefreshing(false);
            }
        }
    }, [navigate]);

    useEffect(() => {
        if (!customerService.isAuthenticated()) {
            navigate('/customer/login');
            return;
        }
        loadData();
    }, [navigate, loadData]);

    const handleLogout = () => {
        customerService.logout();
        const target = getLastRestaurantPath();
        navigate(target, { replace: true });
    };

    const handleRemoveFavorite = async (dishId) => {
        try {
            await customerService.removeFromFavorites(dishId);
            setFavorites(favorites.filter(f => f.dishId !== dishId));
        } catch (error) {
            console.error('Error removing favorite:', error);
        }
    };

    const openDishModal = (dish, imageUrl) => {
        const img = imageUrl || dish.image || dish.imageUrl;
        const isFav = favorites.some(f => f.dishId === dish.id);
        setSelectedDish({ ...dish, image: img, isFavorite: isFav });
        setDishCurrency(getCurrencySymbol(dish.restaurant?.currency || 'RUB'));
        setDishModalOpen(true);
    };

    const handleQuickAdd = (dish, imageUrl) => {
        const price = parseFloat(dish.price) || 0;
        const hasModifiers = Array.isArray(dish.modifiers) && dish.modifiers.length > 0;

        if (hasModifiers || price === 0) {
            openDishModal(dish, imageUrl);
            return;
        }

        addItem({ ...dish, image: imageUrl || dish.image || dish.imageUrl }, []);
        setLastRestaurantFromDish(dish);

        const target = dish?.restaurant?.subdomain ? `/${dish.restaurant.subdomain}` : getLastRestaurantPath();
        toast((t) => (
            <div className="flex items-center gap-3">
                <span>Добавлено в корзину</span>
                <button
                    className="rounded-lg bg-primary-600 px-3 py-1.5 text-sm font-semibold text-white"
                    onClick={() => {
                        toast.dismiss(t.id);
                        navigate(target);
                    }}
                >
                    К корзине
                </button>
            </div>
        ));
    };

    const handleToggleFavoriteInModal = async () => {
        if (!selectedDish || favoriteToggling) return;

        setFavoriteToggling(true);
        const currentlyFavorite = favorites.some(f => f.dishId === selectedDish.id);

        try {
            if (currentlyFavorite) {
                await customerService.removeFromFavorites(selectedDish.id);
                setFavorites((prev) => prev.filter((f) => f.dishId !== selectedDish.id));
                setSelectedDish((prev) => (prev ? { ...prev, isFavorite: false } : prev));
                toast.success('Удалено из избранного');
            } else {
                await customerService.addToFavorites(selectedDish.id);
                setFavorites((prev) => [...prev, { id: Date.now(), dishId: selectedDish.id, dish: selectedDish }]);
                setSelectedDish((prev) => (prev ? { ...prev, isFavorite: true } : prev));
                toast.success('Добавлено в избранное');
            }
        } catch (error) {
            console.error('Error toggling favorite:', error);
            toast.error('Не удалось обновить избранное');
        } finally {
            setFavoriteToggling(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
                    <p className="mt-4 text-gray-600">Загрузка...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-100 flex justify-center">
            <div className="w-full max-w-[480px] min-h-screen bg-gray-50 shadow-2xl relative pb-20">
                {/* Quick access to cart from profile/favorites */}
                {cartItemCount > 0 && (
                    <button
                        type="button"
                        onClick={() => navigate(getLastRestaurantPath())}
                        className="fixed left-1/2 -translate-x-1/2 z-[70] rounded-2xl bg-primary-600 text-white shadow-lg px-4 py-3 font-semibold"
                        style={{ bottom: 'calc(var(--customer-bottom-nav-height, 0px) + 12px)' }}
                    >
                        Корзина · {cartItemCount}
                    </button>
                )}

                {/* Header */}
                <div className="bg-white shadow">
                    <div className="px-3">
                        <div className="flex justify-between items-center py-4">
                            <div className="flex items-center space-x-3">
                                <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                                    <span className="text-lg font-bold text-green-600">
                                        {customer?.name?.charAt(0) || customer?.phone?.charAt(0) || '?'}
                                    </span>
                                </div>
                                <div>
                                    <h1 className="text-lg font-bold text-gray-900">
                                        {customer?.name || 'Клиент'}
                                    </h1>
                                    <p className="text-xs text-gray-500">{customer?.phone}</p>
                                </div>
                            </div>
                            <button
                                onClick={handleLogout}
                                className="px-3 py-1.5 text-xs font-medium text-red-600 active:bg-red-50 rounded-lg transition"
                            >
                                Выйти
                            </button>
                        </div>
                        <div className="pb-3 flex justify-end">
                            <button
                                type="button"
                                onClick={() => loadData({ isRefresh: true })}
                                disabled={refreshing}
                                className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 text-gray-700 bg-white disabled:opacity-50"
                            >
                                {refreshing ? 'Обновляем…' : 'Обновить'}
                            </button>
                        </div>
                    </div>
                </div>

                {loadError && (
                    <div className="px-3 mt-4">
                        <div className="bg-red-50 border border-red-100 rounded-xl p-3">
                            <p className="text-sm text-red-700">{loadError}</p>
                            <button
                                type="button"
                                onClick={() => loadData()}
                                className="mt-2 text-xs font-medium text-red-700 underline"
                            >
                                Повторить загрузку
                            </button>
                        </div>
                    </div>
                )}

                {/* Tab Content */}
                <div className="px-3 mt-4 pb-20">
                    {activeTab === 'profile' && (
                        <ProfileTab customer={customer} onUpdate={loadData} />
                    )}
                    {activeTab === 'orders' && (
                        <OrdersTab orders={orders} />
                    )}
                    {activeTab === 'favorites' && (
                        <FavoritesTab
                            favorites={favorites}
                            onRemove={handleRemoveFavorite}
                            onViewDish={openDishModal}
                            onAddToCart={handleQuickAdd}
                        />
                    )}
                </div>

                {/* Bottom Navigation */}
                <FloatingMenuWidget />
                <CustomerBottomNav />
            </div>

            {selectedDish && (
                <DishModal
                    dish={selectedDish}
                    isOpen={isDishModalOpen}
                    onClose={() => setDishModalOpen(false)}
                    currency={dishCurrency}
                    isFavorite={selectedDish?.isFavorite ?? favorites.some(f => f.dishId === selectedDish?.id)}
                    onToggleFavorite={handleToggleFavoriteInModal}
                    favoriteLoading={favoriteToggling}
                />
            )}
        </div>
    );
}

// Profile Tab Component
function ProfileTab({ customer, onUpdate }) {
    const [editing, setEditing] = useState(false);
    const [name, setName] = useState(customer?.name || '');
    const [email, setEmail] = useState(customer?.email || '');
    const [saving, setSaving] = useState(false);
    const [showNewAddress, setShowNewAddress] = useState(false);
    const [addingAddress, setAddingAddress] = useState(false);
    const [newAddress, setNewAddress] = useState({
        address: '',
        entrance: '',
        floor: '',
        apartment: '',
        comment: '',
        label: '',
        isDefault: false,
    });

    const handleSave = async () => {
        setSaving(true);
        try {
            await customerService.updateProfile({ name, email });
            setEditing(false);
            onUpdate();
        } catch (error) {
            console.error('Error updating profile:', error);
            toast.error('Ошибка обновления профиля');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div>
            <div className="bg-white shadow rounded-lg p-4">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-base font-semibold text-gray-900">Личная информация</h2>
                    {!editing && (
                        <button
                            onClick={() => setEditing(true)}
                            className="text-xs text-green-600 active:text-green-700"
                        >
                            Редактировать
                        </button>
                    )}
                </div>

                <div className="space-y-3">
                    <div>
                        <label className="block text-xs font-medium text-gray-700 mb-0.5">Телефон</label>
                        <input
                            type="text"
                            value={customer?.phone || ''}
                            disabled
                            className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg bg-gray-50 text-sm"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-gray-700 mb-0.5">Имя</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            disabled={!editing}
                            className={`w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm ${!editing ? 'bg-gray-50' : ''}`}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            disabled={!editing}
                            className={`w-full px-3 py-2 border border-gray-300 rounded-lg ${!editing ? 'bg-gray-50' : ''}`}
                        />
                    </div>

                    {editing && (
                        <div className="flex space-x-3 pt-4">
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:bg-gray-300"
                            >
                                {saving ? 'Сохранение...' : 'Сохранить'}
                            </button>
                            <button
                                onClick={() => {
                                    setEditing(false);
                                    setName(customer?.name || '');
                                    setEmail(customer?.email || '');
                                }}
                                className="flex-1 bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200"
                            >
                                Отмена
                            </button>
                        </div>
                    )}
                </div>

                {/* Addresses */}
                <div className="mt-8 pt-8 border-t border-gray-200">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-md font-semibold text-gray-900">Сохраненные адреса</h3>
                        <button
                            onClick={() => setShowNewAddress(!showNewAddress)}
                            className="text-sm text-green-600 active:text-green-700"
                        >
                            {showNewAddress ? 'Закрыть' : '+ Добавить'}
                        </button>
                    </div>

                    {showNewAddress && (
                        <div className="mb-4 p-3 bg-gray-50 rounded-lg space-y-3 border border-gray-200">
                            <div className="space-y-2">
                                <input
                                    type="text"
                                    placeholder="Улица, дом *"
                                    value={newAddress.address}
                                    onChange={(e) => setNewAddress({ ...newAddress, address: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                />
                                <div className="grid grid-cols-3 gap-2">
                                    <input
                                        type="text"
                                        placeholder="Подъезд"
                                        value={newAddress.entrance}
                                        onChange={(e) => setNewAddress({ ...newAddress, entrance: e.target.value })}
                                        className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                    />
                                    <input
                                        type="text"
                                        placeholder="Этаж"
                                        value={newAddress.floor}
                                        onChange={(e) => setNewAddress({ ...newAddress, floor: e.target.value })}
                                        className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                    />
                                    <input
                                        type="text"
                                        placeholder="Квартира"
                                        value={newAddress.apartment}
                                        onChange={(e) => setNewAddress({ ...newAddress, apartment: e.target.value })}
                                        className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                    />
                                </div>
                                <input
                                    type="text"
                                    placeholder="Метка (Дом, Работа...)"
                                    value={newAddress.label}
                                    onChange={(e) => setNewAddress({ ...newAddress, label: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                />
                                <textarea
                                    placeholder="Комментарий для курьера"
                                    value={newAddress.comment}
                                    onChange={(e) => setNewAddress({ ...newAddress, comment: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                    rows={2}
                                />
                                <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                                    <input
                                        type="checkbox"
                                        checked={newAddress.isDefault}
                                        onChange={(e) => setNewAddress({ ...newAddress, isDefault: e.target.checked })}
                                        className="h-4 w-4 text-green-600 border-gray-300 rounded"
                                    />
                                    Сделать основным
                                </label>
                            </div>
                            <button
                                onClick={async () => {
                                    if (!newAddress.address.trim()) {
                                        toast.error('Введите адрес');
                                        return;
                                    }
                                    setAddingAddress(true);
                                    try {
                                        await customerService.addAddress(newAddress);
                                        toast.success('Адрес добавлен');
                                        setNewAddress({ address: '', entrance: '', floor: '', apartment: '', comment: '', label: '', isDefault: false });
                                        setShowNewAddress(false);
                                        onUpdate();
                                    } catch (error) {
                                        console.error('Error adding address:', error);
                                        toast.error('Ошибка при добавлении адреса');
                                    } finally {
                                        setAddingAddress(false);
                                    }
                                }}
                                disabled={addingAddress}
                                className="w-full bg-green-600 text-white py-2 rounded-lg text-sm font-medium active:bg-green-700 disabled:bg-gray-300"
                            >
                                {addingAddress ? 'Сохранение...' : 'Сохранить адрес'}
                            </button>
                        </div>
                    )}

                    {customer?.savedAddresses?.length > 0 ? (
                        <div className="space-y-3">
                            {customer.savedAddresses.map((addr) => (
                                <div key={addr.id} className="p-3 bg-gray-50 rounded-lg">
                                    {addr.label && (
                                        <span className="text-xs font-semibold text-green-600 uppercase">{addr.label}</span>
                                    )}
                                    <p className="text-sm text-gray-900 mt-1">{addr.address}</p>
                                    {addr.isDefault && (
                                        <span className="text-xs text-gray-500 mt-1 inline-block">По умолчанию</span>
                                    )}
                                    {(addr.entrance || addr.floor || addr.apartment) && (
                                        <p className="text-xs text-gray-600 mt-1">
                                            {[
                                                addr.entrance && `подъезд ${addr.entrance}`,
                                                addr.floor && `этаж ${addr.floor}`,
                                                addr.apartment && `кв. ${addr.apartment}`
                                            ].filter(Boolean).join(', ')}
                                        </p>
                                    )}
                                    {addr.comment && (
                                        <p className="text-xs text-gray-500 mt-1">{addr.comment}</p>
                                    )}
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-sm text-gray-500">Нет сохраненных адресов</p>
                    )}
                </div>
            </div>
        </div>
    );
}

// Orders Tab Component
function OrdersTab({ orders }) {
    const parseModifiers = (mods) => {
        if (!mods) return [];
        if (Array.isArray(mods)) return mods;
        if (typeof mods === 'string') {
            try {
                const parsed = JSON.parse(mods);
                return Array.isArray(parsed) ? parsed : [];
            } catch (e) {
                return [];
            }
        }
        return [];
    };

    const formatAddress = (order) => {
        if (order.customerAddress) {
            const { address, entrance, floor, apartment, comment, label } = order.customerAddress;
            const main = address;
            const parts = [
                entrance && `подъезд ${entrance}`,
                floor && `${floor} этаж`,
                apartment && `кв. ${apartment}`
            ].filter(Boolean).join(', ');
            const labelText = label ? `${label}: ` : '';
            const commentText = comment ? ` (${comment})` : '';
            return `${labelText}${main}${parts ? ' | ' + parts : ''}${commentText}`;
        }
        if (order.deliveryType === 'dine_in') return order.tableNumber ? `Стол ${order.tableNumber}` : 'В зале';
        return order.deliveryAddress || (order.deliveryType === 'pickup' ? 'Самовывоз' : '—');
    };

    const formatDateTime = (value) => {
        if (!value) return 'Дата неизвестна';
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? 'Дата неизвестна' : date.toLocaleString('ru-RU');
    };

    const formatMoney = (value) => {
        const amount = Number(value);
        return Number.isFinite(amount) ? amount.toFixed(2) : '0.00';
    };

    if (orders.length === 0) {
        return (
            <div className="text-center py-12">
                <div className="text-6xl mb-4">🛍️</div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">У вас пока нет заказов</h3>
                <p className="text-gray-500">Оформите первый заказ в меню ресторана</p>
            </div>
        );
    }

    const statusColors = {
        new: 'bg-blue-100 text-blue-800',
        confirmed: 'bg-yellow-100 text-yellow-800',
        preparing: 'bg-purple-100 text-purple-800',
        ready: 'bg-green-100 text-green-800',
        delivered: 'bg-green-100 text-green-800',
        cancelled: 'bg-red-100 text-red-800'
    };

    const statusLabels = {
        new: 'Новый',
        confirmed: 'Подтвержден',
        preparing: 'Готовится',
        ready: 'Готов',
        delivered: 'Доставлен',
        cancelled: 'Отменен'
    };

    return (
        <div className="space-y-4">
            {orders.map((order) => (
                <div key={order.id} className="bg-white shadow rounded-lg p-6">
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <h3 className="text-lg font-semibold text-gray-900">
                                Заказ #{String(order.orderNumber || '').replace(/^#+/, '')}
                            </h3>
                            <p className="text-sm text-gray-500">
                                {formatDateTime(order.createdAt)}
                            </p>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusColors[order.status] || 'bg-gray-100 text-gray-800'}`}>
                            {statusLabels[order.status] || order.status}
                        </span>
                    </div>

                    <div className="space-y-3 mb-4">
                        {order.items?.map((item, idx) => {
                            const modifiers = parseModifiers(item.selectedModifiers);
                            const name = item.dish?.name || item.product?.name || item.dishName || item.productName || 'Блюдо';
                            const currency = order.restaurant?.currency || 'RUB';
                            const quantity = Number(item.quantity) || 0;
                            return (
                                <div key={idx} className="flex justify-between text-sm items-start">
                                    <div>
                                        <span className="text-gray-800 font-medium">{name}</span>
                                        {modifiers.length > 0 && (
                                            <p className="text-xs text-gray-500 mt-0.5">{modifiers.map(m => m.name).join(', ')}</p>
                                        )}
                                    </div>
                                    <div className="text-right text-gray-600">
                                        <span>{quantity} × {formatMoney(item.price)} {getCurrencySymbol(currency)}</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    <div className="pt-4 border-t border-gray-200 space-y-1">
                        <div className="flex justify-between items-center">
                            <span className="text-sm text-gray-600">{order.restaurant?.name}</span>
                            <span className="text-lg font-semibold text-gray-900">{formatMoney(order.totalAmount)} {getCurrencySymbol(order.restaurant?.currency || 'RUB')}</span>
                        </div>
                        <div className="text-xs text-gray-600">Способ: {order.deliveryType === 'dine_in' ? '🍽️ В зале' : order.deliveryType === 'pickup' ? '🏃 Самовывоз' : '🚗 Доставка'}{order.deliveryType !== 'dine_in' ? ` · Оплата: ${order.paymentMethod === 'card' ? 'Картой' : 'Наличные'}` : ''}</div>
                        <div className="text-xs text-gray-700">Адрес: {formatAddress(order)}</div>
                        <div className="text-sm font-semibold text-gray-900 mt-1">Итого: {formatMoney(order.totalAmount)} {getCurrencySymbol(order.restaurant?.currency || 'RUB')}</div>
                    </div>
                </div>
            ))}
        </div>
    );
}

// Favorites Tab Component
function FavoritesTab({ favorites, onRemove, onViewDish, onAddToCart }) {
    const [removingId, setRemovingId] = useState(null);
    const [addingId, setAddingId] = useState(null);

    const getImageUrl = (path) => {
        if (!path) return null;
        if (path.startsWith('http')) return path;

        // Derive backend file host
        let apiBase = import.meta.env.VITE_API_URL;

        if (!apiBase && typeof window !== 'undefined') {
            const { protocol, hostname } = window.location;
            if (hostname === 'localhost' || hostname === '127.0.0.1') {
                apiBase = `${protocol}//${hostname}:5001`;
            } else {
                apiBase = window.location.origin;
            }
        }

        // Drop trailing /api if present to get file host
        const fileHost = apiBase?.replace(/\/?api\/?$/, '') || '';

        // Ensure /uploads prefix exists
        // Remove leading slashes when appending to /uploads
        const cleanedPath = path.replace(/^\/+/g, '');
        const withUploads = path.includes('/uploads/') ? path : `/uploads/${cleanedPath}`;
        const normalized = withUploads.startsWith('/') ? withUploads : `/${withUploads}`;
        return `${fileHost}${normalized}`;
    };

    const FavoriteImage = ({ imageUrl, alt }) => {
        const [errored, setErrored] = useState(false);

        if (!imageUrl || errored) {
            return (
                <div className="w-full h-28 sm:h-32 bg-gradient-to-br from-primary-50 via-white to-gray-100 flex flex-col items-center justify-center text-center px-3">
                    <div className="w-12 h-12 rounded-2xl bg-white/80 border border-primary-100 shadow-sm flex items-center justify-center text-primary-600 text-xl">
                        🍽️
                    </div>
                    <div className="mt-3 text-[11px] text-gray-500 leading-snug flex flex-col gap-0.5">
                        <span>Фото скоро появится</span>
                        <span>Спасибо за ожидание</span>
                    </div>
                </div>
            );
        }

        return (
            <div className="w-full h-28 sm:h-32 p-1.5 sm:p-2">
                <img
                    src={imageUrl}
                    alt={alt}
                    className="w-full h-full object-cover rounded-lg"
                    loading="lazy"
                    onError={() => setErrored(true)}
                />
            </div>
        );
    };

    if (favorites.length === 0) {
        return (
            <div className="text-center py-12">
                <div className="text-6xl mb-4">❤️</div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">Нет избранных блюд</h3>
                <p className="text-gray-500">Добавляйте любимые блюда в избранное для быстрого доступа</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-2.5 sm:gap-3">
            {favorites.map((fav) => {
                const dish = fav?.dish || {};
                const imageUrl = getImageUrl(dish.image || dish.imageUrl);
                const dishId = fav?.dishId || dish?.id;
                const isRemoving = removingId === dishId;
                const isAdding = addingId === dishId;
                const price = Number(dish.price);
                const safePrice = Number.isFinite(price) ? price.toFixed(2) : '0.00';
                return (
                    <div
                        key={fav.id}
                        className="bg-white shadow rounded-lg overflow-hidden group relative flex cursor-pointer active:scale-[0.99] transition-transform"
                        onClick={() => onViewDish?.(dish, imageUrl)}
                    >
                        <div className="w-28 sm:w-32 flex-shrink-0">
                            <FavoriteImage imageUrl={imageUrl} alt={dish.name || 'Блюдо'} />
                        </div>
                        <div className="p-3 flex-1 flex flex-col justify-between min-w-0">
                            <div>
                                <h3 className="font-semibold text-gray-900 line-clamp-2 leading-tight text-sm sm:text-base">{dish.name || 'Блюдо'}</h3>
                                <p className="text-xs sm:text-sm text-gray-500 mt-1 line-clamp-2">{dish.description || 'Описание скоро появится'}</p>
                            </div>
                            <div className="mt-3 flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                    <span className="text-base sm:text-lg font-bold text-gray-900">{safePrice} {getCurrencySymbol(dish.restaurant?.currency || 'RUB')}</span>
                                    <span className="text-xs text-gray-400">{dish.restaurant?.name}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={async (e) => {
                                            e.stopPropagation();
                                            if (!dishId || isAdding) return;
                                            setAddingId(dishId);
                                            try {
                                                await Promise.resolve(onAddToCart?.(dish, imageUrl));
                                            } finally {
                                                setAddingId(null);
                                            }
                                        }}
                                        disabled={isAdding}
                                        className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-primary-600 text-white flex items-center justify-center text-lg font-bold hover:bg-primary-700 active:scale-95 transition disabled:opacity-50 disabled:cursor-not-allowed"
                                        aria-label="Добавить в корзину"
                                    >
                                        {isAdding ? '…' : '+'}
                                    </button>
                                    <button
                                        onClick={async (e) => {
                                            e.stopPropagation();
                                            if (!dishId || isRemoving) return;
                                            setRemovingId(dishId);
                                            try {
                                                await Promise.resolve(onRemove(dishId));
                                            } finally {
                                                setRemovingId(null);
                                            }
                                        }}
                                        disabled={isRemoving}
                                        className="text-xs sm:text-sm text-red-600 hover:text-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {isRemoving ? 'Удаляем…' : 'Удалить'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
