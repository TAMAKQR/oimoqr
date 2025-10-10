import { useState, useEffect } from 'react';
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

  const currentCategory = restaurant.categories.find(c => c.id === selectedCategory);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Banner Slider */}
      <BannerSlider banners={restaurant.banners} />

      {/* Restaurant Info */}
      <div className="bg-white shadow-sm">
        <div className="container mx-auto px-4 py-4 sm:py-6">
          <h1 className="text-2xl sm:text-3xl font-bold mb-2 break-words">{restaurant.name}</h1>
          {restaurant.address && (
            <p className="text-sm sm:text-base text-gray-600 mb-2 break-words">📍 {restaurant.address}</p>
          )}
          {restaurant.phone && (
            <p className="text-sm sm:text-base text-gray-600 mb-2">📞 {restaurant.phone}</p>
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
                onClick={() => setSelectedCategory(category.id)}
                className={`px-4 sm:px-6 py-2 rounded-full whitespace-nowrap transition-colors text-sm sm:text-base font-medium ${
                  selectedCategory === category.id
                    ? 'bg-primary-600 text-white shadow-md'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                {category.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Dishes */}
      <div className="container mx-auto px-4 py-6 sm:py-8 pb-24">
        {currentCategory && (
          <>
            <h2 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6 break-words">{currentCategory.name}</h2>
            {currentCategory.description && (
              <p className="text-sm sm:text-base text-gray-600 mb-4 sm:mb-6 break-words">{currentCategory.description}</p>
            )}
            
            {currentCategory.dishes.length === 0 ? (
              <p className="text-center text-gray-500 py-8 text-sm sm:text-base">
                В этой категории пока нет блюд
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                {currentCategory.dishes.map((dish) => (
                  <DishCard 
                    key={dish.id} 
                    dish={dish} 
                    currency={restaurant.currency || '₽'}
                    style={restaurant.menuCardStyle || 'horizontal'}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Cart */}
      <Cart restaurant={restaurant} />
    </div>
  );
};

export default MenuPage;