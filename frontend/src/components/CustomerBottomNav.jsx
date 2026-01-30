import { useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

export default function CustomerBottomNav() {
    const navigate = useNavigate();
    const location = useLocation();
    const navRef = useRef(null);

    // Пробрасываем фактическую высоту нижнего меню в CSS переменную
    useEffect(() => {
        const update = () => {
            const height = navRef.current?.getBoundingClientRect?.().height || 0;
            document.documentElement.style.setProperty('--customer-bottom-nav-height', `${height}px`);
        };

        update();
        window.addEventListener('resize', update);
        return () => {
            window.removeEventListener('resize', update);
            document.documentElement.style.setProperty('--customer-bottom-nav-height', '0px');
        };
    }, []);

    const IconRestaurants = ({ className = 'w-6 h-6' }) => (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 10h16" />
            <path d="M7 10V7a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v3" />
            <path d="M6 10v9" />
            <path d="M18 10v9" />
            <path d="M9 19v-4h6v4" />
        </svg>
    );
    const IconOrders = ({ className = 'w-6 h-6' }) => (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 8l-9 5-9-5" />
            <path d="M3 8l9-5 9 5v8l-9 5-9-5V8z" />
        </svg>
    );
    const IconHeart = ({ className = 'w-6 h-6' }) => (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z" />
        </svg>
    );
    const IconUser = ({ className = 'w-6 h-6' }) => (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 21a8 8 0 0 0-16 0" />
            <circle cx="12" cy="7" r="4" />
        </svg>
    );

    const menuItems = [
        {
            id: 'restaurants',
            label: 'Рестораны',
            Icon: IconRestaurants,
            path: '/customer/restaurants'
        },
        {
            id: 'orders',
            label: 'Заказы',
            Icon: IconOrders,
            path: '/customer/orders'
        },
        {
            id: 'favorites',
            label: 'Избранное',
            Icon: IconHeart,
            path: '/customer/favorites'
        },
        {
            id: 'profile',
            label: 'Профиль',
            Icon: IconUser,
            path: '/customer/profile'
        }
    ];

    return (
        <div ref={navRef} className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
            <div className="max-w-[480px] mx-auto">
                <div className="grid grid-cols-4 gap-1">
                    {menuItems.map((item) => {
                        const isActive = location.pathname === item.path ||
                            (item.id === 'restaurants' && location.pathname.startsWith('/customer/restaurants'));
                        const Icon = item.Icon;

                        return (
                            <button
                                key={item.id}
                                onClick={() => navigate(item.path)}
                                className={`flex flex-col items-center justify-center py-2 px-1 transition-colors ${isActive
                                    ? 'text-green-600'
                                    : 'text-gray-500 active:text-gray-700'
                                    }`}
                            >
                                <span className="mb-0.5"><Icon className="w-6 h-6" /></span>
                                <span className="text-xs font-medium">{item.label}</span>
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
