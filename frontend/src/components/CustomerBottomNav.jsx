import { useNavigate, useLocation } from 'react-router-dom';

export default function CustomerBottomNav() {
    const navigate = useNavigate();
    const location = useLocation();

    const menuItems = [
        {
            id: 'restaurants',
            label: 'Рестораны',
            icon: '🍽️',
            path: '/customer/restaurants'
        },
        {
            id: 'orders',
            label: 'Заказы',
            icon: '📦',
            path: '/customer/orders'
        },
        {
            id: 'favorites',
            label: 'Избранное',
            icon: '❤️',
            path: '/customer/favorites'
        },
        {
            id: 'profile',
            label: 'Профиль',
            icon: '👤',
            path: '/customer/profile'
        }
    ];

    return (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50">
            <div className="max-w-[480px] mx-auto">
                <div className="grid grid-cols-4 gap-1">
                    {menuItems.map((item) => {
                        const isActive = location.pathname === item.path ||
                            (item.id === 'restaurants' && location.pathname.startsWith('/customer/restaurants'));

                        return (
                            <button
                                key={item.id}
                                onClick={() => navigate(item.path)}
                                className={`flex flex-col items-center justify-center py-2 px-1 transition-colors ${isActive
                                    ? 'text-green-600'
                                    : 'text-gray-500 active:text-gray-700'
                                    }`}
                            >
                                <span className="text-xl mb-0.5">{item.icon}</span>
                                <span className="text-xs font-medium">{item.label}</span>
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
