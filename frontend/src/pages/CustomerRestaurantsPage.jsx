import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import customerService from '../services/customerService';
import CustomerBottomNav from '../components/CustomerBottomNav';
import toast from 'react-hot-toast';

export default function CustomerRestaurantsPage() {
    const navigate = useNavigate();
    const [restaurants, setRestaurants] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!customerService.isAuthenticated()) {
            navigate('/customer/login');
            return;
        }
        loadRestaurants();
    }, []);

    const loadRestaurants = async () => {
        try {
            const data = await customerService.getMyRestaurants();
            setRestaurants(data.restaurants || []);
        } catch (error) {
            toast.error('Ошибка загрузки ресторанов');
        } finally {
            setLoading(false);
        }
    };

    const handleRestaurantClick = (restaurant) => {
        // Переход на страницу меню ресторана
        navigate(`/${restaurant.subdomain}`);
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-100 flex justify-center">
                <div className="w-full max-w-[480px] min-h-screen bg-gray-50 shadow-2xl flex items-center justify-center">
                    <div className="text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
                        <p className="mt-4 text-gray-600 text-sm">Загрузка...</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-100 flex justify-center">
            <div className="w-full max-w-[480px] min-h-screen bg-gray-50 shadow-2xl relative pb-20">
                {/* Header */}
                <div className="bg-white shadow-sm sticky top-0 z-10">
                    <div className="px-3 py-4">
                        <h1 className="text-xl font-bold text-gray-900">Мои рестораны</h1>
                        <p className="text-xs text-gray-500 mt-1">QR-меню, которые вы посещали</p>
                    </div>
                </div>

                {/* Content */}
                <div className="px-3 py-4">
                    {restaurants.length === 0 ? (
                        <div className="text-center py-12">
                            <div className="text-6xl mb-4">🍽️</div>
                            <h3 className="text-lg font-medium text-gray-900 mb-2">Нет ресторанов</h3>
                            <p className="text-sm text-gray-500 mb-6">
                                Отсканируйте QR-код в ресторане,<br />чтобы начать пользоваться
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {restaurants.map((restaurant) => (
                                <div
                                    key={restaurant.id}
                                    onClick={() => handleRestaurantClick(restaurant)}
                                    className="bg-white rounded-lg shadow-sm p-4 active:bg-gray-50 transition-colors cursor-pointer"
                                >
                                    <div className="flex items-start gap-3">
                                        {/* Restaurant Image/Logo */}
                                        {restaurant.logo ? (
                                            <img
                                                src={restaurant.logo}
                                                alt={restaurant.name}
                                                className="w-16 h-16 rounded-lg object-contain bg-white border border-gray-200 p-1.5 flex-shrink-0"
                                            />
                                        ) : (
                                            <div className="w-16 h-16 rounded-lg bg-gradient-to-br from-green-400 to-blue-500 flex items-center justify-center flex-shrink-0">
                                                <span className="text-2xl">🍽️</span>
                                            </div>
                                        )}

                                        {/* Restaurant Info */}
                                        <div className="flex-1 min-w-0">
                                            <h3 className="font-semibold text-base text-gray-900 truncate">
                                                {restaurant.name}
                                            </h3>
                                            {restaurant.description && (
                                                <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                                                    {restaurant.description}
                                                </p>
                                            )}

                                            {/* Stats */}
                                            <div className="flex items-center gap-4 mt-2">
                                                {restaurant.orderCount > 0 && (
                                                    <div className="flex items-center gap-1 text-xs text-gray-600">
                                                        <span>📦</span>
                                                        <span>{restaurant.orderCount} {restaurant.orderCount === 1 ? 'заказ' : 'заказов'}</span>
                                                    </div>
                                                )}
                                                {restaurant.favoriteCount > 0 && (
                                                    <div className="flex items-center gap-1 text-xs text-gray-600">
                                                        <span>❤️</span>
                                                        <span>{restaurant.favoriteCount}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Arrow */}
                                        <svg
                                            className="w-5 h-5 text-gray-400 flex-shrink-0"
                                            fill="none"
                                            stroke="currentColor"
                                            viewBox="0 0 24 24"
                                        >
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                        </svg>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Bottom Navigation */}
                <CustomerBottomNav />
            </div>
        </div>
    );
}
