import { useState } from 'react';
import DishModal from './DishModal';
import { useCartStore } from '../store/cartStore';

const DishCard = ({ dish, currency = '₽', style = 'horizontal' }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const addItem = useCartStore((state) => state.addItem);
  const isAvailable = dish.isAvailable !== false; // По умолчанию true если поле отсутствует
  const hasModifiers = dish.modifiers && dish.modifiers.length > 0;

  // Иконки аллергенов
  const allergenIcons = {
    gluten: '🌾',
    dairy: '🥛',
    nuts: '🥜',
    eggs: '🥚',
    fish: '🐟',
    shellfish: '🦐',
    soy: '🫘',
    sesame: '🌰'
  };

  const allergenNames = {
    gluten: 'Глютен',
    dairy: 'Молоко',
    nuts: 'Орехи',
    eggs: 'Яйца',
    fish: 'Рыба',
    shellfish: 'Морепродукты',
    soy: 'Соя',
    sesame: 'Кунжут'
  };

  // Парсим аллергены из JSON строки
  const allergens = dish.allergens ? JSON.parse(dish.allergens) : [];

  // Обработчик клика на кнопку "+"
  const handleAddClick = (e) => {
    e.stopPropagation(); // Предотвращаем открытие модального окна
    
    if (!isAvailable || isAdding) return;
    
    // Если есть модификаторы - открываем модальное окно
    if (hasModifiers) {
      setIsModalOpen(true);
    } else {
      // Если нет модификаторов - сразу добавляем в корзину с анимацией
      setIsAdding(true);
      addItem(dish, []);
      
      // Сбрасываем анимацию через 600ms (время вращения)
      setTimeout(() => {
        setIsAdding(false);
      }, 600);
    }
  };

  // Обработчик клика на карточку
  const handleCardClick = () => {
    if (isAvailable) {
      setIsModalOpen(true);
    }
  };

  // Вычисляем цену со скидкой
  const originalPrice = parseFloat(dish.price) || 0;
  const discountedPrice = dish.discount 
    ? originalPrice * (1 - dish.discount / 100) 
    : originalPrice;

  // Горизонтальный стиль (фото слева)
  if (style === 'horizontal') {
    return (
      <>
        <div
          onClick={handleCardClick}
          className={`card transition-all duration-200 relative ${
            isAvailable 
              ? 'cursor-pointer hover:shadow-lg active:scale-98' 
              : 'opacity-60 cursor-not-allowed'
          }`}
        >
          {/* Плашки в правом верхнем углу */}
          <div className="absolute top-2 right-2 z-10 flex flex-col gap-1 items-end">
            {dish.badge && (
              <span className="px-3 py-1 bg-gradient-to-br from-orange-400 to-red-500 text-white text-xs font-bold rounded-full shadow-lg">
                {dish.badge}
              </span>
            )}
            {!isAvailable && (
              <span className="px-3 py-1 bg-red-500 text-white text-xs font-bold rounded-full shadow-lg">
                НЕТ В НАЛИЧИИ
              </span>
            )}
            {dish.discount && isAvailable && (
              <span className="px-3 py-1 bg-red-500 text-white text-xs font-bold rounded-full shadow-lg">
                -{dish.discount}%
              </span>
            )}
          </div>

          <div className="flex gap-3 sm:gap-4">
            {/* Фото слева */}
            {dish.image && (
              <div className="relative">
                <img
                  src={dish.image}
                  alt={dish.name}
                  className={`w-20 h-20 sm:w-28 sm:h-28 object-cover rounded-lg flex-shrink-0 ${
                    !isAvailable ? 'grayscale' : ''
                  }`}
                />
              </div>
            )}
            
            {/* Информация справа */}
            <div className="flex-1 flex flex-col justify-between min-w-0">
              <div>
                <h3 className="text-base sm:text-lg font-semibold mb-1 line-clamp-2 break-words">{dish.name}</h3>
                {dish.description && (
                  <p className="text-gray-600 text-xs sm:text-sm mb-2 line-clamp-2 break-words">
                    {dish.description}
                  </p>
                )}
                
                {/* Аллергены */}
                {allergens.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-2">
                    {allergens.map((allergen) => (
                      <span
                        key={allergen}
                        className="inline-flex items-center gap-1 px-2 py-0.5 bg-orange-100 text-orange-800 text-xs rounded-full"
                        title={allergenNames[allergen]}
                      >
                        {allergenIcons[allergen]} {allergenNames[allergen]}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              
              <div className="flex flex-row justify-between items-center gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  {dish.discount ? (
                    <>
                      <span className="text-sm text-gray-400 line-through">
                        {originalPrice.toFixed(2)} {currency}
                      </span>
                      <span className="text-lg sm:text-xl font-bold text-red-600 whitespace-nowrap">
                        {discountedPrice.toFixed(2)} {currency}
                      </span>
                    </>
                  ) : (
                    <span className="text-lg sm:text-xl font-bold text-primary-600 whitespace-nowrap">
                      {originalPrice.toFixed(2)} {currency}
                    </span>
                  )}
                </div>
                {isAvailable ? (
                  <button 
                    onClick={handleAddClick}
                    className={`w-10 h-10 sm:w-12 sm:h-12 flex-shrink-0 flex items-center justify-center bg-primary-600 hover:bg-primary-700 text-white rounded-full text-2xl font-light transition-all shadow-md active:scale-95 ${
                      isAdding ? 'animate-spin-once' : ''
                    }`}
                    aria-label="Добавить в корзину"
                  >
                    +
                  </button>
                ) : (
                  <button 
                    disabled 
                    className="w-10 h-10 sm:w-12 sm:h-12 flex-shrink-0 flex items-center justify-center bg-gray-300 text-gray-500 rounded-full text-2xl font-light cursor-not-allowed"
                    aria-label="Недоступно"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        <DishModal
          dish={dish}
          currency={currency}
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
        />
      </>
    );
  }

  // Вертикальный стиль (фото сверху)
  return (
    <>
      <div
        onClick={handleCardClick}
        className={`overflow-hidden rounded-lg border border-gray-200 bg-white transition-all duration-200 ${
          isAvailable 
            ? 'cursor-pointer hover:shadow-lg active:scale-98' 
            : 'opacity-60 cursor-not-allowed'
        }`}
      >
        {dish.image && (
          <div className="relative">
            <img
              src={dish.image}
              alt={dish.name}
              className={`w-full h-40 sm:h-48 object-cover ${
                !isAvailable ? 'grayscale' : ''
              }`}
            />
            {/* Плашки в правом верхнем углу */}
            <div className="absolute top-2 right-2 z-10 flex flex-col gap-1 items-end">
              {dish.badge && (
                <span className="px-3 py-1 bg-gradient-to-br from-orange-400 to-red-500 text-white text-xs font-bold rounded-full shadow-lg">
                  {dish.badge}
                </span>
              )}
              {!isAvailable && (
                <span className="px-3 py-1 bg-red-500 text-white text-xs font-bold rounded-full shadow-lg">
                  НЕТ В НАЛИЧИИ
                </span>
              )}
              {dish.discount && isAvailable && (
                <span className="px-3 py-1 bg-red-500 text-white text-xs font-bold rounded-full shadow-lg">
                  -{dish.discount}%
                </span>
              )}
            </div>
          </div>
        )}
        
        <div className="p-4 sm:p-6">
          <h3 className="text-base sm:text-lg font-semibold mb-2 break-words">{dish.name}</h3>
          {dish.description && (
            <p className="text-gray-600 text-xs sm:text-sm mb-3 line-clamp-2 break-words">
              {dish.description}
            </p>
          )}
          
          {/* Аллергены */}
          {allergens.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-3">
              {allergens.map((allergen) => (
                <span
                  key={allergen}
                  className="inline-flex items-center gap-1 px-2 py-0.5 bg-orange-100 text-orange-800 text-xs rounded-full"
                  title={allergenNames[allergen]}
                >
                  {allergenIcons[allergen]} {allergenNames[allergen]}
                </span>
              ))}
            </div>
          )}

          <div className="flex flex-row justify-between items-center gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              {dish.discount ? (
                <>
                  <span className="text-sm text-gray-400 line-through">
                    {originalPrice.toFixed(2)} {currency}
                  </span>
                  <span className="text-lg sm:text-xl font-bold text-red-600 whitespace-nowrap">
                    {discountedPrice.toFixed(2)} {currency}
                  </span>
                </>
              ) : (
                <span className="text-lg sm:text-xl font-bold text-primary-600 whitespace-nowrap">
                  {originalPrice.toFixed(2)} {currency}
                </span>
              )}
            </div>
            {isAvailable ? (
              <button 
                onClick={handleAddClick}
                className={`w-10 h-10 sm:w-12 sm:h-12 flex-shrink-0 flex items-center justify-center bg-primary-600 hover:bg-primary-700 text-white rounded-full text-2xl font-light transition-all shadow-md active:scale-95 ${
                  isAdding ? 'animate-spin-once' : ''
                }`}
                aria-label="Добавить в корзину"
              >
                +
              </button>
            ) : (
              <button 
                disabled 
                className="w-10 h-10 sm:w-12 sm:h-12 flex-shrink-0 flex items-center justify-center bg-gray-300 text-gray-500 rounded-full text-2xl font-light cursor-not-allowed"
                aria-label="Недоступно"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      </div>

      <DishModal
        dish={dish}
        currency={currency}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </>
  );
};

export default DishCard;