import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useCustomerAuthStore } from '../store/customerAuthStore';
import CustomerBottomNav from '../components/CustomerBottomNav';
import CustomerLoginModal from '../components/CustomerLoginModal';
import api from '../services/api';
import toast from 'react-hot-toast';
import { useCartStore } from '../store/cartStore';

const CheckoutPage = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { customer } = useCustomerAuthStore();
    const { items: cartItems, getTotal, updateQuantity, removeItem, clearCart } = useCartStore();

    const { restaurant, currency } = location.state || {};

    const [loading, setLoading] = useState(false);
    const [showLoginModal, setShowLoginModal] = useState(false);
    const [showWaiterModal, setShowWaiterModal] = useState(false);
    const [addresses, setAddresses] = useState([]);
    const [selectedAddressId, setSelectedAddressId] = useState(null);
    const [deliveryType, setDeliveryType] = useState('delivery'); // delivery | pickup
    const [paymentMethod, setPaymentMethod] = useState('cash'); // cash | card | online
    const [comment, setComment] = useState('');
    const [newAddress, setNewAddress] = useState({
        address: '',
        entrance: '',
        floor: '',
        apartment: '',
        comment: ''
    });
    const [showNewAddressForm, setShowNewAddressForm] = useState(false);
    const [initialLoad, setInitialLoad] = useState(true);

    useEffect(() => {
        console.log('CheckoutPage loaded', { customer, restaurant, cartItems, currency });

        // Проверяем наличие корзины и ресторана ТОЛЬКО при первой загрузке
        if (initialLoad && (!restaurant || !cartItems || cartItems.length === 0)) {
            console.log('No restaurant or items, going back');
            window.history.back();
            return;
        }

        setInitialLoad(false);

        // Если корзина опустела - используем браузерную навигацию (без индикатора загрузки)
        if (!initialLoad && cartItems && cartItems.length === 0) {
            console.log('Cart became empty, going back');
            window.history.back();
            return;
        }

        // Если пользователь авторизован - загружаем адреса
        if (customer && customer.id) {
            loadAddresses();
        }
    }, [restaurant, cartItems, customer]);

    const loadAddresses = async () => {
        if (!customer || !customer.id) return;

        try {
            const response = await api.get('/customers/addresses', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('customer-token')}`
                }
            });
            const addressList = response.data.addresses || [];
            setAddresses(addressList);

            // Автоматически выбираем адрес по умолчанию
            const defaultAddress = addressList.find(addr => addr.isDefault);
            if (defaultAddress) {
                setSelectedAddressId(defaultAddress.id);
            }
        } catch (error) {
            console.error('Error loading addresses:', error);
        }
    };

    const handleAddAddress = async () => {
        if (!newAddress.address.trim()) {
            toast.error('Введите адрес');
            return;
        }

        try {
            const response = await api.post('/customers/addresses', newAddress, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('customer-token')}`
                }
            });

            const createdAddress = response.data.address;
            setAddresses([...addresses, createdAddress]);
            setSelectedAddressId(createdAddress.id);
            setShowNewAddressForm(false);
            setNewAddress({ address: '', entrance: '', floor: '', apartment: '', comment: '' });
            toast.success('Адрес добавлен');
        } catch (error) {
            console.error('Error adding address:', error);
            toast.error('Ошибка при добавлении адреса');
        }
    };

    const handleDeleteAddress = async (addressId) => {
        if (!confirm('Удалить этот адрес?')) {
            return;
        }

        try {
            await api.delete(`/customers/addresses/${addressId}`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('customer-token')}`
                }
            });

            setAddresses(addresses.filter(addr => addr.id !== addressId));
            if (selectedAddressId === addressId) {
                setSelectedAddressId(null);
            }
            toast.success('Адрес удален');
        } catch (error) {
            console.error('Error deleting address:', error);
            toast.error('Ошибка при удалении адреса');
        }
    };

    const handlePlaceOrder = async () => {
        // Проверяем авторизацию перед оформлением заказа
        if (!customer || !customer.id) {
            toast.error('Необходимо войти для оформления заказа');
            setShowLoginModal(true);
            return;
        }

        if (deliveryType === 'delivery' && !selectedAddressId) {
            toast.error('Выберите адрес доставки');
            return;
        }

        setLoading(true);
        try {
            const selectedAddress = addresses.find(addr => addr.id === selectedAddressId);

            const orderData = {
                restaurantId: restaurant.id,
                customerId: customer.id,
                items: cartItems.map(item => ({
                    id: item.dish.id,
                    quantity: item.quantity,
                    price: parseFloat(item.totalPrice) || 0,
                    selectedModifiers: item.modifiers
                })),
                total: parseFloat(getTotal().toFixed(2)),
                deliveryType,
                paymentMethod,
                comment: comment.trim() || undefined,
                customerAddressId: deliveryType === 'delivery' ? selectedAddressId : undefined,
                deliveryAddress: deliveryType === 'delivery' && selectedAddress
                    ? `${selectedAddress.address}${selectedAddress.entrance ? ', подъезд ' + selectedAddress.entrance : ''}${selectedAddress.floor ? ', этаж ' + selectedAddress.floor : ''}${selectedAddress.apartment ? ', кв. ' + selectedAddress.apartment : ''}`
                    : undefined
            };

            const response = await api.post('/customers/orders', orderData, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('customer-token')}`
                }
            });

            toast.success('Заказ успешно оформлен!');

            // Очищаем корзину
            clearCart();

            // Переходим на страницу заказа
            navigate(`/customer/orders/${response.data.order.id}`);
        } catch (error) {
            console.error('Error creating order:', error);
            toast.error(error.response?.data?.error || 'Ошибка при оформлении заказа');
        } finally {
            setLoading(false);
        }
    };

    if (!restaurant || !cartItems) {
        return null;
    }

    const deliveryFee = deliveryType === 'delivery' && restaurant.deliveryFee ? restaurant.deliveryFee : 0;
    const total = getTotal();
    const finalTotal = total + deliveryFee;

    return (
        <div className="min-h-screen bg-gray-100 flex justify-center">
            {/* Mobile Container - максимум 480px */}
            <div className="w-full max-w-[480px] min-h-screen bg-gray-50 shadow-2xl relative pb-20">
                {/* Header */}
                <div className="bg-white shadow-sm sticky top-0 z-10">
                    <div className="px-3 py-3 flex items-center gap-3">
                        <button
                            onClick={() => navigate(-1)}
                            className="text-gray-600 active:text-gray-900"
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                        </button>
                        <h1 className="text-lg font-bold">Оформление заказа</h1>
                    </div>
                </div>

                <div className="px-3 py-4 space-y-4">
                    {/* Тип получения */}
                    <div className="bg-white rounded-lg shadow-sm p-4">
                        <h2 className="font-semibold text-base mb-3">Способ получения</h2>
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                onClick={() => setDeliveryType('delivery')}
                                className={`p-3 rounded-lg border-2 transition-all ${deliveryType === 'delivery'
                                    ? 'border-primary-600 bg-primary-50'
                                    : 'border-gray-200 active:border-gray-300'
                                    }`}
                            >
                                <div className="text-2xl mb-1">🚗</div>
                                <div className="font-semibold text-sm">Доставка</div>
                                {restaurant.deliveryFee > 0 && (
                                    <div className="text-xs text-gray-500">{restaurant.deliveryFee} {currency}</div>
                                )}
                            </button>
                            <button
                                onClick={() => setDeliveryType('pickup')}
                                className={`p-3 rounded-lg border-2 transition-all ${deliveryType === 'pickup'
                                    ? 'border-primary-600 bg-primary-50'
                                    : 'border-gray-200 active:border-gray-300'
                                    }`}
                            >
                                <div className="text-2xl mb-1">🏃</div>
                                <div className="font-semibold text-sm">Самовывоз</div>
                                <div className="text-xs text-gray-500">Бесплатно</div>
                            </button>
                        </div>
                    </div>

                    {/* Адрес доставки */}
                    {deliveryType === 'delivery' && (
                        <div className="bg-white rounded-lg shadow-sm p-4">
                            <div className="flex justify-between items-center mb-3">
                                <h2 className="font-semibold text-base">Адрес доставки</h2>
                                <button
                                    onClick={() => setShowNewAddressForm(!showNewAddressForm)}
                                    className="text-primary-600 text-xs font-medium active:text-primary-700"
                                >
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
                                    <p className="text-gray-500 text-center py-3 text-sm">
                                        Нет сохраненных адресов. Добавьте новый адрес.
                                    </p>
                                ) : (
                                    addresses.map((addr) => (
                                        <div
                                            key={addr.id}
                                            className={`relative p-3 rounded-lg border-2 transition-all ${selectedAddressId === addr.id
                                                ? 'border-primary-600 bg-primary-50'
                                                : 'border-gray-200'
                                                }`}
                                        >
                                            <button
                                                onClick={() => setSelectedAddressId(addr.id)}
                                                className="w-full text-left pr-8"
                                            >
                                                <div className="font-medium text-sm">{addr.address}</div>
                                                {(addr.entrance || addr.floor || addr.apartment) && (
                                                    <div className="text-xs text-gray-600">
                                                        {[
                                                            addr.entrance && `подъезд ${addr.entrance}`,
                                                            addr.floor && `этаж ${addr.floor}`,
                                                            addr.apartment && `кв. ${addr.apartment}`
                                                        ].filter(Boolean).join(', ')}
                                                    </div>
                                                )}
                                                {addr.isDefault && (
                                                    <span className="inline-block mt-1 text-xs bg-primary-100 text-primary-700 px-2 py-0.5 rounded">
                                                        По умолчанию
                                                    </span>
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

                    {/* Способ оплаты */}
                    <div className="bg-white rounded-lg shadow-sm p-4">
                        <h2 className="font-semibold text-base mb-3">Способ оплаты</h2>
                        <div className="space-y-2">
                            <button
                                onClick={() => setPaymentMethod('cash')}
                                className={`w-full text-left p-3 rounded-lg border-2 transition-all ${paymentMethod === 'cash'
                                    ? 'border-primary-600 bg-primary-50'
                                    : 'border-gray-200 active:border-gray-300'
                                    }`}
                            >
                                <div className="flex items-center gap-3">
                                    <span className="text-xl">💵</span>
                                    <div>
                                        <div className="font-medium text-sm">Наличными</div>
                                        <div className="text-xs text-gray-500">При получении</div>
                                    </div>
                                </div>
                            </button>
                            <button
                                onClick={() => setPaymentMethod('card')}
                                className={`w-full text-left p-3 rounded-lg border-2 transition-all ${paymentMethod === 'card'
                                    ? 'border-primary-600 bg-primary-50'
                                    : 'border-gray-200 active:border-gray-300'
                                    }`}
                            >
                                <div className="flex items-center gap-3">
                                    <span className="text-xl">💳</span>
                                    <div>
                                        <div className="font-medium text-sm">Картой курьеру</div>
                                        <div className="text-xs text-gray-500">При получении</div>
                                    </div>
                                </div>
                            </button>
                        </div>
                    </div>

                    {/* Комментарий к заказу */}
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

                    {/* Состав заказа */}
                    <div className="bg-white rounded-lg shadow-sm p-4">
                        <h2 className="font-semibold text-base mb-3">Ваш заказ</h2>
                        <div className="space-y-3">
                            {cartItems.map((item) => (
                                <div key={item.itemId} className="flex justify-between items-start gap-3">
                                    <div className="flex-1 min-w-0">
                                        <div className="font-medium text-sm break-words">
                                            {item.dish.name}
                                        </div>
                                        {item.modifiers && item.modifiers.length > 0 && (
                                            <div className="text-xs text-gray-500 break-words">
                                                {item.modifiers.map(m => m.name).join(', ')}
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex flex-col items-end gap-2">
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => updateQuantity(item.itemId, item.quantity - 1)}
                                                className="w-8 h-8 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center text-base hover:bg-gray-200 active:scale-95 transition"
                                            >
                                                -
                                            </button>
                                            <span className="min-w-[32px] text-center text-sm font-semibold">{item.quantity}</span>
                                            <button
                                                onClick={() => updateQuantity(item.itemId, item.quantity + 1)}
                                                className="w-8 h-8 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center text-base hover:bg-gray-200 active:scale-95 transition"
                                            >
                                                +
                                            </button>
                                        </div>
                                        <div className="font-medium text-sm whitespace-nowrap">
                                            {(item.totalPrice * item.quantity).toFixed(2)} {currency}
                                        </div>
                                        <button
                                            onClick={() => removeItem(item.itemId)}
                                            className="text-xs text-red-600 hover:text-red-700"
                                        >
                                            Удалить
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="mt-3 pt-3 border-t space-y-1.5">
                            <div className="flex justify-between text-gray-600 text-sm">
                                <span>Сумма заказа:</span>
                                <span>{total.toFixed(2)} {currency}</span>
                            </div>
                            {deliveryFee > 0 && (
                                <div className="flex justify-between text-gray-600 text-sm">
                                    <span>Доставка:</span>
                                    <span>{deliveryFee} {currency}</span>
                                </div>
                            )}
                            <div className="flex justify-between text-base font-bold">
                                <span>Итого:</span>
                                <span>{finalTotal.toFixed(2)} {currency}</span>
                            </div>
                        </div>
                    </div>

                    {/* Кнопки оформления */}
                    <div className="fixed bottom-0 left-0 right-0 bg-white border-t z-50">
                        <div className="max-w-[480px] mx-auto p-3 space-y-2">
                            {/* Основная кнопка оформления */}
                            <button
                                onClick={handlePlaceOrder}
                                disabled={loading || (deliveryType === 'delivery' && !selectedAddressId)}
                                className="btn-primary w-full py-3 text-base disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                            >
                                {loading ? 'Оформление...' : `Оформить на ${finalTotal.toFixed(2)} ${currency}`}
                            </button>

                            {/* Кнопка "Показать официанту" для гостей */}
                            {(!customer || !customer.id) && (
                                <button
                                    onClick={() => setShowWaiterModal(true)}
                                    className="w-full py-2.5 text-sm border-2 border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition"
                                >
                                    👨‍🍳 Показать заказ официанту
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Модальное окно авторизации */}
            <CustomerLoginModal
                isOpen={showLoginModal}
                onClose={() => {
                    setShowLoginModal(false);
                    navigate(-1); // Вернуться назад если пользователь закрыл окно
                }}
                onLoginSuccess={() => {
                    setShowLoginModal(false);
                    toast.success('Вы успешно вошли!');
                    loadAddresses(); // Загрузить адреса после входа
                }}
                restaurantId={restaurant?.id}
            />

            {/* Модальное окно для показа заказа официанту */}
            {showWaiterModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100] p-4">
                    <div className="bg-white rounded-2xl max-w-md w-full max-h-[80vh] overflow-y-auto shadow-2xl">
                        {/* Header */}
                        <div className="sticky top-0 bg-gradient-to-r from-primary-600 to-primary-700 text-white p-4 rounded-t-2xl">
                            <div className="flex items-center justify-between">
                                <h2 className="text-xl font-bold flex items-center gap-2">
                                    👨‍🍳 Мой заказ
                                </h2>
                                <button
                                    onClick={() => setShowWaiterModal(false)}
                                    className="text-white hover:bg-white/20 rounded-full p-1"
                                >
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>
                        </div>

                        {/* Список заказа */}
                        <div className="p-4 space-y-3">
                            <p className="text-sm text-gray-600 mb-4">
                                📱 Покажите этот экран официанту для оформления заказа
                            </p>

                            {cartItems.map((item, index) => (
                                <div key={index} className="border-b pb-3 last:border-b-0">
                                    <div className="flex justify-between items-start">
                                        <div className="flex-1">
                                            <h3 className="font-semibold text-gray-900">{item.dish.name}</h3>
                                            {item.modifiers && item.modifiers.length > 0 && (
                                                <p className="text-xs text-gray-500 mt-1">
                                                    {item.modifiers.map(m => m.name).join(', ')}
                                                </p>
                                            )}
                                            <p className="text-sm text-gray-600 mt-1">
                                                Количество: <span className="font-medium">{item.quantity}</span>
                                            </p>
                                        </div>
                                        <div className="text-right ml-4">
                                            <p className="font-bold text-primary-600">{item.totalPrice} {currency}</p>
                                        </div>
                                    </div>
                                </div>
                            ))}

                            {/* Итого */}
                            <div className="border-t-2 border-primary-200 pt-3 mt-4">
                                <div className="flex justify-between items-center">
                                    <span className="text-lg font-bold text-gray-900">Итого:</span>
                                    <span className="text-2xl font-bold text-primary-600">{finalTotal.toFixed(2)} {currency}</span>
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="sticky bottom-0 bg-white border-t p-4 rounded-b-2xl">
                            <button
                                onClick={() => setShowWaiterModal(false)}
                                className="w-full bg-primary-600 text-white py-3 rounded-xl font-semibold hover:bg-primary-700 transition"
                            >
                                Закрыть
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CheckoutPage;
