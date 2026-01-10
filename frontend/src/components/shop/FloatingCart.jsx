import { useEffect, useState } from 'react';

const FloatingCart = ({ items = [], total = 0, onCheckout }) => {
    const [isVisible, setIsVisible] = useState(false);
    const [isAnimating, setIsAnimating] = useState(false);

    const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

    useEffect(() => {
        if (itemCount > 0) {
            setIsVisible(true);
            setIsAnimating(true);
            const timer = setTimeout(() => setIsAnimating(false), 300);
            return () => clearTimeout(timer);
        } else {
            setIsVisible(false);
        }
    }, [itemCount]);

    if (!isVisible) return null;

    const formatPrice = (price) => {
        return new Intl.NumberFormat('ru-RU').format(price);
    };

    return (
        <div className="fixed bottom-0 left-0 right-0 p-4 z-50 pointer-events-none">
            <div className="max-w-lg mx-auto pointer-events-auto">
                <button
                    onClick={onCheckout}
                    className={`w-full bg-grab-500 hover:bg-grab-600 text-white rounded-grab-lg shadow-grab-lg flex items-center justify-between p-4 transition-all ${isAnimating ? 'animate-slide-up' : ''
                        }`}
                >
                    {/* Left: Item count */}
                    <div className="flex items-center gap-3">
                        <div className="bg-white bg-opacity-20 rounded-lg w-10 h-10 flex items-center justify-center">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                            </svg>
                        </div>
                        <div className="text-left">
                            <div className="text-sm font-medium">
                                {itemCount} {itemCount === 1 ? 'товар' : itemCount < 5 ? 'товара' : 'товаров'}
                            </div>
                            <div className="text-xs opacity-90">
                                {items.slice(0, 2).map(item => item.product.name).join(', ')}
                                {items.length > 2 && '...'}
                            </div>
                        </div>
                    </div>

                    {/* Right: Total price */}
                    <div className="flex items-center gap-2">
                        <div className="text-right">
                            <div className="text-lg font-bold">{formatPrice(total)} ₽</div>
                        </div>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                    </div>
                </button>
            </div>
        </div>
    );
};

export default FloatingCart;
