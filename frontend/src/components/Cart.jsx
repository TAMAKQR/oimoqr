import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useCartStore } from '../store/cartStore';
import { useCustomerAuthStore } from '../store/customerAuthStore';

const Cart = ({ restaurant, isDishModalOpen = false }) => {
  const { customer } = useCustomerAuthStore();
  const navigate = useNavigate();
  const [isCheckingOut, setIsCheckingOut] = useState(false);

  const { items, getTotal, getItemCount, clearCart } = useCartStore();
  const currency = restaurant?.currency || '₽';

  const total = getTotal();
  const itemCount = getItemCount();
  const minAmount = restaurant?.minOrderAmount;
  const isBelowMinimum = minAmount && total < minAmount;

  const [isTrackVisible, setIsTrackVisible] = useState(false);

  useEffect(() => {
    // Smoothly reveal the bar on mount
    const timer = setTimeout(() => setIsTrackVisible(true), 10);
    return () => clearTimeout(timer);
  }, []);

  const handleCheckout = async () => {
    if (!items.length) return;

    if (isBelowMinimum) {
      toast.error(`Минимальная сумма заказа: ${minAmount} ${currency}\nТекущая сумма: ${total} ${currency}`);
      return;
    }

    // Не проверяем авторизацию здесь - гость может смотреть корзину и показать заказ официанту
    // Авторизация потребуется только на странице checkout при финальном оформлении

    setIsCheckingOut(true);

    navigate('/checkout', {
      state: {
        restaurant,
        items,
        total,
        currency,
      },
    });

    setIsCheckingOut(false);
  };

  const handleClear = () => {
    const confirmClear = window.confirm('Очистить корзину?');
    if (confirmClear) {
      clearCart();
    }
  };

  if (!itemCount || isDishModalOpen) {
    return null;
  }

  // Если клиент авторизован - поднимаем корзину выше CustomerBottomNav
  const isCustomerLoggedIn = customer && customer.id;

  // Позиционирование: если есть нижнее меню, поднимаем корзину над ним.
  // Высоту нижнего меню выставляет CustomerBottomNav в CSS переменную.
  const bottomNavHeight = 'var(--customer-bottom-nav-height, 0px)';
  const guestBottomOffset = 'max(env(safe-area-inset-bottom, 0px), var(--visual-bottom-offset, 0px))';
  const cartStyle = isCustomerLoggedIn
    ? { bottom: `calc(${bottomNavHeight} + 12px)` }
    : { bottom: guestBottomOffset };

  return (
    <>
      {/* Fill the bottom gap on mobile browsers (Chrome) with a white background */}
      {!isCustomerLoggedIn && (
        <div
          className="fixed inset-x-0 bottom-0 z-[50] bg-white pointer-events-none"
          style={{ height: guestBottomOffset }}
        />
      )}
      <div className="fixed inset-x-0 z-[60] flex justify-center px-0 pb-0" style={cartStyle}>
        <div className="w-full max-w-[480px] rounded-none sm:rounded-2xl bg-white border-t border-gray-200 px-4 py-3 sm:px-6 sm:py-4">
          <div className="flex flex-col gap-3">
            {isBelowMinimum && (
              <span className="text-xs text-yellow-700">
                Минимальный заказ {minAmount} {currency}. Добавьте {(minAmount - total).toFixed(2)} {currency}
              </span>
            )}

            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={handleCheckout}
                disabled={isCheckingOut || isBelowMinimum}
                className="w-full py-3 rounded-xl bg-primary-600 text-white font-semibold shadow-lg hover:bg-primary-700 disabled:opacity-60 disabled:cursor-not-allowed transition"
              >
                {isCheckingOut ? '...' : `Оформить на ${total.toFixed(2)} ${currency}`}
              </button>
              <button
                type="button"
                onClick={handleClear}
                className="w-full py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
              >
                Очистить корзину
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Cart;