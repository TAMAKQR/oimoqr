import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const OrderSuccessPage = () => {
    const navigate = useNavigate();
    const location = useLocation();

    const [fallbackPayload, setFallbackPayload] = useState(() => {
        try {
            const raw = sessionStorage.getItem('last-order-success');
            return raw ? JSON.parse(raw) : null;
        } catch (e) {
            return null;
        }
    });

    const order = location.state?.order || fallbackPayload?.order;
    const restaurant = location.state?.restaurant || fallbackPayload?.restaurant;
    const currency = location.state?.currency || fallbackPayload?.currency;

    const [showCheck, setShowCheck] = useState(false);
    const [showContent, setShowContent] = useState(false);
    const [showItems, setShowItems] = useState(false);

    useEffect(() => {
        // Animated entrance sequence
        const t1 = setTimeout(() => setShowCheck(true), 100);
        const t2 = setTimeout(() => setShowContent(true), 600);
        const t3 = setTimeout(() => setShowItems(true), 1000);
        return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
    }, []);

    useEffect(() => {
        if (location.state?.order) {
            try {
                sessionStorage.setItem('last-order-success', JSON.stringify(location.state));
                setFallbackPayload(location.state);
            } catch (e) {
                // ignore storage errors
            }
        }
    }, [location.state]);

    // If no order data, redirect back
    useEffect(() => {
        if (!order) {
            const timer = setTimeout(() => navigate('/', { replace: true }), 100);
            return () => clearTimeout(timer);
        }
    }, [order, navigate]);

    if (!order) return null;

    const orderNumber = order.orderNumber || order.id;
    const total = order.totalAmount || order.total;
    const deliveryType = order.deliveryType;
    const items = order.items || [];
    const isDineIn = deliveryType === 'dine_in';
    const isDelivery = deliveryType === 'delivery';
    const isPickup = deliveryType === 'pickup';

    const statusSteps = isDineIn
        ? [
            { icon: '✅', label: 'Заказ принят', desc: 'Ресторан получил ваш заказ', active: true },
            { icon: '👨‍🍳', label: 'Готовится', desc: 'Повар начнёт приготовление', active: false },
            { icon: '🍽️', label: 'Подан', desc: 'Блюда будут принесены к столу', active: false },
        ]
        : isDelivery
            ? [
                { icon: '✅', label: 'Заказ принят', desc: 'Ресторан получил ваш заказ', active: true },
                { icon: '👨‍🍳', label: 'Готовится', desc: 'Повар начнёт приготовление', active: false },
                { icon: '🚗', label: 'В пути', desc: 'Курьер доставит заказ', active: false },
                { icon: '📦', label: 'Доставлен', desc: 'Заказ у вас!', active: false },
            ]
            : [
                { icon: '✅', label: 'Заказ принят', desc: 'Ресторан получил ваш заказ', active: true },
                { icon: '👨‍🍳', label: 'Готовится', desc: 'Повар начнёт приготовление', active: false },
                { icon: '🏃', label: 'Готов', desc: 'Можно забирать!', active: false },
            ];

    const deliveryLabel = isDineIn
        ? `🍽️ В зале${order.tableNumber ? ` · Стол ${order.tableNumber}` : ''}`
        : isDelivery
            ? '🚗 Доставка'
            : '🏃 Самовывоз';

    return (
        <div className="min-h-screen bg-gradient-to-b from-green-50 via-white to-gray-50">
            <div className="max-w-[480px] mx-auto px-4 pt-6 pb-8 space-y-5">

                {/* Animated Success Icon */}
                <div className="flex flex-col items-center pt-4">
                    <div className={`relative transition-all duration-700 ease-out ${showCheck ? 'scale-100 opacity-100' : 'scale-50 opacity-0'}`}>
                        {/* Pulse rings */}
                        <div className="absolute inset-0 flex items-center justify-center">
                            <div className="w-24 h-24 rounded-full bg-green-100 animate-ping opacity-30" />
                        </div>
                        <div className="relative w-20 h-20 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center shadow-lg shadow-green-200">
                            <svg className={`w-10 h-10 text-white transition-all duration-500 delay-300 ${showCheck ? 'scale-100 opacity-100' : 'scale-0 opacity-0'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                        </div>
                    </div>

                    <div className={`mt-5 text-center transition-all duration-500 ${showContent ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}>
                        <h1 className="text-2xl font-bold text-gray-900">
                            {isDineIn ? 'Заказ отправлен!' : 'Заказ оформлен!'}
                        </h1>
                        <p className="text-gray-500 mt-1">
                            {isDineIn
                                ? 'Ваш заказ отправлен на кухню'
                                : isDelivery
                                    ? 'Ресторан скоро подтвердит ваш заказ'
                                    : 'Ваш заказ уже в работе'
                            }
                        </p>
                    </div>
                </div>

                {/* Order Number Card */}
                <div className={`transition-all duration-500 delay-100 ${showContent ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}>
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                        <div className="flex items-center justify-between">
                            <div>
                                <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">Номер заказа</span>
                                <div className="text-3xl font-bold text-gray-900 mt-0.5">#{orderNumber}</div>
                            </div>
                            <div className="text-right">
                                <span className="text-xs font-medium text-gray-400">Сумма</span>
                                <div className="text-xl font-bold text-gray-900 mt-0.5">{total} {currency}</div>
                            </div>
                        </div>
                        <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between text-sm">
                            <span className="text-gray-500">{deliveryLabel}</span>
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-100 text-green-700 text-xs font-semibold">
                                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                                Принят
                            </span>
                        </div>
                        {restaurant?.name && (
                            <div className="mt-2 text-xs text-gray-400">{restaurant.name}</div>
                        )}
                    </div>
                </div>

                {/* Status Timeline */}
                <div className={`transition-all duration-500 delay-200 ${showContent ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}>
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                        <h3 className="text-sm font-semibold text-gray-900 mb-4">Статус заказа</h3>
                        <div className="space-y-0">
                            {statusSteps.map((step, i) => (
                                <div key={i} className="flex items-start gap-3">
                                    <div className="flex flex-col items-center">
                                        <div className={`w-9 h-9 rounded-full flex items-center justify-center text-base flex-shrink-0 ${step.active
                                            ? 'bg-green-100 ring-2 ring-green-500 ring-offset-2'
                                            : 'bg-gray-100'
                                            }`}>
                                            {step.icon}
                                        </div>
                                        {i < statusSteps.length - 1 && (
                                            <div className={`w-0.5 h-8 ${step.active ? 'bg-green-300' : 'bg-gray-200'}`} />
                                        )}
                                    </div>
                                    <div className="pt-1.5 pb-2">
                                        <div className={`text-sm font-medium ${step.active ? 'text-green-700' : 'text-gray-400'}`}>
                                            {step.label}
                                        </div>
                                        <div className={`text-xs ${step.active ? 'text-green-600' : 'text-gray-400'}`}>
                                            {step.desc}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Order Items (collapsible) */}
                {items.length > 0 && (
                    <div className={`transition-all duration-500 delay-300 ${showItems ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}>
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                            <h3 className="text-sm font-semibold text-gray-900 mb-3">Ваш заказ</h3>
                            <div className="divide-y divide-gray-100">
                                {items.map((item, idx) => {
                                    const modifiers = Array.isArray(item.selectedModifiers)
                                        ? item.selectedModifiers
                                        : typeof item.selectedModifiers === 'string'
                                            ? (() => { try { return JSON.parse(item.selectedModifiers); } catch { return []; } })()
                                            : [];
                                    const name = item.dish?.name || item.name || item.dishName || 'Блюдо';
                                    return (
                                        <div key={idx} className="py-2.5 flex justify-between items-start">
                                            <div className="flex-1 min-w-0">
                                                <div className="text-sm text-gray-800 font-medium">{item.quantity}× {name}</div>
                                                {modifiers.length > 0 && (
                                                    <div className="text-xs text-gray-400 mt-0.5">{modifiers.map(m => m.name).join(', ')}</div>
                                                )}
                                            </div>
                                            <div className="text-sm font-medium text-gray-700 ml-3 whitespace-nowrap">
                                                {(item.price * item.quantity).toFixed(2)} {currency}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )}

                {/* What's Next Card */}
                <div className={`transition-all duration-500 delay-400 ${showItems ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}>
                    <div className="bg-gradient-to-br from-primary-50 to-white rounded-2xl border border-primary-100 p-5">
                        <h3 className="text-sm font-semibold text-gray-900 mb-3">💡 Что дальше?</h3>
                        <ul className="space-y-2.5">
                            {isDineIn ? (
                                <>
                                    <li className="flex items-start gap-2.5 text-sm text-gray-600">
                                        <span className="text-base mt-0.5">📱</span>
                                        <span>Ожидайте — блюда будут поданы к вашему столу</span>
                                    </li>
                                    <li className="flex items-start gap-2.5 text-sm text-gray-600">
                                        <span className="text-base mt-0.5">🔔</span>
                                        <span>Следите за статусом заказа в разделе «Мои заказы»</span>
                                    </li>
                                </>
                            ) : isDelivery ? (
                                <>
                                    <li className="flex items-start gap-2.5 text-sm text-gray-600">
                                        <span className="text-base mt-0.5">📞</span>
                                        <span>Ресторан свяжется с вами для подтверждения</span>
                                    </li>
                                    <li className="flex items-start gap-2.5 text-sm text-gray-600">
                                        <span className="text-base mt-0.5">🔔</span>
                                        <span>Следите за статусом заказа в разделе «Мои заказы»</span>
                                    </li>
                                    <li className="flex items-start gap-2.5 text-sm text-gray-600">
                                        <span className="text-base mt-0.5">📦</span>
                                        <span>Курьер доставит заказ по указанному адресу</span>
                                    </li>
                                </>
                            ) : (
                                <>
                                    <li className="flex items-start gap-2.5 text-sm text-gray-600">
                                        <span className="text-base mt-0.5">⏳</span>
                                        <span>Дождитесь статуса «Готов» перед визитом</span>
                                    </li>
                                    <li className="flex items-start gap-2.5 text-sm text-gray-600">
                                        <span className="text-base mt-0.5">🔔</span>
                                        <span>Следите за статусом в разделе «Мои заказы»</span>
                                    </li>
                                    <li className="flex items-start gap-2.5 text-sm text-gray-600">
                                        <span className="text-base mt-0.5">📍</span>
                                        <span>Заберите заказ по адресу ресторана</span>
                                    </li>
                                </>
                            )}
                        </ul>
                    </div>
                </div>

                {/* Action Buttons */}
                <div className={`space-y-3 pt-2 transition-all duration-500 delay-500 ${showItems ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}>
                    <button
                        onClick={() => navigate(`/customer/orders/${order.id}`, { replace: true })}
                        className="w-full py-3.5 rounded-xl bg-primary-600 text-white font-semibold text-base shadow-lg shadow-primary-200 active:scale-[0.98] transition"
                    >
                        📋 Отследить заказ
                    </button>
                    <button
                        onClick={() => {
                            const path = restaurant?.subdomain ? `/${restaurant.subdomain}` : '/';
                            navigate(path, { replace: true });
                        }}
                        className="w-full py-3 rounded-xl bg-white border border-gray-200 text-gray-700 font-medium text-sm active:bg-gray-50 transition"
                    >
                        ← Вернуться в меню
                    </button>
                </div>

            </div>
        </div>
    );
};

export default OrderSuccessPage;
