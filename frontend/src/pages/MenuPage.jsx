import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { restaurantService } from '../services/restaurantService';
import BannerSlider from '../components/BannerSlider';
import DishCard from '../components/DishCard';
import Cart from '../components/Cart';
import WorkingHoursSection from '../components/WorkingHoursSection';
import LoadingSpinner from '../components/LoadingSpinner';

const getCurrencySymbol = (currencyCode) => {
  const currencySymbols = {
    RUB: '₽',
    KZT: '₸',
    USD: '$',
    EUR: '€',
    GBP: '£',
    UAH: '₴',
    TRY: '₺',
    AMD: '֏',
    GEL: '₾',
    UZS: "so'm",
    KGS: 'с',
    VND: '₫',
  };
  return currencySymbols[currencyCode] || '₽';
};

const MenuPage = () => {
  const { subdomain } = useParams();
  const [restaurant, setRestaurant] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedLanguage, setSelectedLanguage] = useState('ru');
  const [availableLanguages, setAvailableLanguages] = useState([]);
  const [showLanguageSwitcher, setShowLanguageSwitcher] = useState(true);
  const categoryRefs = useRef({});
  const categoryButtonRefs = useRef({});
  const categoryMenuRef = useRef(null);
  const isUserClick = useRef(false);
  const lastScrollY = useRef(0);

  useEffect(() => {
    loadRestaurant(selectedLanguage);
  }, [subdomain]);

  useEffect(() => {
    if (restaurant && selectedLanguage) {
      loadRestaurant(selectedLanguage);
    }
  }, [selectedLanguage]);

  const loadRestaurant = async (language) => {
    try {
      const data = await restaurantService.getBySubdomain(subdomain, language);
      setRestaurant(data);
      if (data.languages && data.languages.length > 0) {
        setAvailableLanguages(data.languages);
      }
      if (data.categories && data.categories.length > 0) {
        setSelectedCategory(data.categories[0].id);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Ресторан не найден');
    } finally {
      setLoading(false);
    }
  };

  // Плавное переключение категорий при скролле с помощью Intersection Observer
  useEffect(() => {
    if (!restaurant || restaurant.categories.length === 0) return;

    const observerOptions = {
      root: null,
      rootMargin: '-100px 0px -50% 0px', // Триггер когда категория в верхней части экрана (100px от верха)
      threshold: 0
    };

    const observerCallback = (entries) => {
      // Игнорируем изменения если пользователь только что кликнул на категорию
      if (isUserClick.current) return;

      // Находим самую верхнюю видимую категорию
      const visibleEntries = entries.filter(entry => entry.isIntersecting);
      if (visibleEntries.length > 0) {
        // Сортируем по позиции на экране (самая верхняя первая)
        visibleEntries.sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        const topEntry = visibleEntries[0];
        
        const categoryId = topEntry.target.dataset.categoryId;
        setSelectedCategory(categoryId);
        
        // Автоматически скроллим горизонтальное меню к активной кнопке
        const categoryButton = categoryButtonRefs.current[categoryId];
        const categoryMenu = categoryMenuRef.current;
        
        if (categoryButton && categoryMenu) {
          // Используем getBoundingClientRect для точного расчета позиций
          const menuRect = categoryMenu.getBoundingClientRect();
          const buttonRect = categoryButton.getBoundingClientRect();
          
          // Вычисляем смещение кнопки относительно текущей позиции скролла
          const buttonRelativeLeft = buttonRect.left - menuRect.left + categoryMenu.scrollLeft;
          const buttonWidth = buttonRect.width;
          const menuWidth = menuRect.width;
          
          // Вычисляем позицию для центрирования кнопки
          const targetScrollLeft = buttonRelativeLeft - (menuWidth / 2) + (buttonWidth / 2);
          
          // Плавный скролл горизонтального меню
          categoryMenu.scrollTo({
            left: targetScrollLeft,
            behavior: 'smooth'
          });
        }
      }
    };

    const observer = new IntersectionObserver(observerCallback, observerOptions);

    // Наблюдаем за всеми секциями категорий
    Object.values(categoryRefs.current).forEach((ref) => {
      if (ref) observer.observe(ref);
    });

    return () => observer.disconnect();
  }, [restaurant]);

  // Скрытие переключателя языка при скролле вниз
  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      
      if (currentScrollY < 50) {
        // Если в самом верху страницы - всегда показываем
        setShowLanguageSwitcher(true);
      } else if (currentScrollY > lastScrollY.current) {
        // Прокрутка вниз - скрываем
        setShowLanguageSwitcher(false);
      } else {
        // Прокрутка вверх - показываем
        setShowLanguageSwitcher(true);
      }
      
      lastScrollY.current = currentScrollY;
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Обработка клика на категорию
  const handleCategoryClick = (categoryId) => {
    isUserClick.current = true;
    setSelectedCategory(categoryId);
    
    // Плавный скролл к категории
    const categoryElement = categoryRefs.current[categoryId];
    if (categoryElement) {
      const yOffset = -80; // Отступ для sticky header
      const y = categoryElement.getBoundingClientRect().top + window.pageYOffset + yOffset;
      window.scrollTo({ top: y, behavior: 'smooth' });
    }

    // Сбрасываем флаг через 1 секунду
    setTimeout(() => {
      isUserClick.current = false;
    }, 1000);
  };

  if (loading) {
    return <LoadingSpinner message="Загрузка меню..." />;
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="card max-w-md text-center">
          <h2 className="text-2xl font-bold text-red-600 mb-4">Ошибка</h2>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Language Switcher - Top Left */}
      {availableLanguages.length > 0 && (
        <div className={`fixed top-4 left-4 z-40 bg-white rounded-lg shadow-md border border-gray-200 transition-all duration-300 ${
          showLanguageSwitcher ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-full pointer-events-none'
        }`}>
          <select
            value={selectedLanguage}
            onChange={(e) => setSelectedLanguage(e.target.value)}
            className="px-3 py-2 rounded border-0 bg-white text-gray-700 font-medium cursor-pointer text-sm focus:outline-none uppercase"
          >
            {availableLanguages.map(lang => (
              <option key={lang.languageCode} value={lang.languageCode}>
                {lang.languageCode.toUpperCase()}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Banner Slider */}
      <BannerSlider banners={restaurant.banners} />

      {/* Restaurant Info */}
      <div className="bg-white shadow-sm">
        <div className="container mx-auto px-4 py-4 sm:py-6">
          <div className="flex items-start gap-4 mb-4">
            {restaurant.logo && (
              <img
                src={restaurant.logo}
                alt={`${restaurant.name} logo`}
                className="w-16 h-16 sm:w-20 sm:h-20 object-contain rounded border-2 border-gray-200 bg-white p-1 flex-shrink-0"
              />
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 sm:gap-3 mb-2 flex-wrap">
                <h1 className="text-2xl sm:text-3xl font-bold break-words">{restaurant.name}</h1>
                <WorkingHoursSection restaurant={restaurant} />
              </div>
              {restaurant.address && (
                <p className="text-sm sm:text-base text-gray-600 mb-2 break-words">📍 {restaurant.address}</p>
              )}
              {restaurant.phone && (
                <p className="text-sm sm:text-base text-gray-600 mb-2">📞 {restaurant.phone}</p>
              )}
            </div>
          </div>
          
          {/* Social Links */}
          {(restaurant.instagram || restaurant.facebook || restaurant.whatsapp) && (
            <div className="flex flex-wrap gap-3 sm:gap-4 mt-3 sm:mt-4">
              {restaurant.instagram && (
                <a
                  href={`https://instagram.com/${restaurant.instagram}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm sm:text-base text-pink-600 hover:text-pink-700 transition-colors"
                >
                  📷 Instagram
                </a>
              )}
              {restaurant.facebook && (
                <a
                  href={`https://facebook.com/${restaurant.facebook}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm sm:text-base text-blue-600 hover:text-blue-700 transition-colors"
                >
                  👥 Facebook
                </a>
              )}
              {restaurant.whatsapp && (
                <a
                  href={`https://wa.me/${restaurant.whatsapp.replace(/\D/g, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm sm:text-base text-green-600 hover:text-green-700 transition-colors"
                >
                  💬 WhatsApp
                </a>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Categories */}
      <div className="bg-white/95 backdrop-blur-sm border-b sticky top-0 z-50 shadow-sm">
        <div className="container mx-auto px-4">
          <div 
            ref={categoryMenuRef}
            className="flex gap-2 sm:gap-4 overflow-x-auto py-3 sm:py-4 pl-[4px] scrollbar-hide scroll-smooth"
          >
            {restaurant.categories.map((category) => (
              <button
                key={category.id}
                ref={(el) => (categoryButtonRefs.current[category.id] = el)}
                onClick={() => handleCategoryClick(category.id)}
                className={`px-4 sm:px-6 py-2 rounded-full whitespace-nowrap transition-all duration-300 text-sm sm:text-base font-medium ${
                  selectedCategory === category.id
                    ? 'bg-primary-600 text-white shadow-lg scale-105 ring-2 ring-primary-300'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                {category.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* All Categories with Dishes */}
      <div className="container mx-auto px-4 py-6 sm:py-8 pb-24">
        {restaurant.categories.map((category) => (
          <div
            key={category.id}
            ref={(el) => (categoryRefs.current[category.id] = el)}
            data-category-id={category.id}
            className="mb-12 sm:mb-16"
          >
            <h2 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6 break-words">{category.name}</h2>
            {category.description && (
              <p className="text-sm sm:text-base text-gray-600 mb-4 sm:mb-6 break-words">{category.description}</p>
            )}
            
            {category.dishes.length === 0 ? (
              <p className="text-center text-gray-500 py-8 text-sm sm:text-base">
                В этой категории пока нет блюд
              </p>
            ) : (
              <div className={`gap-4 sm:gap-6 ${
                restaurant.menuCardStyle === 'vertical' 
                  ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3' 
                  : 'flex flex-col'
              }`}>
                {category.dishes.map((dish) => (
                  <DishCard 
                    key={dish.id} 
                    dish={dish} 
                    currency={getCurrencySymbol(restaurant.currency)}
                    style={restaurant.menuCardStyle || 'horizontal'}
                  />
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Cart */}
      <Cart restaurant={restaurant} />
    </div>
  );
};

export default MenuPage;