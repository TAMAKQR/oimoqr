import { useState, useEffect, useMemo } from 'react';
import { useCartStore } from '../store/cartStore';
import toast from 'react-hot-toast';
import { cacheBustImage } from '../utils/imageCache';
import ImageWithLoader from './ImageWithLoader';

// Отдельный компонент для карточки рекомендации, чтобы реагировать на изменения корзины
const RecommendationCard = ({ dish, currency, addItem, removeItem }) => {
  const items = useCartStore((state) => state.items);
  const itemInCart = items.find(item => item.dish.id === dish.id);
  const quantity = itemInCart?.quantity || 0;

  return (
    <div className="relative">
      <div className="relative mb-2">
        {dish.image && (
          <ImageWithLoader
            src={dish.image}
            alt={dish.name}
            className="w-full aspect-square object-cover rounded-lg"
            loading="lazy"
          />
        )}
        {/* Кнопка внутри фото в правом нижнем углу */}
        <div className="absolute bottom-2 right-2">
          {quantity === 0 ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                addItem(dish, []);
              }}
              className="w-8 h-8 flex-shrink-0 flex items-center justify-center bg-primary-600 text-white rounded-full hover:bg-primary-700 active:scale-95 transition-all shadow-md"
            >
              <span className="text-lg leading-none">+</span>
            </button>
          ) : (
            <div className="flex items-center gap-1 bg-primary-600 rounded-full px-1 py-1 flex-shrink-0 shadow-md">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  removeItem(dish.id);
                }}
                className="w-6 h-6 flex items-center justify-center text-white hover:bg-primary-700 rounded-full active:scale-95 transition-all"
              >
                <span className="text-lg leading-none">−</span>
              </button>
              <span className="text-white font-bold text-sm min-w-[20px] text-center">{quantity}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  addItem(dish, []);
                }}
                className="w-6 h-6 flex items-center justify-center text-white hover:bg-primary-700 rounded-full active:scale-95 transition-all"
              >
                <span className="text-lg leading-none">+</span>
              </button>
            </div>
          )}
        </div>
      </div>
      <div className="text-sm font-medium line-clamp-2 mb-1 leading-snug text-gray-900">{dish.name}</div>
      <div className="text-sm font-bold text-primary-600">
        {parseFloat(dish.price).toFixed(2)} {currency}
      </div>
    </div>
  );
};

const DishModal = ({
  dish,
  isOpen,
  onClose,
  currency = '₽',
  isFavorite = false,
  onToggleFavorite,
  favoriteLoading = false
}) => {
  // Используем объект для хранения выбранных опций для каждого модификатора
  const [selectedModifiers, setSelectedModifiers] = useState({});
  const [recommendations, setRecommendations] = useState([]);
  const [loadingRecommendations, setLoadingRecommendations] = useState(false);
  const addItem = useCartStore((state) => state.addItem);
  const removeItem = useCartStore((state) => state.removeItem);
  const isAvailable = dish?.available !== false; // По умолчанию true если поле отсутствует

  // ✅ Вычисляем активное изображение на основе выбранных модификаторов
  const currentImage = useMemo(() => {
    // Ищем первый выбранный модификатор с изображением
    const selectedOptions = Object.values(selectedModifiers).flat();
    const optionWithImage = selectedOptions.find(option => option.image);

    // Если есть модификатор с фото - показываем его, иначе - фото блюда
    return optionWithImage?.image || dish?.image;
  }, [selectedModifiers, dish?.image]);

  // Lock background scroll only when modal is open
  useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document?.body?.style?.overflow;
    if (document?.body) {
      document.body.style.overflow = 'hidden';
    }
    return () => {
      if (document?.body) {
        document.body.style.overflow = originalOverflow || '';
      }
    };
  }, [isOpen]);

  // Load recommendations when modal opens
  useEffect(() => {
    if (isOpen && dish?.id) {
      loadRecommendations();
    }
  }, [isOpen, dish?.id]);

  const loadRecommendations = async () => {
    setLoadingRecommendations(true);
    try {
      const response = await fetch(`/api/dishes/${dish.id}/recommendations?limit=4`);
      if (response.ok) {
        const data = await response.json();
        setRecommendations(data.recommendations || []);
      } else {
        console.log(`⚠️ Recommendations API returned ${response.status}, feature not available yet`);
      }
    } catch (error) {
      console.log('ℹ️ Recommendations not available:', error.message);
    } finally {
      setLoadingRecommendations(false);
    }
  };

  if (!isOpen) return null;

  const handleModifierChange = (modifier, option) => {
    setSelectedModifiers(prev => {
      const newSelection = { ...prev };
      if (modifier.type === 'single') {
        newSelection[modifier.id] = [option];
      } else { // multi
        const currentOptions = newSelection[modifier.id] || [];
        const optionIndex = currentOptions.findIndex(o => o.id === option.id);
        if (optionIndex > -1) {
          // Убираем опцию, если она уже выбрана
          newSelection[modifier.id] = currentOptions.filter(o => o.id !== option.id);
        } else {
          // Добавляем опцию
          newSelection[modifier.id] = [...currentOptions, option];
        }
      }
      return newSelection;
    });
  };

  const getTotalPrice = () => {
    const basePrice = parseFloat(dish.price) || 0;
    const modifiersPrice = Object.values(selectedModifiers)
      .flat()
      .reduce((sum, option) => sum + (parseFloat(option.price) || 0), 0);
    return parseFloat((basePrice + modifiersPrice).toFixed(2));
  };

  const handleAddToCart = () => {
    if (!isAvailable) return;

    const basePrice = parseFloat(dish.price) || 0;
    const selectedOptions = Object.values(selectedModifiers).flat();

    // ✅ ПРОВЕРКА ОБЯЗАТЕЛЬНЫХ МОДИФИКАТОРОВ
    const requiredModifiers = dish.modifiers?.filter(m => m.isRequired) || [];
    for (const modifier of requiredModifiers) {
      const selected = selectedModifiers[modifier.id];
      if (!selected || selected.length === 0) {
        toast.error(`Пожалуйста, выберите "${modifier.name}" (обязательно)`, {
          duration: 3000,
          icon: '⚠️'
        });
        return;
      }
    }

    // Если базовая цена = 0 и нет выбранных модификаторов - показываем ошибку
    if (basePrice === 0 && selectedOptions.length === 0) {
      toast.error('Пожалуйста, выберите опции для этого блюда');
      return;
    }

    const finalPrice = getTotalPrice();
    const modifierIds = selectedOptions.map(m => m.id).sort().join('-');
    const itemId = `${dish.id}-${modifierIds}`;

    // Добавляем блюдо с модификаторами в корзину
    addItem(dish, selectedOptions);

    toast.success(`${dish.name} добавлен в корзину!`);
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
      className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center z-[100] p-0 sm:p-4"
      onClick={handleBackdropClick}
    >
      <div className="bg-white rounded-t-2xl sm:rounded-lg w-full max-w-[480px] max-h-[80vh] overflow-y-auto shadow-2xl mx-0 animate-slide-up">
        {currentImage && (
          <div className="relative h-56 sm:h-64 md:h-72">
            <ImageWithLoader
              src={cacheBustImage(currentImage)}
              alt={dish.name}
              className={`w-full h-full object-cover rounded-t-2xl sm:rounded-t-lg transition-all duration-300 ${!isAvailable ? 'grayscale' : ''}`}
            />
            {/* Бейджи и избранное */}
            <div className="absolute top-3 right-3 sm:top-4 sm:right-4 flex flex-col gap-2 items-end">
              <div className="flex items-center gap-2">
                {onToggleFavorite && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleFavorite?.();
                    }}
                    disabled={favoriteLoading}
                    className="w-11 h-11 sm:w-12 sm:h-12 bg-white/90 backdrop-blur-sm rounded-full shadow-lg flex items-center justify-center hover:bg-white active:scale-95 transition"
                    aria-label={isFavorite ? 'Удалить из избранного' : 'Добавить в избранное'}
                  >
                    {favoriteLoading ? (
                      <svg className="w-5 h-5 text-gray-400 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    ) : (
                      <svg
                        className={`w-6 h-6 transition-colors ${isFavorite ? 'text-red-500 fill-current' : 'text-gray-400'}`}
                        fill={isFavorite ? 'currentColor' : 'none'}
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                      </svg>
                    )}
                  </button>
                )}

                {dish.badge && (
                  <span className="px-3 sm:px-4 py-1.5 sm:py-2 bg-gradient-to-br from-orange-400 to-red-500 text-white text-xs sm:text-sm font-bold rounded-full shadow-lg">
                    {dish.badge}
                  </span>
                )}
              </div>

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

        <div className="p-3 sm:p-5">
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
            <div className="mb-4">
              {dish.modifiers.map((modifier) => (
                modifier.options && modifier.options.length > 0 && (
                  <div key={modifier.id} className="mb-4">
                    <h3 className="text-base sm:text-lg font-semibold mb-2">
                      {modifier.name}
                      {modifier.isRequired && <span className="text-red-500 ml-1">*</span>}
                    </h3>
                    <div className="space-y-2">
                      {modifier.options.map((option) => (
                        <label
                          key={option.id}
                          className="flex items-center justify-between p-3 border rounded-lg cursor-pointer hover:bg-gray-50 active:bg-gray-100 transition-colors gap-2"
                        >
                          <div className="flex items-center min-w-0 flex-1">
                            <input
                              type={modifier.type === 'single' ? 'radio' : 'checkbox'}
                              name={modifier.id}
                              checked={selectedModifiers[modifier.id]?.some(o => o.id === option.id) || false}
                              onChange={() => handleModifierChange(modifier, option)}
                              className="mr-2 sm:mr-3 flex-shrink-0 w-4 h-4 sm:w-5 sm:h-5"
                            />
                            <span className="text-sm sm:text-base break-words">{option.name}</span>
                          </div>
                          {option.price > 0 && (
                            <span className="text-gray-600 text-sm sm:text-base whitespace-nowrap ml-2">
                              +{parseFloat(option.price).toFixed(2)} {currency}
                            </span>
                          )}
                        </label>
                      ))}
                    </div>
                  </div>
                )
              ))}
            </div>
          )}

          {/* Рекомендации */}
          {recommendations.length > 0 && (
            <div className="border-t pt-2 pb-1">
              <div className="grid grid-cols-2 gap-2.5">
                {recommendations.map((rec) => {
                  return <RecommendationCard key={rec.id} dish={rec} currency={currency} addItem={addItem} removeItem={removeItem} />;
                })}
              </div>
            </div>
          )}

          {/* Padding for fixed bottom bar */}
          <div className="h-24"></div>
        </div>

        {/* Fixed bottom bar with buttons */}
        <div className="sticky bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 sm:p-6 shadow-lg">
          <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 sm:gap-0">
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
                className={`flex-1 flex items-center justify-center gap-2 active:scale-95 transition-transform ${isAvailable
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