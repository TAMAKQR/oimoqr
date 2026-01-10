import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { pricingService } from '../services/pricingService';
import { useAuthStore } from '../store/authStore';
import toast from 'react-hot-toast';
import DashboardLayout from '../components/DashboardLayout';
import { authService } from '../services/authService';

const PricingPage = () => {
    const navigate = useNavigate();
    const { user } = useAuthStore();
    const [pricingTiers, setPricingTiers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [userData, setUserData] = useState(null);
    const [selectedRestaurantId, setSelectedRestaurantId] = useState(null);

    useEffect(() => {
        loadData();
    }, []);

    // Автоматически выбираем первый ресторан при загрузке
    useEffect(() => {
        if (userData && !selectedRestaurantId && (userData.restaurants?.length > 0 || userData.restaurantStaff?.length > 0)) {
            const allRestaurants = [
                ...(userData.restaurants || []),
                ...(userData.restaurantStaff?.map(s => s.restaurant) || [])
            ];
            if (allRestaurants.length > 0) {
                setSelectedRestaurantId(allRestaurants[0].id);
            }
        }
    }, [userData]);

    const loadData = async () => {
        try {
            const [tiers, userInfo] = await Promise.all([
                pricingService.getPricingTiers(),
                authService.getMe()
            ]);

            // Парсим features если это JSON строка
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
            setUserData(userInfo);
        } catch (err) {
            console.error('Error loading data:', err);
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
            <div className="max-w-7xl mx-auto">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold mb-2">Тарифные планы</h1>
                    <p className="text-gray-600">
                        Выберите подходящий тариф для вашего бизнеса
                    </p>
                </div>

                {/* Current Subscription Info */}
                {currentSubscription && (
                    <div className="mb-8 p-6 bg-blue-50 border border-blue-200 rounded-lg">
                        <div className="flex items-center gap-3 mb-2">
                            <span className="text-2xl">📋</span>
                            <div>
                                <h3 className="font-semibold text-lg">Ваш текущий тариф</h3>
                                <p className="text-sm text-gray-600">
                                    {currentSubscription.status === 'TRIAL' ? (
                                        <>Пробный период • {currentSubscription.pricingTier?.name || 'Trial'}</>
                                    ) : (
                                        <>{currentSubscription.pricingTier?.name || currentSubscription.plan}</>
                                    )}
                                </p>
                            </div>
                        </div>
                        {currentSubscription.status === 'TRIAL' && (
                            <p className="text-sm text-blue-800 mt-2">
                                💡 Для активации платной подписки свяжитесь с администратором
                            </p>
                        )}
                    </div>
                )}

                {/* Pricing Cards */}
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {pricingTiers.map((tier) => {
                        const isCurrentTier = tier.id === currentTierId;
                        const isTrial = currentSubscription?.status === 'TRIAL';

                        return (
                            <div
                                key={tier.id}
                                className={`relative rounded-xl shadow-lg overflow-hidden transition-all hover:shadow-xl ${isCurrentTier
                                    ? 'ring-2 ring-primary-600 bg-primary-50'
                                    : 'bg-white'
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
                                        <span className="text-4xl font-bold">{tier.price} ₽</span>
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
                <div className="mt-12 p-6 bg-gray-50 rounded-lg">
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
