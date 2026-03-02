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
                <path d="M4 5.5C4 4.67 4.67 4 5.5 4H11v16H5.5A1.5 1.5 0 0 1 4 18.5V5.5Z" />
                <path d="M20 5.5C20 4.67 19.33 4 18.5 4H13v16h5.5a1.5 1.5 0 0 0 1.5-1.5V5.5Z" />
                <path d="M6.8 8.2h2.8" />
                <path d="M6.8 11.5h2.8" />
                <path d="M14.4 8.2h2.8" />
                <path d="M14.4 11.5h2.8" />
            </svg>
        </button>
    );
}
