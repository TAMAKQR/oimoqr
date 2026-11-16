import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useCartStore } from '../store/cartStore';
import { useCustomerAuthStore } from '../store/customerAuthStore';
import { getBusinessType } from '../utils/businessTypes';
import { Button } from './ui/Button';

const Cart = ({ restaurant, isDishModalOpen = false, hideOnDesktop = false }) => {
  const { customer } = useCustomerAuthStore();
  const navigate = useNavigate();
  const [isCheckingOut, setIsCheckingOut] = useState(false);

  const { items, getTotal, getItemCount, restaurantId: cartRestaurantId, orderMode, tableNumber } = useCartStore();
  const currency = restaurant?.currency || '₽';
  const businessTypeCfg = getBusinessType(restaurant?.businessType);
  const isHotel = businessTypeCfg.key === 'HOTEL';

  // Не показывать корзину, если она принадлежит другому ресторану
  const isCartForCurrentRestaurant = !cartRestaurantId || !restaurant?.id || cartRestaurantId === restaurant.id;

  const total = getTotal();
  const itemCount = getItemCount();
  const minAmount = restaurant?.minOrderAmount;
  const isBelowMinimum = orderMode === 'delivery' && minAmount && total < minAmount;
  const needsFulfillmentChoice = orderMode !== 'dine_in' && orderMode !== 'delivery' && orderMode !== 'pickup';

  const [isTrackVisible, setIsTrackVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsTrackVisible(true), 10);
    return () => clearTimeout(timer);
  }, []);

  const handleCheckout = async () => {
    if (!items.length) return;

    if (needsFulfillmentChoice) {
      toast.error('Выберите способ получения: доставка или самовывоз');
      return;
    }

    if (isBelowMinimum) {
      toast.error(`Минимальная сумма заказа: ${minAmount} ${currency}\nТекущая сумма: ${total} ${currency}`);
      return;
    }

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

  if (!itemCount || isDishModalOpen || !isCartForCurrentRestaurant) {
    return null;
  }

  const responsiveHideClass = hideOnDesktop ? 'lg:hidden' : '';

  const isCustomerLoggedIn = customer && customer.id;

  const bottomNavHeight = 'var(--customer-bottom-nav-height, 0px)';
  const guestBottomOffset = 'max(0px, calc(max(env(safe-area-inset-bottom, 0px), var(--visual-bottom-offset, 0px)) - 6px))';
  const cartStyle = isCustomerLoggedIn
    ? { bottom: `calc(${bottomNavHeight} + 8px)` }
    : { bottom: guestBottomOffset };

  const dineInLabel = isHotel
    ? (tableNumber ? `${businessTypeCfg.tableLabel} ${tableNumber}` : 'В номер')
    : (tableNumber ? `${businessTypeCfg.tableLabel} ${tableNumber}` : 'В зале');

  return (
    <>
      {!isCustomerLoggedIn && (
        <div
          className={`fixed inset-x-0 bottom-0 z-[50] bg-white/70 backdrop-blur-md pointer-events-none ${responsiveHideClass}`}
          style={{ height: guestBottomOffset }}
        />
      )}
      <div className={`fixed inset-x-0 z-[60] flex justify-center px-0 pb-0 ${responsiveHideClass}`} style={cartStyle}>
        <div className="w-full max-w-[480px] rounded-none sm:rounded-2xl bg-white border-t border-neutral-200 px-4 py-3 sm:px-6 sm:py-4 shadow-lg">
          <div className="flex flex-col gap-3">
            {orderMode === 'dine_in' && (
              <div className="flex items-center gap-2 text-sm">
                <span className="flex items-center gap-1.5 bg-primary-50 text-primary-600 px-3 py-1.5 rounded-full font-medium border border-primary-100">
                  {dineInLabel}
                </span>
              </div>
            )}

            <div className="flex flex-col gap-2">
              <Button
                type="button"
                onClick={handleCheckout}
                disabled={isCheckingOut || needsFulfillmentChoice || isBelowMinimum}
                variant={isBelowMinimum || needsFulfillmentChoice ? 'secondary' : 'primary'}
                size="lg"
              >
                {isCheckingOut ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm0 0V12" />
                    </svg>
                    Оформляем…
                  </>
                ) : orderMode === 'dine_in'
                  ? `Заказать на ${total.toFixed(2)} ${currency}`
                  : `Оформить на ${total.toFixed(2)} ${currency}`}
              </Button>
              {needsFulfillmentChoice && (
                <p className="text-xs text-neutral-500 text-center">
                  Выберите способ получения: доставка или самовывоз
                </p>
              )}
              {isBelowMinimum && (
                <p className="text-xs text-error-600 text-center font-medium">
                  Минимальная сумма: {minAmount} {currency}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Cart;
