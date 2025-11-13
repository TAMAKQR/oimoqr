import { useState, useEffect } from 'react';
import { useCartStore } from '../store/cartStore';
import api from '../services/api';
import toast from 'react-hot-toast';

const Cart = ({ restaurant }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showOrderNumber, setShowOrderNumber] = useState(null);
  // Новое состояние для экрана успеха
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [whatsappLink, setWhatsappLink] = useState('');
  const [isCheckingLocation, setIsCheckingLocation] = useState(false);
  
  // Данные клиента и доставки
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [userLocation, setUserLocation] = useState(null); // { latitude, longitude }
  const [deliveryCheck, setDeliveryCheck] = useState(null); // Результат проверки доставки
  
  const { items, removeItem, updateQuantity, getTotal, getItemCount, clearCart } = useCartStore();
  const currency = restaurant?.currency || '₽';

  // Функция определения местоположения
  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Ваш браузер не поддерживает геолокацию');
      return;
    }

    setIsCheckingLocation(true);
    setDeliveryCheck(null);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        setUserLocation({ latitude, longitude });

        // Проверяем доступность доставки
        try {
          const response = await api.get('/geolocation/check-delivery', {
            params: {
              restaurantId: restaurant.id,
              latitude,
              longitude
            }
          });

          setDeliveryCheck(response.data);
          setIsCheckingLocation(false);
        } catch (error) {
          console.error('Error checking delivery:', error);
          toast.error('Ошибка проверки доставки');
          setIsCheckingLocation(false);
        }
      },
      (error) => {
        console.error('Geolocation error:', error);
        let errorMessage = 'Не удалось определить местоположение';
        
        if (error.code === error.PERMISSION_DENIED) {
          errorMessage = 'Доступ к геолокации запрещен. Разрешите доступ в настройках браузера.';
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          errorMessage = 'Информация о местоположении недоступна';
        } else if (error.code === error.TIMEOUT) {
          errorMessage = 'Время запроса местоположения истекло';
        }
        
        toast.error(errorMessage);
        setIsCheckingLocation(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  };

  // Автоматическое определение местоположения при открытии корзины
  useEffect(() => {
    if (isOpen && restaurant.deliveryEnabled && !userLocation && !isCheckingLocation) {
      handleGetLocation();
    }
  }, [isOpen, restaurant.deliveryEnabled]);

  const handleCheckout = async () => {
    if (items.length === 0) return;

    const total = getTotal();
    
    if (restaurant.minOrderAmount && total < restaurant.minOrderAmount) {
      toast.error(`Минимальная сумма заказа: ${restaurant.minOrderAmount} ${currency}\nТекущая сумма: ${total} ${currency}`);
      return;
    }

    // Если доставка включена - требуем данные
    if (restaurant.deliveryEnabled) {
      if (!customerName.trim()) {
        toast.error('Пожалуйста, укажите ваше имя');
        return;
      }
      if (!customerPhone.trim()) {
        toast.error('Пожалуйста, укажите ваш телефон');
        return;
      }
      if (!deliveryAddress.trim()) {
        toast.error('Пожалуйста, укажите адрес доставки');
        return;
      }
      if (!userLocation) {
        toast.error('Пожалуйста, определите ваше местоположение');
        return;
      }
      if (!deliveryCheck || !deliveryCheck.deliveryAvailable) {
        toast.error('Доставка по вашему адресу недоступна. Вы находитесь вне зоны доставки.');
        return;
      }
    }

    setIsLoading(true);
    try {
      const orderItems = items.map((item) => ({
        quantity: item.quantity,
        name: item.dish.name,
        price: item.totalPrice,
        modifiers: item.modifiers.map(m => m.name)
      }));

      const orderData = {
        restaurantId: restaurant.id,
        items: orderItems,
        total: parseFloat(getTotal().toFixed(2))
      };

      // Добавляем данные доставки если включена
      if (restaurant.deliveryEnabled) {
        orderData.customerName = customerName;
        orderData.customerPhone = customerPhone;
        orderData.deliveryAddress = deliveryAddress;
        orderData.deliveryLatitude = userLocation.latitude;
        orderData.deliveryLongitude = userLocation.longitude;
      }

      const response = await api.post('/orders', orderData);
      const orderNumber = response.data.orderNumber;

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
      
      let message = `Здравствуйте! Мой номер заказа: ${orderNumber}\n\nРесторан: ${restaurantInfo}\n\n`;
      
      // Добавляем данные доставки если включена
      if (restaurant.deliveryEnabled) {
        message += `👤 Имя: ${customerName}\n📱 Телефон: ${customerPhone}\n📍 Адрес доставки: ${deliveryAddress}\n🚗 Расстояние: ${deliveryCheck.distance} км\n\n`;
      }
      
      message += `Хочу сделать заказ:\n\n${orderText}\n\nИтого: ${total} ${currency}`;
      
      // Добавляем стоимость доставки если есть
      if (restaurant.deliveryEnabled && restaurant.deliveryFee) {
        message += `\nДоставка: ${restaurant.deliveryFee} ${currency}`;
      }

      const whatsappNumber = restaurant.whatsapp?.replace(/\D/g, '');
      const whatsappUrl = `https://api.whatsapp.com/send?phone=${whatsappNumber}&text=${encodeURIComponent(message)}`;

      // --- ИЗМЕНЕНИЕ ---
      // Вместо window.open, сохраняем ссылку и показываем экран успеха
      setWhatsappLink(whatsappUrl);
      setOrderSuccess(true);
      clearCart();
      
      // Сброс формы
    } catch (error) {
      console.error('Error creating order:', error);
      toast.error('Ошибка при создании заказа');
    } finally {
      setIsLoading(false);
    }
  };

  // Функция для закрытия модального окна и сброса состояний
  const handleCloseModal = () => {
    setIsOpen(false);
    setOrderSuccess(false); // Сбрасываем экран успеха
    setWhatsappLink('');
    setCustomerName('');
    setCustomerPhone('');
    setDeliveryAddress('');
    setUserLocation(null);
    setDeliveryCheck(null);
  };

  const itemCount = getItemCount();
  const total = getTotal();
  const minAmount = restaurant?.minOrderAmount;
  const isBelowMinimum = minAmount && total < minAmount;

  return (
    <>
      {/* Cart Button */}
      {itemCount > 0 && <button
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
      </button>}

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
              <p className="text-sm text-gray-500">Спасибо за заказ, скоро с Вами свяжутся</p>
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
                <h2 className="text-xl sm:text-2xl font-bold">
                  {orderSuccess ? 'Заказ создан' : 'Корзина'}
                </h2>
                <button
                  onClick={handleCloseModal}
                  className="text-gray-500 hover:text-gray-700 p-2 -mr-2"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              {orderSuccess ? (
                // --- ЭКРАН УСПЕХА ---
                <div className="text-center p-4 sm:p-8 flex flex-col items-center">
                  <h2 className="text-2xl font-bold text-green-600 mb-4">✅ Заказ успешно создан!</h2>
                  <p className="text-gray-700 mb-6 max-w-sm">
                    Чтобы подтвердить и отправить заказ, пожалуйста, свяжитесь с рестораном в WhatsApp.
                  </p>
                  <a
                    href={whatsappLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={handleCloseModal} // Закрываем модалку после клика
                    className="btn-primary inline-flex items-center justify-center text-lg w-full"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2" viewBox="0 0 24 24" fill="currentColor"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.487 5.235 3.487 8.413 0 6.557-5.338 11.892-11.894 11.892-1.99 0-3.903-.52-5.687-1.475l-6.351 1.687zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 4.315 1.731 6.086l.001.004l-1.217 4.438 4.535-1.207z" /></svg>
                    Перейти в WhatsApp
                  </a>
                </div>
              ) : (
                // --- ОБЫЧНЫЙ ЭКРАН КОРЗИНЫ ---
                items.length === 0 ? (
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
                      {/* Форма доставки - только если включена */}
                      {restaurant.deliveryEnabled && (
                        <div className="mb-4 space-y-3">
                          <h3 className="font-semibold text-base sm:text-lg">Данные для доставки:</h3>
                          
                          <input
                            type="text"
                            placeholder="Ваше имя *"
                            value={customerName}
                            onChange={(e) => setCustomerName(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm sm:text-base"
                          />
                          
                          <input
                            type="tel"
                            placeholder="Ваш телефон *"
                            value={customerPhone}
                            onChange={(e) => setCustomerPhone(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm sm:text-base"
                          />
                          
                          <input
                            type="text"
                            placeholder="Адрес доставки *"
                            value={deliveryAddress}
                            onChange={(e) => setDeliveryAddress(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm sm:text-base"
                          />
                          
                          {/* Статус автоматического определения местоположения */}
                          {isCheckingLocation && (
                            <div className="p-3 bg-blue-50 border-l-4 border-blue-500 text-blue-700 rounded-lg text-sm flex items-center gap-2">
                              <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                              <span>📍 Определяем ваше местоположение...</span>
                            </div>
                          )}
                          
                          {/* Результат проверки доставки */}
                          {deliveryCheck && (
                            <div className={`p-3 rounded-lg text-sm ${
                              deliveryCheck.deliveryAvailable 
                                ? 'bg-green-100 border-l-4 border-green-500 text-green-700' 
                                : 'bg-red-100 border-l-4 border-red-500 text-red-700'
                            }`}>
                              <p className="font-semibold flex items-center gap-2">
                                {deliveryCheck.deliveryAvailable ? '✅' : '❌'} {deliveryCheck.message}
                              </p>
                              <p className="text-xs mt-1">
                                Расстояние: {deliveryCheck.distance} км
                                {deliveryCheck.deliveryRadius && ` (макс. ${deliveryCheck.deliveryRadius} км)`}
                              </p>
                              {deliveryCheck.deliveryAvailable && restaurant.deliveryFee && (
                                <p className="text-xs mt-1">
                                  Стоимость доставки: {restaurant.deliveryFee} {currency}
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                      
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
                )
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Cart;