import { useState } from 'react';
import { useCartStore } from '../store/cartStore';

const DishModal = ({ dish, isOpen, onClose, currency = '₽' }) => {
  const [selectedModifiers, setSelectedModifiers] = useState([]);
  const addItem = useCartStore((state) => state.addItem);
  const isAvailable = dish.available !== false; // По умолчанию true если поле отсутствует

  if (!isOpen) return null;

  const toggleModifier = (modifier) => {
    setSelectedModifiers((prev) => {
      const exists = prev.find((m) => m.id === modifier.id);
      if (exists) {
        return prev.filter((m) => m.id !== modifier.id);
      }
      return [...prev, modifier];
    });
  };

  const getTotalPrice = () => {
    const modifiersPrice = selectedModifiers.reduce((sum, m) => sum + m.price, 0);
    return parseFloat((dish.price + modifiersPrice).toFixed(2));
  };

  const handleAddToCart = () => {
    if (!isAvailable) return;
    addItem(dish, selectedModifiers);
    setSelectedModifiers([]);
    onClose();
  };

  const handleBackdropClick = (e) => {
    // Закрываем только если клик был на фоне, а не на контенте
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4"
      onClick={handleBackdropClick}
    >
      <div className="bg-white rounded-t-2xl sm:rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {dish.image && (
          <div className="relative">
            <img
              src={dish.image}
              alt={dish.name}
              className={`w-full h-64 sm:h-80 md:h-96 object-cover rounded-t-2xl sm:rounded-t-lg ${
                !isAvailable ? 'grayscale' : ''
              }`}
            />
            {/* Бейджи */}
            <div className="absolute top-3 right-3 sm:top-4 sm:right-4 flex flex-col gap-2 items-end">
              {dish.badge && (
                <span className="px-3 sm:px-4 py-1.5 sm:py-2 bg-gradient-to-br from-orange-400 to-red-500 text-white text-xs sm:text-sm font-bold rounded-full shadow-lg">
                  {dish.badge}
                </span>
              )}
              {dish.discount && isAvailable && (
                <span className="px-3 sm:px-4 py-1.5 sm:py-2 bg-red-500 text-white text-xs sm:text-sm font-bold rounded-full shadow-lg">
                  -{dish.discount}%
                </span>
              )}
            </div>
            {!isAvailable && (
              <div className="absolute inset-0 bg-black bg-opacity-40 flex items-center justify-center rounded-t-2xl sm:rounded-t-lg">
                <span className="px-4 py-2 bg-red-500 text-white text-lg font-bold rounded-full shadow-lg">
                  НЕТ В НАЛИЧИИ
                </span>
              </div>
            )}
          </div>
        )}
        
        <div className="p-4 sm:p-6">
          <div className="flex items-center gap-3 mb-2">
            <h2 className="text-xl sm:text-2xl font-bold break-words">{dish.name}</h2>
            {!isAvailable && !dish.image && (
              <span className="px-3 py-1 bg-red-500 text-white text-xs font-bold rounded-full">
                НЕТ В НАЛИЧИИ
              </span>
            )}
          </div>
          {dish.description && (
            <p className="text-gray-600 text-sm sm:text-base mb-4 break-words">{dish.description}</p>
          )}

          {dish.modifiers && dish.modifiers.length > 0 && (
            <div className="mb-6">
              <h3 className="text-base sm:text-lg font-semibold mb-3">Дополнительно:</h3>
              <div className="space-y-2">
                {dish.modifiers.map((modifier) => (
                  <label
                    key={modifier.id}
                    className="flex items-center justify-between p-3 border rounded-lg cursor-pointer hover:bg-gray-50 active:bg-gray-100 transition-colors gap-2"
                  >
                    <div className="flex items-center min-w-0 flex-1">
                      <input
                        type="checkbox"
                        checked={selectedModifiers.some((m) => m.id === modifier.id)}
                        onChange={() => toggleModifier(modifier)}
                        className="mr-2 sm:mr-3 flex-shrink-0 w-4 h-4 sm:w-5 sm:h-5"
                      />
                      <span className="text-sm sm:text-base break-words">{modifier.name}</span>
                    </div>
                    {modifier.price > 0 && (
                      <span className="text-gray-600 text-sm sm:text-base whitespace-nowrap ml-2">
                        +{parseFloat(modifier.price).toFixed(2)} {currency}
                      </span>
                    )}
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 sm:gap-0 pt-4 border-t">
            <div className="flex justify-between sm:block">
              <p className="text-xs sm:text-sm text-gray-600">Итого:</p>
              <p className="text-xl sm:text-2xl font-bold text-primary-600">
                {getTotalPrice()} {currency}
              </p>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={onClose} 
                className="w-12 h-12 flex items-center justify-center rounded-full border-2 border-gray-300 hover:bg-gray-100 active:bg-gray-200 transition-colors text-gray-600 text-2xl font-light flex-shrink-0"
                aria-label="Закрыть"
              >
                ✕
              </button>
              <button 
                onClick={handleAddToCart} 
                disabled={!isAvailable}
                className={`flex-1 flex items-center justify-center gap-2 active:scale-95 transition-transform ${
                  isAvailable 
                    ? 'btn-primary' 
                    : 'btn-secondary opacity-50 cursor-not-allowed'
                }`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M3 1a1 1 0 000 2h1.22l.305 1.222a.997.997 0 00.01.042l1.358 5.43-.893.892C3.74 11.846 4.632 14 6.414 14H15a1 1 0 000-2H6.414l1-1H14a1 1 0 00.894-.553l3-6A1 1 0 0017 3H6.28l-.31-1.243A1 1 0 005 1H3zM16 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM6.5 18a1.5 1.5 0 100-3 1.5 1.5 0 000 3z" />
                </svg>
                <span className="hidden sm:inline">{isAvailable ? 'Добавить' : 'Недоступно'}</span>
                <span className="sm:hidden">{isAvailable ? 'В корзину' : 'Недоступно'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DishModal;