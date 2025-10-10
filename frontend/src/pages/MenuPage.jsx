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
        <div className="container mx-auto px-4 py-6">
          <h1 className="text-3xl font-bold mb-2">{restaurant.name}</h1>
          {restaurant.address && (
            <p className="text-gray-600 mb-2">📍 {restaurant.address}</p>
          )}
          {restaurant.phone && (
            <p className="text-gray-600 mb-2">📞 {restaurant.phone}</p>
          )}
          
          {/* Social Links */}
          {(restaurant.instagram || restaurant.facebook || restaurant.whatsapp) && (
            <div className="flex gap-4 mt-4">
              {restaurant.instagram && (
                <a
                  href={`https://instagram.com/${restaurant.instagram}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-pink-600 hover:text-pink-700"
                >
                  Instagram
                </a>
              )}
              {restaurant.facebook && (
                <a
                  href={`https://facebook.com/${restaurant.facebook}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-700"
                >
                  Facebook
                </a>
              )}
              {restaurant.whatsapp && (
                <a
                  href={`https://wa.me/${restaurant.whatsapp.replace(/\D/g, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-green-600 hover:text-green-700"
                >
                  WhatsApp
                </a>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Categories */}
      <div className="bg-white border-b sticky top-0 z-30">
        <div className="container mx-auto px-4">
          <div className="flex gap-4 overflow-x-auto py-4">
            {restaurant.categories.map((category) => (
              <button
                key={category.id}
                onClick={() => setSelectedCategory(category.id)}
                className={`px-6 py-2 rounded-full whitespace-nowrap transition-colors ${
                  selectedCategory === category.id
                    ? 'bg-primary-600 text-white'
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
      <div className="container mx-auto px-4 py-8">
        {currentCategory && (
          <>
            <h2 className="text-2xl font-bold mb-6">{currentCategory.name}</h2>
            {currentCategory.description && (
              <p className="text-gray-600 mb-6">{currentCategory.description}</p>
            )}
            
            {currentCategory.dishes.length === 0 ? (
              <p className="text-center text-gray-500 py-8">
                В этой категории пока нет блюд
              </p>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
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