import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import customerService from '../services/customerService';
import CustomerBottomNav from '../components/CustomerBottomNav';

const BONUS_RATE = 0.05;
const BONUS_EXPIRY_DAYS = 90;

const isDeliveredStatus = (status) => {
    const normalized = String(status || '').toLowerCase();
    return normalized.includes('delivered') ||
        normalized.includes('completed') ||
        normalized.includes('finished') ||
        normalized.includes('done') ||
        normalized.includes('success');
};

const isDeliveryOrder = (order) => String(order?.deliveryType || '').toLowerCase() === 'delivery';

const toOrderDate = (order) => {
    const value = order?.createdAt || order?.updatedAt || order?.date;
    const parsed = value ? new Date(value) : null;
    return parsed && !Number.isNaN(parsed.getTime()) ? parsed : null;
};

const toOrderTotal = (order) => {
    const raw = order?.totalAmount ?? order?.total;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : 0;
};

const getTier = (activeDeliveryOrders) => {
    if (activeDeliveryOrders >= 20) {
        return {
            name: 'Gold',
            color: 'text-amber-600',
            bg: 'bg-amber-50',
            nextAt: null
        };
    }

    if (activeDeliveryOrders >= 8) {
        return {
            name: 'Silver',
            color: 'text-slate-600',
            bg: 'bg-slate-50',
            nextAt: 20
        };
    }

    return {
        name: 'Bronze',
        color: 'text-orange-600',
        bg: 'bg-orange-50',
        nextAt: 8
    };
};

export default function CustomerBonusesPage() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [orders, setOrders] = useState([]);

    useEffect(() => {
        if (!customerService.isAuthenticated()) {
            navigate('/customer/login');
            return;
        }

        const loadOrders = async () => {
            try {
                const response = await customerService.getOrderHistory(200, 0);
                setOrders(response?.orders || []);
            } catch (error) {
                console.error('Error loading customer bonuses:', error);
                toast.error('Не удалось загрузить бонусы');
            } finally {
                setLoading(false);
            }
        };

        loadOrders();
    }, [navigate]);

    const bonusData = useMemo(() => {
        const now = new Date();
        const transactions = orders
            .filter((order) => isDeliveryOrder(order) && isDeliveredStatus(order?.status))
            .map((order) => {
                const total = toOrderTotal(order);
                const earned = Math.floor(total * BONUS_RATE);
                const orderDate = toOrderDate(order);
                const expiresAt = orderDate
                    ? new Date(orderDate.getTime() + BONUS_EXPIRY_DAYS * 24 * 60 * 60 * 1000)
                    : null;
                const isActive = expiresAt ? expiresAt > now : false;

                return {
                    id: order?.id,
                    orderNumber: order?.orderNumber || order?.id,
                    total,
                    earned,
                    orderDate,
                    expiresAt,
                    isActive
                };
            })
            .filter((tx) => tx.earned > 0)
            .sort((a, b) => {
                const aTime = a.orderDate ? a.orderDate.getTime() : 0;
                const bTime = b.orderDate ? b.orderDate.getTime() : 0;
                return bTime - aTime;
            });

        const activePoints = transactions.filter((tx) => tx.isActive).reduce((sum, tx) => sum + tx.earned, 0);
        const lifetimePoints = transactions.reduce((sum, tx) => sum + tx.earned, 0);
        const expiredPoints = Math.max(0, lifetimePoints - activePoints);
        const deliveryOrdersCount = transactions.length;
        const tier = getTier(deliveryOrdersCount);

        return {
            transactions,
            activePoints,
            lifetimePoints,
            expiredPoints,
            deliveryOrdersCount,
            tier
        };
    }, [orders]);

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-100 flex justify-center">
                <div className="w-full max-w-[480px] min-h-screen bg-gray-50 shadow-2xl flex items-center justify-center">
                    <div className="text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto" />
                        <p className="mt-4 text-gray-600 text-sm">Загрузка бонусов...</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-100 flex justify-center">
            <div className="w-full max-w-[480px] min-h-screen bg-gray-50 shadow-2xl relative pb-20">
                <div className="bg-white shadow-sm sticky top-0 z-10">
                    <div className="px-3 py-4">
                        <h1 className="text-xl font-bold text-gray-900">Мои бонусы</h1>
                        <p className="text-xs text-gray-500 mt-1">Бонусы начисляются за доставленные заказы</p>
                    </div>
                </div>

                <div className="px-3 py-4 space-y-3">
                    <div className="rounded-xl bg-gradient-to-r from-green-600 to-emerald-500 text-white p-4 shadow-sm">
                        <p className="text-xs opacity-90 mb-1">Доступно к списанию</p>
                        <p className="text-3xl font-bold">{bonusData.activePoints}</p>
                        <p className="text-xs opacity-90 mt-2">1 бонус = 1 единица валюты ресторана</p>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                        <div className="bg-white rounded-xl p-3 border border-gray-100">
                            <p className="text-xs text-gray-500">Всего начислено</p>
                            <p className="text-lg font-semibold text-gray-900 mt-1">{bonusData.lifetimePoints}</p>
                        </div>
                        <div className="bg-white rounded-xl p-3 border border-gray-100">
                            <p className="text-xs text-gray-500">Сгорело</p>
                            <p className="text-lg font-semibold text-gray-900 mt-1">{bonusData.expiredPoints}</p>
                        </div>
                    </div>

                    <div className={`rounded-xl p-3 border ${bonusData.tier.bg} border-gray-100`}>
                        <p className="text-xs text-gray-500">Уровень клиента</p>
                        <p className={`text-lg font-semibold mt-1 ${bonusData.tier.color}`}>{bonusData.tier.name}</p>
                        {bonusData.tier.nextAt ? (
                            <p className="text-xs text-gray-600 mt-1">
                                До следующего уровня: {Math.max(0, bonusData.tier.nextAt - bonusData.deliveryOrdersCount)} доставок
                            </p>
                        ) : (
                            <p className="text-xs text-gray-600 mt-1">Максимальный уровень достигнут</p>
                        )}
                    </div>

                    <div className="bg-white rounded-xl p-4 border border-gray-100">
                        <h3 className="text-sm font-semibold text-gray-900 mb-2">Правила бонусной программы (доставка)</h3>
                        <ul className="space-y-1.5 text-xs text-gray-600">
                            <li>• За каждый доставленный заказ начисляется 5% от суммы в бонусах.</li>
                            <li>• Бонусы действуют 90 дней с даты начисления.</li>
                            <li>• Списывать бонусы можно при оплате заказа (MVP: скоро в следующем шаге).</li>
                            <li>• Уровень (Bronze/Silver/Gold) зависит от количества доставленных заказов.</li>
                        </ul>
                    </div>

                    <div className="bg-white rounded-xl p-4 border border-gray-100">
                        <h3 className="text-sm font-semibold text-gray-900 mb-2">Последние начисления</h3>

                        {bonusData.transactions.length === 0 ? (
                            <p className="text-sm text-gray-500">Пока нет доставленных заказов для начисления бонусов</p>
                        ) : (
                            <div className="space-y-2">
                                {bonusData.transactions.slice(0, 10).map((tx) => (
                                    <div key={tx.id} className="flex items-center justify-between border-b last:border-0 border-gray-100 pb-2 last:pb-0">
                                        <div>
                                            <p className="text-sm font-medium text-gray-900">Заказ #{tx.orderNumber}</p>
                                            <p className="text-xs text-gray-500">
                                                Сумма {tx.total.toFixed(2)} · {tx.orderDate ? tx.orderDate.toLocaleDateString('ru-RU') : 'дата неизвестна'}
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-sm font-semibold text-green-600">+{tx.earned}</p>
                                            <p className={`text-[11px] ${tx.isActive ? 'text-gray-500' : 'text-red-500'}`}>
                                                {tx.isActive ? 'активны' : 'сгорели'}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <CustomerBottomNav />
            </div>
        </div>
    );
}
