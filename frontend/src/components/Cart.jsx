import { useState } from 'react';
import { useCartStore } from '../store/cartStore';
import api from '../services/api';

const Cart = ({ restaurant }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showOrderNumber, setShowOrderNumber] = useState(null);
  const { items, removeItem, updateQuantity, getTotal, getItemCount, clearCart } = useCartStore();
  const currency = restaurant?.currency || '₽';

  const handleCheckout = async () => {
    if (items.length === 0) return;

    const total = getTotal();
    
    if (restaurant.minOrderAmount && total < restaurant.minOrderAmount) {
      alert(`Минимальная сумма заказа: ${restaurant.minOrderAmount} ${currency}\nТекущая сумма: ${total} ${currency}`);
      return;
    }

    setIsLoading(true);
    try {
      const orderItems = items.map((item) => ({
        quantity: item.quantity,
        name: item.dish.name,
        price: item.totalPrice,
        modifiers: item.modifiers.map(m => m.name)
      }));

      const response = await api.post('/orders', {
        restaurantId: restaurant.id,
        items: orderItems,
        total: parseFloat(getTotal().toFixed(2))
      });

      const orderNumber = response.data.orderNumber;
      setShowOrderNumber(orderNumber);

      const orderText = items
        .map((item) => {
          const modifiersText = item.modifiers.length > 0
            ? ` (${item.modifiers.map((m) => m.name).join(', ')})`
            : '';
          const itemTotal = (item.totalPrice * item.quantity).toFixed(2);
          return `${item.quantity}x ${item.dish.name}${modifiersText} - ${itemTotal} ${currency}`;
        })
        .join('\n');

      const total = getTotal().toFixed(2);
      const restaurantInfo = `${restaurant.name}${restaurant.address ? ` (${restaurant.address})` : ''}`;
      const message = `Здравствуйте! Мой номер заказа: ${orderNumber}\n\nРесторан: ${restaurantInfo}\n\nХочу сделать заказ:\n\n${orderText}\n\nИтого: ${total} ${currency}`;

      const whatsappNumber = restaurant.whatsapp?.replace(/\D/g, '');
      const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`;

      window.open(whatsappUrl, '_blank');
      clearCart();
      setIsOpen(false);
    } catch (error) {
      console.error('Error creating order:', error);
      alert('Ошибка при создании заказа');
    } finally {
      setIsLoading(false);
    }
  };

  const itemCount = getItemCount();
  const total = getTotal();
  const minAmount = restaurant?.minOrderAmount;
  const isBelowMinimum = minAmount && total < minAmount;

  return (
    <>
      {/* Cart Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 bg-primary-600 text-white rounded-full p-3 sm:p-4 shadow-lg hover:bg-primary-700 transition-all active:scale-95 z-40"
      >
        <svg
          className="w-5 h-5 sm:w-6 sm:h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
          />
        </svg>
        {itemCount > 0 && (
          <span className="absolute -top-1 -right-1 sm:-top-2 sm:-right-2 bg-red-500 text-white rounded-full w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center text-xs font-bold">
            {itemCount}
          </span>
        )}
      </button>

      {/* Order Number Modal */}
      {showOrderNumber && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 sm:p-8 max-w-md w-full text-center">
            <button
              onClick={() => setShowOrderNumber(null)}
              className="absolute top-4 right-4 text-gray-500 hover:text-gray-700"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <div className="mb-4">
              <svg className="w-16 h-16 sm:w-20 sm:h-20 mx-auto text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-xl sm:text-2xl font-bold mb-2">Заказ создан!</h3>
            <p className="text-gray-600 mb-4">Ваш номер заказа:</p>
            <p className="text-3xl sm:text-4xl font-bold text-primary-600 mb-6 font-mono">{showOrderNumber}</p>
            <div className="space-y-3">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(showOrderNumber);
                  alert('Номер заказа скопирован в буфер обмена');
                }}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
              >
                📋 Копировать номер
              </button>
              <p className="text-sm text-gray-500">Сейчас откроется WhatsApp с деталями заказа</p>
              <button
                onClick={() => setShowOrderNumber(null)}
                className="w-full bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-2 px-4 rounded-lg transition-colors"
              >
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cart Modal */}
      {isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-white w-full sm:max-w-2xl sm:rounded-lg max-h-[95vh] sm:max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl">
            <div className="p-4 sm:p-6">
              <div className="flex justify-between items-center mb-4 sm:mb-6">
                <h2 className="text-xl sm:text-2xl font-bold">Корзина</h2>
                <button
                  onClick={() => setIsOpen(false)}
                  className="text-gray-500 hover:text-gray-700 p-2 -mr-2"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {items.length === 0 ? (
                <p className="text-center text-gray-500 py-8 text-sm sm:text-base">Корзина пуста</p>
              ) : (
                <>
                  <div className="space-y-3 sm:space-y-4 mb-4 sm:mb-6">
                    {items.map((item) => (
                      <div key={item.itemId} className="flex gap-3 sm:gap-4 border-b pb-3 sm:pb-4">
                        {item.dish.image && (
                          <img
                            src={item.dish.image}
                            alt={item.dish.name}
                            className="w-16 h-16 sm:w-20 sm:h-20 object-cover rounded flex-shrink-0"
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-sm sm:text-base break-words">{item.dish.name}</h3>
                          {item.modifiers.length > 0 && (
                            <p className="text-xs sm:text-sm text-gray-600 break-words">
                              {item.modifiers.map((m) => m.name).join(', ')}
                            </p>
                          )}
                          <p className="text-primary-600 font-semibold text-sm sm:text-base mt-1">
                            {item.totalPrice} {currency}
                          </p>
                        </div>
                        <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2">
                          <div className="flex items-center gap-1 sm:gap-2">
                            <button
                              onClick={() => updateQuantity(item.itemId, item.quantity - 1)}
                              className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gray-200 hover:bg-gray-300 active:scale-95 transition-all text-sm sm:text-base"
                            >
                              -
                            </button>
                            <span className="w-6 sm:w-8 text-center text-sm sm:text-base">{item.quantity}</span>
                            <button
                              onClick={() => updateQuantity(item.itemId, item.quantity + 1)}
                              className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gray-200 hover:bg-gray-300 active:scale-95 transition-all text-sm sm:text-base"
                            >
                              +
                            </button>
                          </div>
                          <button
                            onClick={() => removeItem(item.itemId)}
                            className="text-red-500 hover:text-red-700 p-1"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="border-t pt-4 sticky bottom-0 bg-white">
                    <div className="flex justify-between items-center mb-3 sm:mb-4">
                      <span className="text-base sm:text-lg font-semibold">Итого:</span>
                      <span className="text-xl sm:text-2xl font-bold text-primary-600">
                        {total} {currency}
                      </span>
                    </div>
                    
                    {isBelowMinimum && (
                      <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-3 mb-3 rounded text-sm">
                        <p className="font-semibold">Минимальный заказ: {minAmount} {currency}</p>
                        <p>Добавьте еще {(minAmount - total).toFixed(2)} {currency}</p>
                      </div>
                    )}
                    
                    <button
                      onClick={handleCheckout}
                      disabled={isLoading || isBelowMinimum}
                      className="w-full btn-primary py-3 text-base sm:text-lg disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isLoading ? 'Создание заказа...' : 'Оформить заказ в WhatsApp'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Cart;