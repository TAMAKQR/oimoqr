import { useState, useRef } from 'react';
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

  const startXRef = useRef(0);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const SWIPE_THRESHOLD = 70;
  const MAX_OFFSET = 90;

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

  const resetDrag = () => {
    setDragOffset(0);
    setIsDragging(false);
  };

  const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

  const handlePointerDown = (e) => {
    if (!items.length) return;
    startXRef.current = e.clientX;
    setIsDragging(true);
  };

  const handlePointerMove = (e) => {
    if (!isDragging) return;
    const delta = e.clientX - startXRef.current;
    setDragOffset(clamp(delta, -MAX_OFFSET, MAX_OFFSET));
  };

  const handlePointerEnd = async () => {
    if (!isDragging) return;
    const offset = dragOffset;
    resetDrag();

    if (offset > SWIPE_THRESHOLD) {
      await handleCheckout();
      return;
    }

    if (offset < -SWIPE_THRESHOLD) {
      const confirmClear = window.confirm('Очистить корзину?');
      if (confirmClear) {
        clearCart();
      }
      return;
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
            <div className="flex flex-col">
              <span className="text-lg sm:text-xl font-semibold text-gray-900">
                {total.toFixed(2)} {currency}
              </span>
              {isBelowMinimum && (
                <span className="text-xs text-yellow-700 mt-1">
                  Минимальный заказ {minAmount} {currency}. Добавьте {(minAmount - total).toFixed(2)} {currency}
                </span>
              )}
            </div>

            <div className="relative w-full h-12 rounded-xl bg-primary-50 border border-primary-100 overflow-hidden">
              <div className="absolute inset-y-0 left-3 flex items-center text-primary-300 text-lg select-none pointer-events-none">
                ⇠
              </div>
              <div className="absolute inset-y-0 right-3 flex items-center text-primary-300 text-lg select-none pointer-events-none">
                ⇢
              </div>
              <button
                type="button"
                onClick={(e) => e.preventDefault()}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerEnd}
                onPointerCancel={handlePointerEnd}
                disabled={isCheckingOut || isBelowMinimum}
                className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-28 h-10 rounded-full bg-primary-600 text-white font-semibold shadow-md hover:bg-primary-700 disabled:opacity-60 disabled:cursor-not-allowed transition touch-action-none select-none flex items-center justify-center"
                style={{ transform: `translate(-50%, -50%) translateX(${dragOffset}px)`, transition: isDragging ? 'none' : 'transform 0.15s ease' }}
              >
                {isCheckingOut ? '…' : '⇠  ⇢'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Cart;