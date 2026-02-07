import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { restaurantService } from '../services/restaurantService';
import customerService from '../services/customerService';
import BannerSlider from '../components/BannerSlider';
import DishCard from '../components/DishCard';
import Cart from '../components/Cart';
import WorkingHoursSection from '../components/WorkingHoursSection';
import MenuSkeleton from '../components/MenuSkeleton';
import CustomerLoginModal from '../components/CustomerLoginModal';
import ImageWithLoader from '../components/ImageWithLoader';
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
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const categoryRefs = useRef({});
  const categoryButtonRefs = useRef({});
  const categoryMenuRef = useRef(null);
  const searchInputRef = useRef(null);
  const isUserClick = useRef(false);
  const lastScrollY = useRef(0);

  const isSearching = Boolean(searchTerm.trim());

  const filteredCategories = useMemo(() => {
    if (!restaurant) return [];
    if (!isSearching) return restaurant.categories;

    const query = searchTerm.trim().toLowerCase();

    return restaurant.categories
      .map((category) => {
        const dishes = category.dishes.filter((dish) => {
          const name = dish.name?.toLowerCase() || '';
          const desc = dish.description?.toLowerCase() || '';
          return name.includes(query) || desc.includes(query);
        });
        return { ...category, dishes };
      })
      .filter((category) => category.dishes.length > 0);
  }, [restaurant, searchTerm, isSearching]);

  const categoriesToRender = isSearching ? filteredCategories : restaurant?.categories || [];

  const searchResults = useMemo(() => {
    if (!isSearching) return [];
    return filteredCategories.flatMap((category) =>
      category.dishes.map((dish) => ({
        ...dish,
        categoryName: category.name,
      }))
    );
  }, [filteredCategories, isSearching]);

  // Check customer login status
  useEffect(() => {
    setIsCustomerLoggedIn(customerService.isAuthenticated());
  }, []);

  useEffect(() => {
    if (isSearchOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isSearchOpen]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setIsSearchOpen(false);
        setSearchTerm('');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
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
          <div className="flex flex-col items-end gap-2">
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
            <button
              onClick={() => setIsSearchOpen(true)}
              className="bg-white rounded-full p-3 shadow-md border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors"
              aria-label="Открыть поиск"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35m0 0A7.5 7.5 0 104.5 4.5a7.5 7.5 0 0012.15 12.15z" />
              </svg>
            </button>
          </div>
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
              <div className="flex flex-wrap gap-2 mt-3">
                {restaurant.instagram && (
                  <a
                    href={`https://instagram.com/${restaurant.instagram}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-2 shadow-sm text-gray-700 hover:-translate-y-0.5 hover:shadow transition-transform"
                  >
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="18" height="18" rx="5" ry="5" />
                      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
                    </svg>
                    <span className="text-sm font-medium">Instagram</span>
                  </a>
                )}
                {restaurant.facebook && (
                  <a
                    href={`https://facebook.com/${restaurant.facebook}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-2 shadow-sm text-gray-700 hover:-translate-y-0.5 hover:shadow transition-transform"
                  >
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M13 10h2.5l.5-3H13V5.5c0-.9.3-1.5 1.6-1.5H16V1.2C15.3 1.1 14.1 1 13 1c-2.7 0-4 1.6-4 4.3V7H7v3h2v9h4z" />
                    </svg>
                    <span className="text-sm font-medium">Facebook</span>
                  </a>
                )}
                {restaurant.whatsapp && (
                  <a
                    href={`https://wa.me/${restaurant.whatsapp.replace(/\D/g, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-2 shadow-sm text-gray-700 hover:-translate-y-0.5 hover:shadow transition-transform"
                  >
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 20l1.3-4.7A8 8 0 1 1 5 6.5 8 8 0 0 1 3 20z" />
                      <path d="M8.9 8.9c.2-.5.4-.5.7-.5h.6c.2 0 .5 0 .5.4s-.2.6-.3.8c-.1.1-.2.3 0 .6s.7 1.1 1.5 1.7 1.7.8 1.9.9.4 0 .5-.2l.7-.9c.2-.3.4-.2.7-.1l.6.3c.2.1.5.2.5.4s-.1.5-.3.8-.8.8-1.6.8-2.2-.5-3.3-1.4c-.9-.8-1.8-2.1-2.1-3.3-.2-.6-.2-1 0-1.3z" />
                    </svg>
                    <span className="text-sm font-medium">WhatsApp</span>
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
                    <div className="w-full aspect-square">
                      <ImageWithLoader
                        src={group.image}
                        alt={group.name}
                        loading="lazy"
                        className="w-full h-full object-cover"
                      />
                    </div>
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
        <div className={`${restaurant.menuCardStyle === 'gallery' ? 'px-2 sm:px-3' : 'px-4'} py-6 pb-20 sm:pb-6`}>
          {!isSearching && restaurant.categories.map((category) => (
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
                <div className={`${restaurant.menuCardStyle === 'gallery' ? 'grid grid-cols-2 gap-2 sm:gap-3 items-stretch' : 'gap-4'} ${restaurant.menuCardStyle === 'vertical'
                  ? 'grid grid-cols-1'
                  : restaurant.menuCardStyle === 'grid'
                    ? 'grid grid-cols-2'
                    : restaurant.menuCardStyle === 'gallery'
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

          {isSearching && (
            <div className="space-y-10">
              {categoriesToRender.length === 0 && (
                <div className="text-center text-gray-500 py-10">
                  Ничего не найдено
                </div>
              )}

              {categoriesToRender.map((category) => (
                <div key={category.id} className="mb-4">
                  <h2 className="text-lg font-semibold mb-3 break-words">{category.name}</h2>
                  <div className={`${restaurant.menuCardStyle === 'gallery' ? 'grid grid-cols-2 gap-2 sm:gap-3 items-stretch' : 'gap-4'} ${restaurant.menuCardStyle === 'vertical'
                    ? 'grid grid-cols-1'
                    : restaurant.menuCardStyle === 'grid'
                      ? 'grid grid-cols-2'
                      : restaurant.menuCardStyle === 'gallery'
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
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Cart */}
        <Cart restaurant={restaurant} isDishModalOpen={isDishModalOpen} />

        {/* Fullscreen Search Overlay */}
        {isSearchOpen && (
          <div className="fixed inset-0 z-50 bg-white overflow-y-auto">
            <div className="w-full max-w-[480px] mx-auto min-h-screen flex flex-col">
              <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-4 pt-4 pb-3 shadow-sm">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => {
                      setIsSearchOpen(false);
                      setSearchTerm('');
                    }}
                    className="p-2 -ml-2 rounded-full hover:bg-gray-100 transition"
                    aria-label="Закрыть поиск"
                  >
                    <svg className="w-6 h-6 text-gray-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                  <div className="flex-1 flex items-center gap-3 rounded-2xl border border-gray-200 bg-gray-50 px-3 py-2">
                    <span className="text-gray-500">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35m0 0A7.5 7.5 0 104.5 4.5a7.5 7.5 0 0012.15 12.15z" />
                      </svg>
                    </span>
                    <input
                      ref={searchInputRef}
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Найти блюдо или описание"
                      className="flex-1 bg-transparent text-sm text-gray-900 placeholder:text-gray-500 focus:outline-none"
                      autoFocus
                    />
                    {searchTerm && (
                      <button
                        onClick={() => setSearchTerm('')}
                        className="text-gray-400 hover:text-gray-600 transition"
                        aria-label="Очистить поиск"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>
                {isSearching && (
                  <div className="mt-3 text-xs text-gray-500">
                    Найдено блюд: {searchResults.length}
                  </div>
                )}
              </div>

              <div className="flex-1 px-4 pb-6">
                {!isSearching && (
                  <div className="text-center text-gray-500 mt-12 text-sm">
                    Начните ввод, чтобы найти блюдо
                  </div>
                )}

                {isSearching && searchResults.length === 0 && (
                  <div className="text-center text-gray-500 mt-12 text-sm">
                    Ничего не найдено
                  </div>
                )}

                {isSearching && searchResults.length > 0 && (
                  <div className={`${restaurant.menuCardStyle === 'gallery' ? 'grid grid-cols-2 gap-2 sm:gap-3 items-stretch' : 'gap-4'} ${restaurant.menuCardStyle === 'vertical'
                    ? 'grid grid-cols-1'
                    : restaurant.menuCardStyle === 'grid'
                      ? 'grid grid-cols-2'
                      : restaurant.menuCardStyle === 'gallery'
                        ? 'grid grid-cols-2'
                        : 'flex flex-col'
                    }`}>
                    {searchResults.map((dish) => (
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
            </div>
          </div>
        )}

        {/* Bottom navigation для авторизованных клиентов */}
        {isCustomerLoggedIn && !isDishModalOpen && !isSearchOpen && <CustomerBottomNav />}
      </div>
      {/* Закрытие mobile wrapper */}
    </div>
  );
};

export default MenuPage;