import { useNavigate } from 'react-router-dom';

const getLastRestaurantPath = () => {
    try {
        const raw = localStorage.getItem('customer-last-restaurant');
        if (raw) {
            const data = JSON.parse(raw);
            if (data?.subdomain) {
                return `/${data.subdomain}`;
            }
        }
    } catch (e) {
        // ignore JSON errors and fall back
    }
    return '/';
};

export default function FloatingMenuWidget() {
    const navigate = useNavigate();

    return (
        <button
            type="button"
            title="Открыть меню"
            onClick={() => navigate(getLastRestaurantPath())}
            className="fixed right-4 z-[65] w-12 h-12 rounded-full bg-white border border-gray-200 shadow-lg flex items-center justify-center text-primary-700 active:scale-95 transition"
            style={{ bottom: 'calc(var(--customer-bottom-nav-height, 0px) + 14px)' }}
        >
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M7 3v7" />
                <path d="M10 3v7" />
                <path d="M4 3v7c0 1.66 1.34 3 3 3v8" />
                <path d="M20 3v8c0 1.1-.9 2-2 2h-1v8" />
                <path d="M18 3c-2 0-3 1.79-3 4v4h3" />
            </svg>
        </button>
    );
}
