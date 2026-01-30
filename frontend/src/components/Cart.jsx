import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useCartStore } from '../store/cartStore';
import { useCustomerAuthStore } from '../store/customerAuthStore';

const Cart = ({ restaurant, isDishModalOpen = false }) => {
  const { customer } = useCustomerAuthStore();
  const navigate = useNavigate();
  const [isCheckingOut, setIsCheckingOut] = useState(false);

  const { items, getTotal, getItemCount } = useCartStore();
  const currency = restaurant?.currency || '₽';

  const total = getTotal();
  const itemCount = getItemCount();
  const minAmount = restaurant?.minOrderAmount;
  const isBelowMinimum = minAmount && total < minAmount;

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

  if (!itemCount || isDishModalOpen) {
    return null;
  }

  // Если клиент авторизован - поднимаем корзину выше CustomerBottomNav
  const isCustomerLoggedIn = customer && customer.id;

  // Позиционирование: если есть нижнее меню, поднимаем корзину над ним.
  // Высоту нижнего меню выставляет CustomerBottomNav в CSS переменную.
  const bottomNavHeight = 'var(--customer-bottom-nav-height, 0px)';
  const cartStyle = isCustomerLoggedIn
    ? { bottom: `calc(${bottomNavHeight} + 12px)` }
    : { bottom: 'env(safe-area-inset-bottom, 0px)' };

  return (
    <div className="fixed inset-x-0 z-[60] flex justify-center px-0 pb-0" style={cartStyle}>
      <div className="w-full max-w-[480px] rounded-none sm:rounded-2xl bg-white border-t border-gray-200 px-4 py-3 sm:px-6 sm:py-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex flex-col">
            <span className="text-xs uppercase tracking-wide text-gray-500">Корзина</span>
            <span className="text-lg sm:text-xl font-semibold text-gray-900">
              {itemCount} {itemCount === 1 ? 'блюдо' : itemCount < 5 ? 'блюда' : 'блюд'} · {total.toFixed(2)} {currency}
            </span>
            {isBelowMinimum && (
              <span className="text-xs text-yellow-700 mt-1">
                Минимальный заказ {minAmount} {currency}. Добавьте {(minAmount - total).toFixed(2)} {currency}
              </span>
            )}
          </div>
          <button
            onClick={handleCheckout}
            disabled={isCheckingOut || isBelowMinimum}
            className="flex items-center gap-2 rounded-xl bg-primary-600 px-4 py-2.5 text-white font-semibold shadow-md hover:bg-primary-700 disabled:opacity-60 disabled:cursor-not-allowed transition"
          >
            {isCheckingOut ? 'Оформляем...' : 'Оформить'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Cart;