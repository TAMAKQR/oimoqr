import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { pricingService } from '../services/pricingService';
import { useAuthStore } from '../store/authStore';
import toast from 'react-hot-toast';
import DashboardLayout from '../components/DashboardLayout';
import { useUserData } from '../hooks/useUserData';
import { useSelectedRestaurant } from '../hooks/useSelectedRestaurant';

const PricingPage = () => {
    const navigate = useNavigate();
    const { user } = useAuthStore();
    const [pricingTiers, setPricingTiers] = useState([]);
    const { userData, loading: userLoading } = useUserData();
    const { selectedRestaurantId, setSelectedRestaurantId, selectedRestaurant } = useSelectedRestaurant(userData);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('RESTAURANT');
    const isOwner = selectedRestaurantId
        ? !!userData?.restaurants?.some((restaurant) => restaurant.id === selectedRestaurantId)
        : (userData?.restaurants?.length || 0) > 0;

    useEffect(() => {
        if (userLoading) {
            return;
        }

        if (!isOwner && !user?.isAdmin) {
            toast.error('Раздел тарифов доступен только главному администратору ресторана');
            navigate('/dashboard');
        }
    }, [userLoading, isOwner, user?.isAdmin, navigate]);

    useEffect(() => {
        loadPricingTiers();
    }, []);

    const loadPricingTiers = async () => {
        try {
            const tiers = await pricingService.getPricingTiers();
            const parsedTiers = tiers.map(tier => {
                let features = tier.features;
                if (typeof features === 'string') {
                    try {
                        features = JSON.parse(features);
                    } catch (e) {
                        features = [];
                    }
                }
                return {
                    ...tier,
                    features: Array.isArray(features) ? features : []
                };
            });
            setPricingTiers(parsedTiers);
        } catch (err) {
            console.error('Error loading pricing tiers:', err);
        } finally {
            setLoading(false);
        }
    };

    const currentSubscription = userData?.subscriptions?.[0];
    const currentTierId = currentSubscription?.pricingTierId;

    if (loading) {
        return (
            <DashboardLayout userData={userData} selectedRestaurantId={selectedRestaurantId}>
                <div className="flex items-center justify-center min-h-96">
                    <div className="text-xl">Загрузка...</div>
                </div>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout userData={userData} selectedRestaurantId={selectedRestaurantId}>
            <div className="max-w-6xl mx-auto">
                <div className="mb-6">
                    <h1 className="text-2xl font-bold text-gray-900">Тарифные планы</h1>
                    <p className="text-gray-500 text-sm mt-1">
                        Выберите подходящий тариф для вашего бизнеса
                    </p>
                    <div className="flex gap-1 mt-4 bg-gray-100 rounded-lg p-1 w-fit">
                        <button
                            onClick={() => setActiveTab('RESTAURANT')}
                            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'RESTAURANT'
                                ? 'bg-white text-gray-900 shadow-sm'
                                : 'text-gray-500 hover:text-gray-700'
                                }`}
                        >
                            🍽 Рестораны
                        </button>
                        <button
                            onClick={() => setActiveTab('ONLINE_STORE')}
                            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'ONLINE_STORE'
                                ? 'bg-white text-gray-900 shadow-sm'
                                : 'text-gray-500 hover:text-gray-700'
                                }`}
                        >
                            🛍 Магазины
                        </button>
                        <button
                            onClick={() => setActiveTab('HOTEL')}
                            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'HOTEL'
                                ? 'bg-white text-gray-900 shadow-sm'
                                : 'text-gray-500 hover:text-gray-700'
                                }`}
                        >
                            🏨 Отели
                        </button>
                    </div>
                </div>

                {/* Current Subscription Info */}
                {currentSubscription && (() => {
                    const now = new Date();
                    const isTrial = currentSubscription.status === 'TRIAL';
                    const isActive = currentSubscription.status === 'ACTIVE';
                    const pricingTier = currentSubscription.pricingTier;
                    const maxRestaurants = pricingTier?.maxRestaurants || 1;
                    const currentRestaurantCount = userData?.restaurants?.length || 0;

                    let daysLeft = 0;
                    let endDateFormatted = '';
                    if (isTrial && currentSubscription.trialEndsAt) {
                        daysLeft = Math.max(0, Math.ceil((new Date(currentSubscription.trialEndsAt) - now) / (1000 * 60 * 60 * 24)));
                        endDateFormatted = new Date(currentSubscription.trialEndsAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
                    } else if (isActive && currentSubscription.currentPeriodEnd) {
                        daysLeft = Math.ceil((new Date(currentSubscription.currentPeriodEnd) - now) / (1000 * 60 * 60 * 24));
                        endDateFormatted = new Date(currentSubscription.currentPeriodEnd).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
                    }

                    const daysWord = daysLeft === 1 ? 'день' : daysLeft < 5 ? 'дня' : 'дней';

                    return (
                        <div className={`mb-6 rounded-xl border ${isActive ? 'bg-green-50 border-green-200' : 'bg-blue-50 border-blue-200'}`}>
                            <div className="p-5">
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${isActive ? 'bg-green-100' : 'bg-blue-100'}`}>
                                            <svg className={`w-5 h-5 ${isActive ? 'text-green-600' : 'text-blue-600'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                        </div>
                                        <div>
                                            <h3 className="font-semibold text-gray-900">
                                                {isTrial ? 'Пробный период' : pricingTier?.name || currentSubscription.plan}
                                            </h3>
                                        </div>
                                    </div>
                                    <span className={`px-3 py-1 text-xs font-medium rounded-full ${isActive ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                                        {isActive ? 'АКТИВНА' : 'ПРОБНЫЙ'}
                                    </span>
                                </div>

                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                                    <div className="bg-white/60 rounded-lg p-3">
                                        <p className="text-gray-500 text-xs mb-1">Рестораны</p>
                                        <p className="font-semibold text-gray-900">{currentRestaurantCount} из {maxRestaurants}</p>
                                    </div>
                                    {isActive && pricingTier && (
                                        <div className="bg-white/60 rounded-lg p-3">
                                            <p className="text-gray-500 text-xs mb-1">Стоимость</p>
                                            <p className="font-semibold text-gray-900">${pricingTier.price}/мес</p>
                                        </div>
                                    )}
                                    {endDateFormatted && (
                                        <div className="bg-white/60 rounded-lg p-3">
                                            <p className="text-gray-500 text-xs mb-1">Действует до</p>
                                            <p className="font-semibold text-gray-900">{endDateFormatted}</p>
                                            <p className="text-xs text-orange-600 mt-0.5">{daysLeft} {daysWord}</p>
                                        </div>
                                    )}
                                </div>

                                {isTrial && (
                                    <p className="text-sm text-blue-800 mt-3">
                                        💡 Для активации платной подписки свяжитесь с администратором
                                    </p>
                                )}
                            </div>
                        </div>
                    );
                })()}

                {/* Pricing Cards */}
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {pricingTiers
                        .filter(tier => !tier.businessType || tier.businessType === activeTab || tier.businessType === 'ALL')
                        .map((tier) => {
                            const isCurrentTier = tier.id === currentTierId;
                            const isTrial = currentSubscription?.status === 'TRIAL';

                            return (
                                <div
                                    key={tier.id}
                                    className={`relative rounded-xl overflow-hidden transition-all hover:shadow-md ${isCurrentTier
                                        ? 'ring-2 ring-primary-600 bg-primary-50'
                                        : 'bg-white border border-gray-100'
                                        }`}
                                >
                                    {/* Ribbon for current tier */}
                                    {isCurrentTier && (
                                        <div className="absolute top-4 right-4">
                                            <span className="bg-primary-600 text-white text-xs font-bold px-3 py-1 rounded-full">
                                                Текущий
                                            </span>
                                        </div>
                                    )}

                                    <div className="p-6">
                                        {/* Tier Name */}
                                        <h3 className="text-2xl font-bold mb-2">{tier.name}</h3>

                                        {/* Price */}
                                        <div className="mb-6">
                                            <span className="text-4xl font-bold">${tier.price}</span>
                                            <span className="text-gray-600 ml-2">/месяц</span>
                                        </div>

                                        {/* Description */}
                                        {tier.description && (
                                            <p className="text-gray-600 text-sm mb-6">
                                                {tier.description}
                                            </p>
                                        )}

                                        {/* Features */}
                                        <div className="mb-6">
                                            <p className="font-semibold mb-3 text-sm text-gray-700">
                                                Что включено:
                                            </p>
                                            <ul className="space-y-2">
                                                <li className="flex items-start gap-2 text-sm">
                                                    <span className="text-green-500 mt-0.5">✓</span>
                                                    <span>До {tier.maxRestaurants} {tier.maxRestaurants === 1 ? 'ресторана' : 'ресторанов'}</span>
                                                </li>
                                                {tier.features && tier.features.map((feature, index) => (
                                                    <li key={index} className="flex items-start gap-2 text-sm">
                                                        <span className="text-green-500 mt-0.5">✓</span>
                                                        <span>{feature}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>

                                        {/* CTA Button */}
                                        <button
                                            onClick={() => {
                                                if (isTrial) {
                                                    toast('Для активации этого тарифа свяжитесь с администратором:\n\nEmail: admin@oimoqr.com\nTelegram: @oimoqr_support', {
                                                        duration: 6000,
                                                        icon: '💬'
                                                    });
                                                }
                                            }}
                                            className={`w-full py-3 rounded-lg font-semibold transition-colors ${isCurrentTier
                                                ? 'bg-gray-300 text-gray-600 cursor-not-allowed'
                                                : isTrial
                                                    ? 'bg-primary-600 text-white hover:bg-primary-700'
                                                    : 'bg-gray-200 text-gray-600 cursor-not-allowed'
                                                }`}
                                            disabled={isCurrentTier || !isTrial}
                                        >
                                            {isCurrentTier
                                                ? 'Активен'
                                                : isTrial
                                                    ? 'Связаться с администратором'
                                                    : 'Недоступно'}
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                </div>

                {/* Contact Info */}
                <div className="mt-12 p-5 bg-white rounded-xl border border-gray-100">
                    <h3 className="font-semibold text-lg mb-3">Нужна помощь в выборе тарифа?</h3>
                    <p className="text-gray-600 mb-4">
                        Свяжитесь с нашей службой поддержки, и мы поможем подобрать оптимальный план для вашего бизнеса.
                    </p>
                    <div className="flex flex-wrap gap-4">
                        <a
                            href="mailto:admin@oimoqr.com"
                            className="text-primary-600 hover:text-primary-700 font-medium text-sm"
                        >
                            📧 admin@oimoqr.com
                        </a>
                        <a
                            href="https://t.me/oimoqr_support"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary-600 hover:text-primary-700 font-medium text-sm"
                        >
                            💬 Telegram
                        </a>
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
};

export default PricingPage;
