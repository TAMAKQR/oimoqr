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
import { useTheme } from '../theme/ThemeProvider';

const clamp = (value, min = 0, max = 1) => Math.min(Math.max(value, min), max);

const hexToHsl = (hex) => {
  const normalized = hex.replace('#', '');
  const bigint = parseInt(normalized, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  const rNorm = r / 255;
  const gNorm = g / 255;
  const bNorm = b / 255;
  const max = Math.max(rNorm, gNorm, bNorm);
  const min = Math.min(rNorm, gNorm, bNorm);
  const delta = max - min;

  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (delta !== 0) {
    s = delta / (1 - Math.abs(2 * l - 1));
    switch (max) {
      case rNorm:
        h = ((gNorm - bNorm) / delta) % 6;
        break;
      case gNorm:
        h = (bNorm - rNorm) / delta + 2;
        break;
      default:
        h = (rNorm - gNorm) / delta + 4;
    }
    h *= 60;
  }

  return { h: (h + 360) % 360, s: Math.min(Math.max(s, 0), 1), l: Math.min(Math.max(l, 0), 1) };
};

const hslToHex = ({ h, s, l }) => {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;

  let r = 0;
  let g = 0;
  let b = 0;

  if (0 <= h && h < 60) {
    r = c; g = x; b = 0;
  } else if (60 <= h && h < 120) {
    r = x; g = c; b = 0;
  } else if (120 <= h && h < 180) {
    r = 0; g = c; b = x;
  } else if (180 <= h && h < 240) {
    r = 0; g = x; b = c;
  } else if (240 <= h && h < 300) {
    r = x; g = 0; b = c;
  } else {
    r = c; g = 0; b = x;
  }

  const toHex = (v) => {
    const val = Math.round((v + m) * 255);
    return val.toString(16).padStart(2, '0');
  };

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

const buildPaletteFromBase = (baseHex = '#009e47') => {
  const hsl = hexToHsl(baseHex);
  const steps = {
    50: 0.38,
    100: 0.32,
    200: 0.26,
    300: 0.2,
    400: 0.14,
    500: 0,
    600: -0.06,
    700: -0.12,
    800: -0.18,
    900: -0.24,
  };

  const palette = {};
  Object.entries(steps).forEach(([tone, delta]) => {
    const lightness = clamp(hsl.l + delta, 0.05, 0.95);
    palette[tone] = hslToHex({ h: hsl.h, s: hsl.s, l: lightness });
  });
  return palette;
};

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
  const { setTheme, themes, setCustomColors } = useTheme();
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
      if (data.primaryColor) {
        const palette = buildPaletteFromBase(data.primaryColor);
        setCustomColors(palette);
        setTheme('custom');
      } else if (themes?.custom?.colors) {
        setTheme('default');
        setCustomColors(themes.custom.colors);
      }
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
  }, [subdomain, setCustomColors, setTheme, themes]);

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
                className="bg-white rounded-full p-3 shadow-md border border-gray-200 hover:bg-gray-50 transition-colors"
                title="Войти"
              >
                <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
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
                    href={`https://www.instagram.com/${restaurant.instagram.replace('@', '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center rounded-full border border-gray-200 bg-white w-10 h-10 shadow-sm text-gray-700 hover:-translate-y-0.5 hover:shadow transition-transform"
                  >
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="18" height="18" rx="5" ry="5" />
                      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
                    </svg>
                  </a>
                )}
                {restaurant.facebook && (
                  <a
                    href={`https://www.facebook.com/${restaurant.facebook}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center rounded-full border border-gray-200 bg-white w-10 h-10 shadow-sm text-gray-700 hover:-translate-y-0.5 hover:shadow transition-transform"
                  >
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M13 10h2.5l.5-3H13V5.5c0-.9.3-1.5 1.6-1.5H16V1.2C15.3 1.1 14.1 1 13 1c-2.7 0-4 1.6-4 4.3V7H7v3h2v9h4z" />
                    </svg>
                  </a>
                )}
                {restaurant.whatsapp && (
                  <a
                    href={`https://wa.me/${restaurant.whatsapp.replace(/\D/g, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center rounded-full border border-gray-200 bg-white w-10 h-10 shadow-sm text-gray-700 hover:-translate-y-0.5 hover:shadow transition-transform"
                  >
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                    </svg>
                  </a>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Category Groups - Stories стиль с градиентом */}
        {restaurant.categoryGroups && restaurant.categoryGroups.length > 0 && (
          <div className="px-4 py-5 bg-gradient-to-b from-gray-50 to-white">
            <div className="flex gap-4 overflow-x-auto scrollbar-hide scroll-smooth pb-2">
              {restaurant.categoryGroups.map((group) => {
                const dishCount = group.categories?.reduce((sum, cat) =>
                  sum + (cat.dishes?.length || 0), 0
                ) || 0;

                return (
                  <button
                    key={group.id}
                    onClick={() => {
                      // Прокрутка к первой категории в группе
                      if (group.categories && group.categories.length > 0) {
                        handleCategoryClick(group.categories[0].id);
                      }
                    }}
                    className="flex flex-col items-center flex-shrink-0 w-20 group"
                  >
                    {group.image ? (
                      <div className="relative mb-2">
                        {/* Градиентное кольцо */}
                        <div className="w-[72px] h-[72px] rounded-full bg-gradient-to-tr from-primary-500 via-primary-400 to-primary-300 p-[2.5px] group-active:scale-95 transition-transform">
                          <div className="w-full h-full rounded-full bg-white p-[2px]">
                            <div className="w-full h-full rounded-full overflow-hidden">
                              <ImageWithLoader
                                src={group.image}
                                alt={group.name}
                                loading="lazy"
                                className="w-full h-full object-cover"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Бейдж с количеством блюд */}
                        {dishCount > 0 && (
                          <div className="absolute -bottom-1 -right-1 bg-primary-600 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center shadow-lg border-2 border-white">
                            {dishCount}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="w-[72px] h-[72px] rounded-full bg-gradient-to-tr from-gray-200 to-gray-300 flex items-center justify-center mb-2 group-active:scale-95 transition-transform">
                        <span className="text-2xl">📂</span>
                      </div>
                    )}

                    <div className="text-center w-full">
                      <h3 className="font-medium text-[11px] leading-tight text-gray-800 line-clamp-2 px-1">
                        {group.name}
                      </h3>
                    </div>
                  </button>
                );
              })}
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