import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { restaurantService } from '../services/restaurantService';
import customerService from '../services/customerService';
import BannerSlider from '../components/BannerSlider';
import DishCard from '../components/DishCard';
import Cart from '../components/Cart';
import WorkingHoursSection from '../components/WorkingHoursSection';
import MenuSkeleton from '../components/MenuSkeleton';
import CustomerLoginModal from '../components/CustomerLoginModal';
import CustomerBottomNav from '../components/CustomerBottomNav';

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
  const navigate = useNavigate();
  const [restaurant, setRestaurant] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedLanguage, setSelectedLanguage] = useState('ru');
  const [availableLanguages, setAvailableLanguages] = useState([]);
  const [showLanguageSwitcher, setShowLanguageSwitcher] = useState(true);
  const [isCustomerLoggedIn, setIsCustomerLoggedIn] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [isDishModalOpen, setIsDishModalOpen] = useState(false);
  const categoryRefs = useRef({});
  const categoryButtonRefs = useRef({});
  const categoryMenuRef = useRef(null);
  const isUserClick = useRef(false);
  const lastScrollY = useRef(0);

  // Check customer login status
  useEffect(() => {
    setIsCustomerLoggedIn(customerService.isAuthenticated());
  }, []);

  // ✅ ОПТИМИЗАЦИЯ: useCallback предотвращает лишние перерендеры
  const loadRestaurant = useCallback(async (language) => {
    try {
      setLoading(true);
      const data = await restaurantService.getBySubdomain(subdomain, language);
      setRestaurant(data);
      // Сохраняем последний посещенный ресторан для клиентской авторизации
      if (data?.id) {
        const payload = {
          id: data.id,
          subdomain: data.subdomain,
          name: data.name,
          description: data.description,
          logo: data.logo,
        };
        localStorage.setItem('customer-last-restaurant', JSON.stringify(payload));
      }
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
  }, [subdomain]);

  // ✅ ОПТИМИЗАЦИЯ: Один useEffect для загрузки - избегаем дублирования
  useEffect(() => {
    loadRestaurant(selectedLanguage);
  }, [subdomain, selectedLanguage, loadRestaurant]);


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
    return <MenuSkeleton />;
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
    <div className="min-h-screen bg-gray-100 flex justify-center">
      {/* Mobile Container - максимум 480px (фиксируем мобильный вид на десктопе) */}
      <div className="w-full max-w-[480px] min-h-screen bg-gray-50 shadow-2xl relative">
        {/* Language Switcher - Top Left */}
        {availableLanguages.length > 0 && (
          <div className={`fixed top-4 left-4 z-40 bg-white rounded-lg shadow-md border border-gray-200 transition-all duration-300 ${showLanguageSwitcher ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-full pointer-events-none'
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

        {/* Customer Profile Button - Top Right */}
        <div className={`fixed top-4 right-4 z-40 transition-all duration-300 ${showLanguageSwitcher ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-full pointer-events-none'}`}>
          {isCustomerLoggedIn ? (
            <button
              onClick={() => navigate('/customer/profile')}
              className="bg-white rounded-full p-3 shadow-md border border-gray-200 hover:bg-gray-50 transition-colors"
              title="Личный кабинет"
            >
              <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </button>
          ) : (
            <button
              onClick={() => setShowLoginModal(true)}
              className="bg-green-600 text-white rounded-full px-4 py-2 shadow-md hover:bg-green-700 transition-colors text-sm font-medium flex items-center space-x-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
              </svg>
              <span>Войти</span>
            </button>
          )}
        </div>

        {/* Login Modal */}
        <CustomerLoginModal
          isOpen={showLoginModal}
          onClose={() => setShowLoginModal(false)}
          restaurantId={restaurant.id}
          onLoginSuccess={() => {
            setIsCustomerLoggedIn(true);
            setShowLoginModal(false);
          }}
        />

        {/* Banner Slider */}
        <BannerSlider banners={restaurant.banners} />

        {/* Restaurant Info */}
        <div className="bg-white shadow-sm">
          <div className="px-4 py-4">
            <div className="flex items-start gap-4 mb-4">
              {restaurant.logo && (
                <img
                  src={restaurant.logo}
                  alt={`${restaurant.name} logo`}
                  className="w-16 h-16 object-contain rounded border-2 border-gray-200 bg-white p-1 flex-shrink-0"
                />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <h1 className="text-2xl font-bold break-words">{restaurant.name}</h1>
                  <WorkingHoursSection restaurant={restaurant} />
                </div>
                {restaurant.address && (
                  <p className="text-sm text-gray-600 mb-2 break-words">📍 {restaurant.address}</p>
                )}
                {restaurant.phone && (
                  <p className="text-sm text-gray-600 mb-2">📞 {restaurant.phone}</p>
                )}
              </div>
            </div>
            {/* Social Links */}
            {(restaurant.instagram || restaurant.facebook || restaurant.whatsapp) && (
              <div className="flex flex-wrap gap-3 mt-3">
                {restaurant.instagram && (
                  <a
                    href={`https://instagram.com/${restaurant.instagram}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-pink-600 hover:text-pink-700 transition-colors"
                  >
                    📷 Instagram
                  </a>
                )}
                {restaurant.facebook && (
                  <a
                    href={`https://facebook.com/${restaurant.facebook}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:text-blue-700 transition-colors"
                  >
                    👥 Facebook
                  </a>
                )}
                {restaurant.whatsapp && (
                  <a
                    href={`https://wa.me/${restaurant.whatsapp.replace(/\D/g, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-green-600 hover:text-green-700 transition-colors"
                  >
                    💬 WhatsApp
                  </a>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Category Groups - отображаются в 2 ряда с фото */}
        {restaurant.categoryGroups && restaurant.categoryGroups.length > 0 && (
          <div className="px-4 py-6">
            <div className="grid grid-cols-2 gap-3">
              {restaurant.categoryGroups.map((group) => (
                <button
                  key={group.id}
                  onClick={() => {
                    // Прокрутка к первой категории в группе
                    if (group.categories && group.categories.length > 0) {
                      handleCategoryClick(group.categories[0].id);
                    }
                  }}
                  className="flex flex-col items-center bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow overflow-hidden"
                >
                  {group.image && (
                    <img
                      src={group.image}
                      alt={group.name}
                      className="w-full h-32 object-cover"
                    />
                  )}
                  <div className="p-3 w-full text-center">
                    <h3 className="font-semibold text-sm">{group.name}</h3>
                    {group.description && (
                      <p className="text-xs text-gray-500 mt-1 line-clamp-2">{group.description}</p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Categories */}
        <div className="bg-white/95 backdrop-blur-sm border-b sticky top-0 z-40 shadow-sm">
          <div className="px-4">
            <div
              ref={categoryMenuRef}
              className="flex gap-2 overflow-x-auto py-3 pl-[4px] scrollbar-hide scroll-smooth"
            >
              {restaurant.categories.map((category) => (
                <button
                  key={category.id}
                  ref={(el) => (categoryButtonRefs.current[category.id] = el)}
                  onClick={() => handleCategoryClick(category.id)}
                  className={`px-4 py-2 rounded-full whitespace-nowrap transition-all duration-300 text-sm font-medium ${selectedCategory === category.id
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
        <div className="px-4 py-6 pb-20 sm:pb-6">
          {restaurant.categories.map((category) => (
            <div
              key={category.id}
              ref={(el) => (categoryRefs.current[category.id] = el)}
              data-category-id={category.id}
              className="mb-12"
            >
              <h2 className="text-xl font-bold mb-4 break-words">{category.name}</h2>
              {category.description && (
                <p className="text-sm text-gray-600 mb-4 break-words">{category.description}</p>
              )}

              {category.dishes.length === 0 ? (
                <p className="text-center text-gray-500 py-8 text-sm">
                  В этой категории пока нет блюд
                </p>
              ) : (
                <div className={`gap-4 ${restaurant.menuCardStyle === 'vertical'
                  ? 'grid grid-cols-1'
                  : restaurant.menuCardStyle === 'grid'
                    ? 'grid grid-cols-2'
                    : 'flex flex-col'
                  }`}>
                  {category.dishes.map((dish) => (
                    <DishCard
                      key={dish.id}
                      dish={dish}
                      currency={getCurrencySymbol(restaurant.currency)}
                      style={restaurant.menuCardStyle || 'horizontal'}
                      onFavoriteToggle={(action) => {
                        if (action === 'login') {
                          setShowLoginModal(true);
                        }
                      }}
                      onModalStateChange={(isOpen) => setIsDishModalOpen(isOpen)}
                    />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Cart */}
        <Cart restaurant={restaurant} isDishModalOpen={isDishModalOpen} />

        {/* Bottom navigation для авторизованных клиентов */}
        {isCustomerLoggedIn && !isDishModalOpen && <CustomerBottomNav />}
      </div>
      {/* Закрытие mobile wrapper */}
    </div>
  );
};

export default MenuPage;