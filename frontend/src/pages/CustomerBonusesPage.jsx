import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import customerService from '../services/customerService';
import CustomerBottomNav from '../components/CustomerBottomNav';
import FloatingMenuWidget from '../components/FloatingMenuWidget';

const defaultBonusData = {
    bonusSystemActive: false,
    transactions: [],
    activePoints: 0,
    lifetimePoints: 0,
    expiredPoints: 0,
    deliveryOrdersCount: 0,
    tier: {
        name: 'Bronze',
        color: 'text-orange-600',
        bg: 'bg-orange-50',
        nextAt: 8
    }
};

export default function CustomerBonusesPage() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [loadError, setLoadError] = useState('');
    const [bonusData, setBonusData] = useState(defaultBonusData);

    const normalizeSummary = (summary) => ({
        ...defaultBonusData,
        ...summary,
        transactions: Array.isArray(summary?.transactions) ? summary.transactions : [],
        tier: summary?.tier || defaultBonusData.tier
    });

    const loadSummary = useCallback(async ({ isRefresh = false } = {}) => {
        if (isRefresh) {
            setRefreshing(true);
        } else {
            setLoading(true);
        }

        setLoadError('');

        try {
            const summary = await customerService.getBonusSummary(10);
            setBonusData(normalizeSummary(summary));
        } catch (error) {
            console.error('Error loading customer bonuses:', error);
            setLoadError('Не удалось загрузить бонусы. Проверьте подключение и попробуйте снова.');
            toast.error('Не удалось загрузить бонусы');
        } finally {
            if (isRefresh) {
                setRefreshing(false);
            } else {
                setLoading(false);
            }
        }
    }, []);

    const remainingToNextTier = useMemo(() => {
        if (!bonusData.tier?.nextAt) return 0;
        return Math.max(0, Number(bonusData.tier.nextAt) - Number(bonusData.deliveryOrdersCount || 0));
    }, [bonusData.tier?.nextAt, bonusData.deliveryOrdersCount]);

    const tierProgress = useMemo(() => {
        if (!bonusData.tier?.nextAt) return 100;
        const target = Number(bonusData.tier.nextAt);
        if (!target || target <= 0) return 0;
        const current = Number(bonusData.deliveryOrdersCount || 0);
        return Math.max(0, Math.min(100, Math.round((current / target) * 100)));
    }, [bonusData.tier?.nextAt, bonusData.deliveryOrdersCount]);

    const formatMoney = (value) => {
        const amount = Number(value);
        return Number.isFinite(amount) ? amount.toFixed(2) : '0.00';
    };

    const formatPercent = (value) => {
        const percent = Number(value);
        return Number.isFinite(percent) ? Math.round(percent * 100) : 0;
    };

    const formatOrderDate = (value) => {
        if (!value) return 'дата неизвестна';
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? 'дата неизвестна' : date.toLocaleDateString('ru-RU');
    };

    useEffect(() => {
        if (!customerService.isAuthenticated()) {
            navigate('/customer/login');
            return;
        }
        loadSummary();
    }, [navigate, loadSummary]);

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
                    <div className="px-3 py-4 flex items-start justify-between gap-3">
                        <div>
                            <h1 className="text-xl font-bold text-gray-900">Мои бонусы</h1>
                            <p className="text-xs text-gray-500 mt-1">Бонусы начисляются за выполненные заказы доставки и самовывоза</p>
                        </div>
                        <button
                            type="button"
                            onClick={() => loadSummary({ isRefresh: true })}
                            disabled={refreshing || loading}
                            className="shrink-0 px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 text-gray-700 bg-white disabled:opacity-50"
                        >
                            {refreshing ? 'Обновляем…' : 'Обновить'}
                        </button>
                    </div>
                </div>

                {loadError && (
                    <div className="px-3 pt-3">
                        <div className="bg-red-50 border border-red-100 rounded-xl p-3">
                            <p className="text-sm text-red-700">{loadError}</p>
                            <button
                                type="button"
                                onClick={() => loadSummary()}
                                className="mt-2 text-xs font-medium text-red-700 underline"
                            >
                                Повторить загрузку
                            </button>
                        </div>
                    </div>
                )}

                {!bonusData.bonusSystemActive ? (
                    <div className="px-3 py-8">
                        <div className="bg-white rounded-xl border border-gray-100 p-5 text-center">
                            <p className="text-lg font-semibold text-gray-900">Бонусная система пока не активна</p>
                            <p className="text-sm text-gray-500 mt-2">
                                Как только ресторан включит бонусную программу, здесь появятся начисления и история бонусов.
                            </p>
                        </div>
                    </div>
                ) : (

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
                                    До следующего уровня: {remainingToNextTier} доставок
                                </p>
                            ) : (
                                <p className="text-xs text-gray-600 mt-1">Максимальный уровень достигнут</p>
                            )}
                            <div className="mt-2 h-1.5 bg-white/70 rounded-full overflow-hidden">
                                <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${tierProgress}%` }} />
                            </div>
                        </div>

                        <div className="bg-white rounded-xl p-4 border border-gray-100">
                            <h3 className="text-sm font-semibold text-gray-900 mb-2">Правила бонусной программы</h3>
                            <ul className="space-y-1.5 text-xs text-gray-600">
                                <li>• Начисление и срок жизни бонусов управляются тарифом и/или настройками точки.</li>
                                <li>• Начисление идёт за выполненные заказы доставки и самовывоза.</li>
                                <li>• Если в точке включено «Использовать настройки тарифа», применяются лимиты тарифа.</li>
                                <li>• Списывать бонусы можно при оплате заказа (MVP: скоро в следующем шаге).</li>
                                <li>• Названия и пороги уровней задаются в админке тарифа.</li>
                            </ul>
                        </div>

                        <div className="bg-white rounded-xl p-4 border border-gray-100">
                            <h3 className="text-sm font-semibold text-gray-900 mb-2">Последние начисления</h3>

                            {bonusData.transactions.length === 0 ? (
                                <p className="text-sm text-gray-500">Пока нет выполненных заказов для начисления бонусов</p>
                            ) : (
                                <div className="space-y-2">
                                    {bonusData.transactions.slice(0, 10).map((tx) => (
                                        <div key={tx.id} className="flex items-center justify-between border-b last:border-0 border-gray-100 pb-2 last:pb-0">
                                            <div>
                                                <p className="text-sm font-medium text-gray-900">Заказ #{String(tx.orderNumber || '').replace(/^#+/, '')}</p>
                                                <p className="text-xs text-gray-500">
                                                    Сумма {formatMoney(tx.total)} · {formatOrderDate(tx.orderDate)} · {formatPercent(tx.rate)}%
                                                </p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-sm font-semibold text-green-600">+{Math.max(0, Number(tx.earned) || 0)}</p>
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
                )}

                <FloatingMenuWidget />
                <CustomerBottomNav />
            </div>
        </div>
    );
}
