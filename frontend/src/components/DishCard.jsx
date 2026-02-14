import { useState, useEffect } from 'react';
import DishModal from './DishModal';
import { useCartStore } from '../store/cartStore';
import customerService from '../services/customerService';
import { cacheBustImage } from '../utils/imageCache';
import ImageWithLoader from './ImageWithLoader';

const DishCard = ({ dish, currency = '₽', style = 'horizontal', onFavoriteToggle, onModalStateChange, restaurantId, restaurantName }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [isFavorite, setIsFavorite] = useState(Boolean(dish?.isFavorite));
  const [favoriteLoading, setFavoriteLoading] = useState(false);
  const addItem = useCartStore((state) => state.addItem);
  const isOtherRestaurant = useCartStore((state) => state.isOtherRestaurant);
  const switchRestaurant = useCartStore((state) => state.switchRestaurant);
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

  // Уведомляем родительский компонент об изменении состояния модалки
  useEffect(() => {
    if (onModalStateChange) {
      onModalStateChange(isModalOpen);
    }
  }, [isModalOpen, onModalStateChange]);

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

    // Проверяем, не из другого ли ресторана
    if (restaurantId && isOtherRestaurant(restaurantId)) {
      if (window.confirm('В корзине блюда из другого ресторана. Очистить корзину и добавить это блюдо?')) {
        switchRestaurant(restaurantId, restaurantName);
      } else {
        return;
      }
    }

    // Если есть модификаторы ИЛИ цена блюда = 0 (обязательный выбор модификаторов) - открываем модальное окно
    if (hasModifiers || dishPrice === 0) {
      setIsModalOpen(true);
    } else {
      // Если нет модификаторов И цена > 0 - сразу добавляем в корзину с анимацией
      setIsAdding(true);
      addItem(dish, [], restaurantId, restaurantName);

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

  // Вычисляем отображаемую цену
  let displayPrice = parseFloat(dish.price) || 0;
  let pricePrefix = '';

  // Если цена 0 и есть модификаторы - берем минимальную цену среди всех опций
  if (displayPrice === 0 && hasModifiers) {
    let minPrice = Infinity;
    dish.modifiers.forEach(modifier => {
      if (modifier?.options && modifier.options.length > 0) {
        modifier.options.forEach(option => {
          const optionPrice = parseFloat(option.price) || 0;
          if (optionPrice > 0 && optionPrice < minPrice) {
            minPrice = optionPrice;
          }
        });
      }
    });
    if (minPrice !== Infinity) {
      displayPrice = minPrice;
      pricePrefix = 'от ';
    }
  }

  const originalPrice = displayPrice;
  const discountedPrice = dish.discount
    ? originalPrice * (1 - dish.discount / 100)
    : originalPrice;

  // Горизонтальный стиль (фото слева)
  if (style === 'horizontal') {
    return (
      <>
        <div
          data-dish-id={dish.id}
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
            <div className="relative w-20 h-20 sm:w-28 sm:h-28 flex-shrink-0">
              {dish.image ? (
                <ImageWithLoader
                  src={cacheBustImage(dish.image)}
                  alt={dish.name}
                  loading="lazy"
                  className={`w-full h-full object-cover rounded-lg ${!isAvailable ? 'grayscale' : ''}`}
                />
              ) : (
                <div className={`w-full h-full rounded-lg bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center ${!isAvailable ? 'grayscale' : ''}`}>
                  <svg className="w-8 h-8 sm:w-10 sm:h-10 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8.25v-1.5m0 1.5c-1.355 0-2.697.056-4.024.166C6.845 8.51 6 9.473 6 10.608v2.513m6-4.871c1.355 0 2.697.056 4.024.166C17.155 8.51 18 9.473 18 10.608v2.513M15 8.25v-1.5m-6 1.5v-1.5m12 9.75l-1.5.75a3.354 3.354 0 01-3 0 3.354 3.354 0 00-3 0 3.354 3.354 0 01-3 0 3.354 3.354 0 00-3 0 3.354 3.354 0 01-3 0L3 16.5m15-3.379a48.474 48.474 0 00-6-.371c-2.032 0-4.034.126-6 .371m12 0c.39.049.777.102 1.163.16 1.07.16 1.837 1.094 1.837 2.175v5.169c0 .621-.504 1.125-1.125 1.125H4.125A1.125 1.125 0 013 20.625v-5.17c0-1.08.768-2.014 1.837-2.174A47.78 47.78 0 016 13.12M12.265 3.11a.375.375 0 11-.53 0L12 2.845l.265.265zm-3 0a.375.375 0 11-.53 0L9 2.845l.265.265zm6 0a.375.375 0 11-.53 0L15 2.845l.265.265z" />
                  </svg>
                </div>
              )}
            </div>

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
                        {pricePrefix}{originalPrice.toFixed(2)} {currency}
                      </span>
                      <span className="text-lg sm:text-xl font-bold text-red-600 whitespace-nowrap">
                        {pricePrefix}{discountedPrice.toFixed(2)} {currency}
                      </span>
                    </>
                  ) : (
                    <span className="text-lg sm:text-xl font-bold text-primary-600 whitespace-nowrap">
                      {pricePrefix}{originalPrice.toFixed(2)} {currency}
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
          restaurantId={restaurantId}
          restaurantName={restaurantName}
        />
      </>
    );
  }

  // Вертикальный стиль (фото сверху)
  if (style === 'vertical') {
    return (
      <>
        <div
          data-dish-id={dish.id}
          onClick={handleCardClick}
          className={`overflow-hidden rounded-lg border border-gray-200 bg-white transition-all duration-200 flex flex-col h-full ${isAvailable
            ? 'cursor-pointer hover:shadow-lg active:scale-98'
            : 'opacity-60 cursor-not-allowed'
            }`}
        >
          <div className="relative w-full aspect-[4/3]">
            {dish.image ? (
              <ImageWithLoader
                src={cacheBustImage(dish.image)}
                alt={dish.name}
                loading="lazy"
                className={`w-full h-full object-cover ${!isAvailable ? 'grayscale' : ''}`}
              />
            ) : (
              <div className={`w-full h-full bg-gradient-to-br from-gray-100 via-gray-50 to-gray-200 flex items-center justify-center ${!isAvailable ? 'grayscale' : ''}`}>
                <svg className="w-16 h-16 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8.25v-1.5m0 1.5c-1.355 0-2.697.056-4.024.166C6.845 8.51 6 9.473 6 10.608v2.513m6-4.871c1.355 0 2.697.056 4.024.166C17.155 8.51 18 9.473 18 10.608v2.513M15 8.25v-1.5m-6 1.5v-1.5m12 9.75l-1.5.75a3.354 3.354 0 01-3 0 3.354 3.354 0 00-3 0 3.354 3.354 0 01-3 0 3.354 3.354 0 00-3 0 3.354 3.354 0 01-3 0L3 16.5m15-3.379a48.474 48.474 0 00-6-.371c-2.032 0-4.034.126-6 .371m12 0c.39.049.777.102 1.163.16 1.07.16 1.837 1.094 1.837 2.175v5.169c0 .621-.504 1.125-1.125 1.125H4.125A1.125 1.125 0 013 20.625v-5.17c0-1.08.768-2.014 1.837-2.174A47.78 47.78 0 016 13.12M12.265 3.11a.375.375 0 11-.53 0L12 2.845l.265.265zm-3 0a.375.375 0 11-.53 0L9 2.845l.265.265zm6 0a.375.375 0 11-.53 0L15 2.845l.265.265z" />
                </svg>
              </div>
            )}
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

          <div className="p-4 sm:p-6 flex flex-col h-full">
            <div className="flex-1">
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
            </div>

            <div className="flex flex-row justify-between items-center gap-2 mt-auto">
              <div className="flex items-center gap-2 flex-wrap">
                {dish.discount ? (
                  <>
                    <span className="text-sm text-gray-400 line-through">
                      {pricePrefix}{originalPrice.toFixed(2)} {currency}
                    </span>
                    <span className="text-lg font-bold text-red-600">
                      {pricePrefix}{discountedPrice.toFixed(2)} {currency}
                    </span>
                  </>
                ) : (
                  <span className="text-lg sm:text-xl font-bold text-primary-600 whitespace-nowrap">
                    {pricePrefix}{originalPrice.toFixed(2)} {currency}
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
          restaurantId={restaurantId}
          restaurantName={restaurantName}
        />
      </>
    );
  }

  // Галерея 2 колонки (минимальные отступы, акцент на фото)
  if (style === 'gallery') {
    return (
      <>
        <div
          onClick={handleCardClick}
          className={`overflow-hidden rounded-2xl bg-white shadow-[0_10px_30px_rgba(0,0,0,0.06)] transition-all duration-200 flex flex-col h-full min-h-[320px] sm:min-h-[360px] ${isAvailable
            ? 'cursor-pointer hover:shadow-[0_12px_36px_rgba(0,0,0,0.08)] active:scale-98'
            : 'opacity-60 cursor-not-allowed'
            }`}
        >
          {dish.image ? (
            <div className="relative w-full aspect-[3/4]">
              <ImageWithLoader
                src={cacheBustImage(dish.image)}
                alt={dish.name}
                loading="lazy"
                className={`w-full h-full object-cover ${!isAvailable ? 'grayscale' : ''}`}
              />

              {/* Favorite + badge */}
              <div className="absolute top-2 left-2 flex flex-col gap-1">
                {dish.badge && (
                  <span className="px-2 py-0.5 bg-orange-500 text-white text-[11px] font-semibold rounded-full shadow">
                    {dish.badge}
                  </span>
                )}
                {dish.discount && isAvailable && (
                  <span className="px-2 py-0.5 bg-green-500 text-white text-[11px] font-semibold rounded-full shadow">
                    -{dish.discount}%
                  </span>
                )}
                {!isAvailable && (
                  <span className="px-2 py-0.5 bg-red-500 text-white text-[11px] font-semibold rounded-full shadow">
                    Нет
                  </span>
                )}
              </div>

              <button
                onClick={handleFavoriteClick}
                disabled={favoriteLoading}
                className="absolute top-2 right-2 bg-white/90 backdrop-blur-sm rounded-full p-2 shadow-md hover:bg-white transition"
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
          ) : (
            <div className={`relative w-full aspect-[3/4] bg-gradient-to-br from-gray-100 via-gray-50 to-gray-200 flex items-center justify-center ${!isAvailable ? 'grayscale' : ''}`}>
              <svg className="w-16 h-16 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8.25v-1.5m0 1.5c-1.355 0-2.697.056-4.024.166C6.845 8.51 6 9.473 6 10.608v2.513m6-4.871c1.355 0 2.697.056 4.024.166C17.155 8.51 18 9.473 18 10.608v2.513M15 8.25v-1.5m-6 1.5v-1.5m12 9.75l-1.5.75a3.354 3.354 0 01-3 0 3.354 3.354 0 00-3 0 3.354 3.354 0 01-3 0 3.354 3.354 0 00-3 0 3.354 3.354 0 01-3 0L3 16.5m15-3.379a48.474 48.474 0 00-6-.371c-2.032 0-4.034.126-6 .371m12 0c.39.049.777.102 1.163.16 1.07.16 1.837 1.094 1.837 2.175v5.169c0 .621-.504 1.125-1.125 1.125H4.125A1.125 1.125 0 013 20.625v-5.17c0-1.08.768-2.014 1.837-2.174A47.78 47.78 0 016 13.12M12.265 3.11a.375.375 0 11-.53 0L12 2.845l.265.265zm-3 0a.375.375 0 11-.53 0L9 2.845l.265.265zm6 0a.375.375 0 11-.53 0L15 2.845l.265.265z" />
              </svg>
            </div>
          )}

          <div className="p-3 flex flex-col flex-1 gap-2">
            <div className="flex-1">
              <h3 className="font-semibold text-sm leading-snug line-clamp-2">{dish.name}</h3>
              {dish.description && (
                <p className="text-xs text-gray-600 line-clamp-2 mt-1">{dish.description}</p>
              )}

              {allergens.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {allergens.slice(0, 4).map((allergen) => (
                    <span key={allergen} className="text-xs" title={allergenNames[allergen]}>
                      {allergenIcons[allergen]}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between">
              <div className="flex flex-col leading-tight">
                {dish.discount && isAvailable ? (
                  <>
                    <span className="text-[11px] text-gray-400 line-through">
                      {pricePrefix}{originalPrice.toFixed(2)}
                    </span>
                    <span className="text-sm font-bold text-red-600">
                      {pricePrefix}{discountedPrice.toFixed(2)} {currency}
                    </span>
                  </>
                ) : (
                  <span className="text-sm font-bold text-primary-600">
                    {pricePrefix}{originalPrice.toFixed(2)} {currency}
                  </span>
                )}
              </div>

              {isAvailable ? (
                <button
                  onClick={handleAddClick}
                  className={`w-9 h-9 flex items-center justify-center bg-primary-600 hover:bg-primary-700 text-white rounded-full text-xl font-light transition-all shadow-md active:scale-95 ${isAdding ? 'animate-spin-once' : ''}`}
                >
                  +
                </button>
              ) : (
                <button
                  disabled
                  className="w-9 h-9 flex items-center justify-center bg-gray-300 text-gray-500 rounded-full text-xl cursor-not-allowed"
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
          restaurantId={restaurantId}
          restaurantName={restaurantName}
        />
      </>
    );
  }

  // Стиль сетки 2 колонки (компактный)
  return (
    <>
      <div
        onClick={handleCardClick}
        className={`overflow-hidden rounded-lg border border-gray-200 bg-white transition-all duration-200 flex flex-col h-full ${isAvailable
          ? 'cursor-pointer hover:shadow-lg active:scale-98'
          : 'opacity-60 cursor-not-allowed'
          }`}
      >
        {/* Image */}
        {dish.image ? (
          <div className="relative aspect-square">
            <ImageWithLoader
              src={cacheBustImage(dish.image)}
              alt={dish.name}
              loading="lazy"
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
        ) : (
          <div className={`relative aspect-square bg-gradient-to-br from-gray-100 via-gray-50 to-gray-200 flex items-center justify-center ${!isAvailable ? 'grayscale' : ''}`}>
            <svg className="w-12 h-12 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8.25v-1.5m0 1.5c-1.355 0-2.697.056-4.024.166C6.845 8.51 6 9.473 6 10.608v2.513m6-4.871c1.355 0 2.697.056 4.024.166C17.155 8.51 18 9.473 18 10.608v2.513M15 8.25v-1.5m-6 1.5v-1.5m12 9.75l-1.5.75a3.354 3.354 0 01-3 0 3.354 3.354 0 00-3 0 3.354 3.354 0 01-3 0 3.354 3.354 0 00-3 0 3.354 3.354 0 01-3 0L3 16.5m15-3.379a48.474 48.474 0 00-6-.371c-2.032 0-4.034.126-6 .371m12 0c.39.049.777.102 1.163.16 1.07.16 1.837 1.094 1.837 2.175v5.169c0 .621-.504 1.125-1.125 1.125H4.125A1.125 1.125 0 013 20.625v-5.17c0-1.08.768-2.014 1.837-2.174A47.78 47.78 0 016 13.12M12.265 3.11a.375.375 0 11-.53 0L12 2.845l.265.265zm-3 0a.375.375 0 11-.53 0L9 2.845l.265.265zm6 0a.375.375 0 11-.53 0L15 2.845l.265.265z" />
            </svg>
          </div>
        )}

        {/* Content */}
        <div className="p-2 flex flex-col flex-1">
          <div className="flex-1">
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
          </div>

          {/* Price and Add Button */}
          <div className="flex items-center justify-between mt-auto">
            <div className="flex flex-col">
              {dish.discount && isAvailable ? (
                <>
                  <span className="text-[10px] text-gray-400 line-through">
                    {pricePrefix}{originalPrice.toFixed(2)}
                  </span>
                  <span className="text-sm font-bold text-red-600">
                    {pricePrefix}{discountedPrice.toFixed(2)} {currency}
                  </span>
                </>
              ) : (
                <span className="text-sm font-bold text-primary-600">
                  {pricePrefix}{originalPrice.toFixed(2)} {currency}
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
        restaurantId={restaurantId}
        restaurantName={restaurantName}
      />
    </>
  );
};

export default DishCard;
