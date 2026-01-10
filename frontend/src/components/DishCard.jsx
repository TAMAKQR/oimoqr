import { useState, useEffect } from 'react';
import DishModal from './DishModal';
import { useCartStore } from '../store/cartStore';
import customerService from '../services/customerService';

const DishCard = ({ dish, currency = '₽', style = 'horizontal', onFavoriteToggle }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [isFavorite, setIsFavorite] = useState(Boolean(dish?.isFavorite));
  const [favoriteLoading, setFavoriteLoading] = useState(false);
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

  useEffect(() => {
    setIsFavorite(Boolean(dish?.isFavorite));
  }, [dish?.id, dish?.isFavorite]);

  const toggleFavorite = async () => {
    if (!customerService.isAuthenticated()) {
      onFavoriteToggle?.('login');
      return;
    }

    setFavoriteLoading(true);
    try {
      if (isFavorite) {
        await customerService.removeFromFavorites(dish.id);
        setIsFavorite(false);
        onFavoriteToggle?.('removed');
      } else {
        await customerService.addToFavorites(dish.id);
        setIsFavorite(true);
        onFavoriteToggle?.('added');
      }
    } catch (error) {
      console.error('Error toggling favorite:', error);
    } finally {
      setFavoriteLoading(false);
    }
  };

  // Обработчик клика на кнопку "+"
  const handleAddClick = (e) => {
    e.stopPropagation(); // Предотвращаем открытие модального окна

    if (!isAvailable || isAdding) return;

    const dishPrice = parseFloat(dish.price) || 0;

    // Если есть модификаторы ИЛИ цена блюда = 0 (обязательный выбор модификаторов) - открываем модальное окно
    if (hasModifiers || dishPrice === 0) {
      setIsModalOpen(true);
    } else {
      // Если нет модификаторов И цена > 0 - сразу добавляем в корзину с анимацией
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

  // Обработчик избранного
  const handleFavoriteClick = async (e) => {
    e.stopPropagation();

    toggleFavorite();
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
          className={`card transition-all duration-200 relative ${isAvailable
            ? 'cursor-pointer hover:shadow-lg active:scale-98'
            : 'opacity-60 cursor-not-allowed'
            }`}
        >
          {/* Плашки в правом верхнем углу */}
          <div className="absolute top-2 right-2 z-10 flex flex-col gap-1 items-end">
            {/* Favorite button */}
            <button
              onClick={handleFavoriteClick}
              disabled={favoriteLoading}
              className="bg-white/90 backdrop-blur-sm rounded-full p-2.5 shadow-md hover:bg-white transition-colors"
              title={isFavorite ? 'Удалить из избранного' : 'Добавить в избранное'}
            >
              {favoriteLoading ? (
                <svg className="w-5 h-5 text-gray-400 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : (
                <svg
                  className={`w-5 h-5 transition-colors ${isFavorite ? 'text-red-500 fill-current' : 'text-gray-400'}`}
                  fill={isFavorite ? 'currentColor' : 'none'}
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
              )}
            </button>

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
                  className={`w-20 h-20 sm:w-28 sm:h-28 object-cover rounded-lg flex-shrink-0 ${!isAvailable ? 'grayscale' : ''
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
                    className={`w-10 h-10 sm:w-12 sm:h-12 flex-shrink-0 flex items-center justify-center bg-primary-600 hover:bg-primary-700 text-white rounded-full text-2xl font-light transition-all shadow-md active:scale-95 ${isAdding ? 'animate-spin-once' : ''
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
          isFavorite={isFavorite}
          onToggleFavorite={toggleFavorite}
          favoriteLoading={favoriteLoading}
        />
      </>
    );
  }

  // Вертикальный стиль (фото сверху)
  if (style === 'vertical') {
    return (
      <>
        <div
          onClick={handleCardClick}
          className={`overflow-hidden rounded-lg border border-gray-200 bg-white transition-all duration-200 ${isAvailable
            ? 'cursor-pointer hover:shadow-lg active:scale-98'
            : 'opacity-60 cursor-not-allowed'
            }`}
        >
          {dish.image && (
            <div className="relative">
              <img
                src={dish.image}
                alt={dish.name}
                className={`w-full h-40 sm:h-48 object-cover ${!isAvailable ? 'grayscale' : ''
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
                  className={`w-10 h-10 sm:w-12 sm:h-12 flex-shrink-0 flex items-center justify-center bg-primary-600 hover:bg-primary-700 text-white rounded-full text-2xl font-light transition-all shadow-md active:scale-95 ${isAdding ? 'animate-spin-once' : ''
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
          isFavorite={isFavorite}
          onToggleFavorite={toggleFavorite}
          favoriteLoading={favoriteLoading}
        />
      </>
    );
  }

  // Стиль сетки 2 колонки (компактный)
  return (
    <>
      <div
        onClick={handleCardClick}
        className={`overflow-hidden rounded-lg border border-gray-200 bg-white transition-all duration-200 ${isAvailable
          ? 'cursor-pointer hover:shadow-lg active:scale-98'
          : 'opacity-60 cursor-not-allowed'
          }`}
      >
        {/* Image */}
        {dish.image && (
          <div className="relative aspect-square">
            <img
              src={dish.image}
              alt={dish.name}
              className="w-full h-full object-cover"
            />

            {/* Badges overlay */}
            <div className="absolute top-1 left-1 flex flex-col gap-1">
              {dish.badge && (
                <span className="px-2 py-0.5 bg-gradient-to-br from-orange-400 to-red-500 text-white text-[10px] font-bold rounded shadow-lg">
                  {dish.badge}
                </span>
              )}
              {!isAvailable && (
                <span className="px-2 py-0.5 bg-red-500 text-white text-[10px] font-bold rounded shadow-lg">
                  НЕТ
                </span>
              )}
              {dish.discount && isAvailable && (
                <span className="px-2 py-0.5 bg-green-500 text-white text-[10px] font-bold rounded shadow-lg">
                  -{dish.discount}%
                </span>
              )}
            </div>

            {/* Favorite button */}
            <button
              onClick={handleFavoriteClick}
              disabled={favoriteLoading}
              className="absolute top-1 right-1 bg-white/90 backdrop-blur-sm rounded-full p-2 shadow-md hover:bg-white transition-colors"
            >
              {favoriteLoading ? (
                <svg className="w-4 h-4 text-gray-400 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : (
                <svg
                  className={`w-4 h-4 transition-colors ${isFavorite ? 'text-red-500 fill-current' : 'text-gray-400'}`}
                  fill={isFavorite ? 'currentColor' : 'none'}
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
              )}
            </button>
          </div>
        )}

        {/* Content */}
        <div className="p-2">
          <h3 className="font-semibold text-sm line-clamp-2 mb-1">{dish.name}</h3>

          {dish.description && (
            <p className="text-xs text-gray-600 line-clamp-2 mb-2">{dish.description}</p>
          )}

          {/* Allergens */}
          {allergens.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2">
              {allergens.map((allergen) => (
                <span
                  key={allergen}
                  className="text-xs"
                  title={allergenNames[allergen]}
                >
                  {allergenIcons[allergen]}
                </span>
              ))}
            </div>
          )}

          {/* Price and Add Button */}
          <div className="flex items-center justify-between mt-2">
            <div className="flex flex-col">
              {dish.discount && isAvailable ? (
                <>
                  <span className="text-[10px] text-gray-400 line-through">
                    {originalPrice.toFixed(2)}
                  </span>
                  <span className="text-sm font-bold text-red-600">
                    {discountedPrice.toFixed(2)} {currency}
                  </span>
                </>
              ) : (
                <span className="text-sm font-bold text-primary-600">
                  {originalPrice.toFixed(2)} {currency}
                </span>
              )}
            </div>

            {isAvailable ? (
              <button
                onClick={handleAddClick}
                className={`w-7 h-7 flex items-center justify-center bg-primary-600 hover:bg-primary-700 text-white rounded-full text-lg font-light transition-all shadow-md active:scale-95 ${isAdding ? 'animate-spin-once' : ''}`}
              >
                +
              </button>
            ) : (
              <button
                disabled
                className="w-7 h-7 flex items-center justify-center bg-gray-300 text-gray-500 rounded-full text-lg cursor-not-allowed"
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
        isFavorite={isFavorite}
        onToggleFavorite={toggleFavorite}
        favoriteLoading={favoriteLoading}
      />
    </>
  );
};

export default DishCard;