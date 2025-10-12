import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { restaurantService } from '../services/restaurantService';
import BannerSlider from '../components/BannerSlider';
import DishCard from '../components/DishCard';
import Cart from '../components/Cart';

const MenuPage = () => {
  const { subdomain } = useParams();
  const [restaurant, setRestaurant] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(null);
  const categoryRefs = useRef({});
  const categoryButtonRefs = useRef({});
  const isUserClick = useRef(false);

  useEffect(() => {
    loadRestaurant();
  }, [subdomain]);

  const loadRestaurant = async () => {
    try {
      const data = await restaurantService.getBySubdomain(subdomain);
      setRestaurant(data);
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
        
        const categoryId = parseInt(topEntry.target.dataset.categoryId);
        setSelectedCategory(categoryId);
        
        // Автоматически скроллим кнопку категории в видимую область
        const categoryButton = categoryButtonRefs.current[categoryId];
        if (categoryButton) {
          categoryButton.scrollIntoView({
            behavior: 'smooth',
            block: 'nearest',
            inline: 'center'
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
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Загрузка...</div>
      </div>
    );
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
              <h1 className="text-2xl sm:text-3xl font-bold mb-2 break-words">{restaurant.name}</h1>
              {restaurant.address && (
                <p className="text-sm sm:text-base text-gray-600 mb-2 break-words">📍 {restaurant.address}</p>
              )}
              {restaurant.phone && (
                <p className="text-sm sm:text-base text-gray-600 mb-2">📞 {restaurant.phone}</p>
              )}
            </div>
          </div>
          {!restaurant.logo && (
            <>
              {restaurant.address && (
                <p className="text-sm sm:text-base text-gray-600 mb-2 break-words">📍 {restaurant.address}</p>
              )}
              {restaurant.phone && (
                <p className="text-sm sm:text-base text-gray-600 mb-2">📞 {restaurant.phone}</p>
              )}
            </>
          )}
          
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
      <div className="bg-white border-b sticky top-0 z-30 shadow-sm">
        <div className="container mx-auto px-4">
          <div className="flex gap-2 sm:gap-4 overflow-x-auto py-3 sm:py-4 scrollbar-hide">
            {restaurant.categories.map((category) => (
              <button
                key={category.id}
                ref={(el) => (categoryButtonRefs.current[category.id] = el)}
                onClick={() => handleCategoryClick(category.id)}
                className={`relative px-4 sm:px-6 py-2 rounded-full whitespace-nowrap transition-all duration-300 text-sm sm:text-base font-medium ${
                  selectedCategory === category.id
                    ? 'bg-primary-600 text-white shadow-lg scale-105 ring-2 ring-primary-300'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                {category.name}
                {/* Индикатор активной категории */}
                {selectedCategory === category.id && (
                  <span className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-2 h-2 bg-primary-600 rounded-full animate-pulse"></span>
                )}
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
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                {category.dishes.map((dish) => (
                  <DishCard 
                    key={dish.id} 
                    dish={dish} 
                    currency={restaurant.currency || '₽'}
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