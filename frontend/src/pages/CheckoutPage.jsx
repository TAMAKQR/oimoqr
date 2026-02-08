import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useCustomerAuthStore } from '../store/customerAuthStore';
import { useCartStore } from '../store/cartStore';
import CustomerBottomNav from '../components/CustomerBottomNav';
import CustomerLoginModal from '../components/CustomerLoginModal';
import api from '../services/api';

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
    const [deliveryType, setDeliveryType] = useState(restaurant?.deliveryEnabled ? 'delivery' : 'pickup');
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

        if (customer?.id) {
            loadAddresses();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [restaurant, cartItems?.length, customer?.id]);

    const loadAddresses = async () => {
        try {
            const response = await api.get('/addresses');
            const list = response.data || [];
            setAddresses(list);
            const defaultAddress = list.find((addr) => addr.isDefault);
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
            await api.post('/addresses', newAddress);
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
            await api.delete(`/addresses/${id}`);
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

        if (!customer?.id) {
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
                items: cartItems,
                deliveryType,
                addressId: deliveryType === 'delivery' ? selectedAddressId : null,
                paymentMethod,
                comment
            };

            const response = await api.post('/orders', payload);
            clearCart();
            toast.success('Заказ оформлен');
            const orderId = response?.data?.order?.id || response?.data?.id;
            if (orderId) {
                navigate(`/orders/${orderId}`);
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
        <div className="bg-white rounded-lg shadow-sm p-4">
            <h2 className="font-semibold text-base mb-3">Ваш заказ</h2>
            <div className="space-y-3">
                {cartItems.map((item) => (
                    <div key={item.itemId} className="flex justify-between items-start gap-3">
                        <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm break-words">{item.dish.name}</div>
                            {item.modifiers?.length > 0 && (
                                <div className="text-xs text-gray-500 break-words">{item.modifiers.map((m) => m.name).join(', ')}</div>
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
                            <div className="font-medium text-sm whitespace-nowrap">{(item.totalPrice * item.quantity).toFixed(2)} {currency}</div>
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
                        <span>{deliveryFee.toFixed(2)} {currency}</span>
                    </div>
                )}
                <div className="flex justify-between text-base font-bold">
                    <span>Итого:</span>
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
                            <div className="bg-white rounded-lg shadow-sm p-4">
                                <h2 className="font-semibold text-base mb-3">Способ получения</h2>
                                <select
                                    value={deliveryType}
                                    onChange={(e) => setDeliveryType(e.target.value)}
                                    className="input-field w-full text-sm"
                                >
                                    {restaurant?.deliveryEnabled && <option value="delivery">Доставка{restaurant.deliveryFee > 0 ? ` (+${restaurant.deliveryFee} ${currency})` : ''}</option>}
                                    <option value="pickup">Самовывоз (бесплатно)</option>
                                </select>
                                {!restaurant?.deliveryEnabled && (
                                    <p className="text-sm text-gray-600 mt-3 p-2 bg-blue-50 rounded border border-blue-200">
                                        ℹ️ Доставка временно недоступна. Вы можете забрать заказ самостоятельно.
                                    </p>
                                )}
                            </div>

                            {deliveryType === 'delivery' && (
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
                                                    className={`relative p-3 rounded-lg border-2 transition-all ${selectedAddressId === addr.id ? 'border-primary-600 bg-primary-50' : 'border-gray-200'}`}
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
                    <div className="max-w-[480px] mx-auto p-3">
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
                            disabled={loading || (deliveryType === 'delivery' && !selectedAddressId)}
                            className="btn-primary w-full py-3 text-base disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                        >
                            {loading ? 'Оформление...' : `Оформить на ${finalTotal} ${currency}`}
                        </button>
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

            {showWaiterModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100] p-4">
                    <div className="bg-white rounded-2xl max-w-md w-full max-h-[80vh] overflow-y-auto shadow-2xl">
                        <div className="sticky top-0 bg-gradient-to-r from-primary-600 to-primary-700 text-white p-4 rounded-t-2xl">
                            <div className="flex items-center justify-between">
                                <h2 className="text-xl font-bold flex items-center gap-2">👨‍🍳 Мой заказ</h2>
                                <button onClick={() => setShowWaiterModal(false)} className="text-white hover:bg-white/20 rounded-full p-1">
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>
                        </div>

                        <div className="p-4 space-y-3">
                            <p className="text-sm text-gray-600 mb-4">📱 Покажите этот экран официанту для оформления заказа</p>
                            {cartItems.map((item, index) => (
                                <div key={index} className="border-b pb-3 last:border-b-0">
                                    <div className="flex justify-between items-start">
                                        <div className="flex-1">
                                            <h3 className="font-semibold text-gray-900">{item.dish.name}</h3>
                                            {item.modifiers?.length > 0 && (
                                                <p className="text-xs text-gray-500 mt-1">{item.modifiers.map((m) => m.name).join(', ')}</p>
                                            )}
                                            <p className="text-sm text-gray-600 mt-1">Количество: <span className="font-medium">{item.quantity}</span></p>
                                        </div>
                                        <div className="text-right ml-4">
                                            <p className="font-bold text-primary-600">{item.totalPrice} {currency}</p>
                                        </div>
                                    </div>
                                </div>
                            ))}

                            <div className="border-t-2 border-primary-200 pt-3 mt-4">
                                <div className="flex justify-between items-center">
                                    <span className="text-lg font-bold text-gray-900">Итого:</span>
                                    <span className="text-2xl font-bold text-primary-600">{finalTotal} {currency}</span>
                                </div>
                            </div>
                        </div>

                        <div className="sticky bottom-0 bg-white border-t p-4 rounded-b-2xl">
                            <button onClick={() => setShowWaiterModal(false)} className="w-full bg-primary-600 text-white py-3 rounded-xl font-semibold hover:bg-primary-700 transition">
                                Закрыть
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {customer?.id && <CustomerBottomNav />}
        </div>
    );
};

export default CheckoutPage;
