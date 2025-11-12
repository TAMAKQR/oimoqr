import { prisma } from '../config/prisma.js';

// Формула Haversine для расчета расстояния между двумя точками
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Радиус Земли в км
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  
  return distance; // Расстояние в км
};

// Найти ближайшие рестораны
export const findNearbyRestaurants = async (req, res, next) => {
  try {
    const { latitude, longitude, maxDistance = 50 } = req.query;

    if (!latitude || !longitude) {
      return res.status(400).json({ 
        error: 'Coordinates are required (latitude, longitude)' 
      });
    }

    const userLat = parseFloat(latitude);
    const userLon = parseFloat(longitude);
    const maxDist = parseFloat(maxDistance);

    // Получить все рестораны с координатами
    const restaurants = await prisma.restaurant.findMany({
      where: {
        latitude: { not: null },
        longitude: { not: null },
        isTemporarilyClosed: false
      },
      include: {
        socialLinks: true,
        categories: {
          orderBy: { order: 'asc' }
        }
      }
    });

    // Рассчитать расстояние до каждого ресторана
    const restaurantsWithDistance = restaurants
      .map(restaurant => {
        const distance = calculateDistance(
          userLat, 
          userLon, 
          restaurant.latitude, 
          restaurant.longitude
        );

        // Проверить, попадает ли пользователь в зону доставки
        const isInDeliveryZone = restaurant.deliveryRadius 
          ? distance <= restaurant.deliveryRadius 
          : true; // Если радиус не установлен, считаем что доставка возможна

        return {
          ...restaurant,
          distance: parseFloat(distance.toFixed(2)),
          isInDeliveryZone,
          deliveryAvailable: restaurant.deliveryEnabled && isInDeliveryZone
        };
      })
      .filter(r => r.distance <= maxDist) // Фильтр по максимальному расстоянию
      .sort((a, b) => a.distance - b.distance); // Сортировка по расстоянию

    res.json({
      userLocation: { latitude: userLat, longitude: userLon },
      count: restaurantsWithDistance.length,
      restaurants: restaurantsWithDistance
    });
  } catch (error) {
    console.error('Find nearby restaurants error:', error);
    next(error);
  }
};

// Найти ближайший ресторан
export const findNearestRestaurant = async (req, res, next) => {
  try {
    const { latitude, longitude } = req.query;

    if (!latitude || !longitude) {
      return res.status(400).json({ 
        error: 'Coordinates are required (latitude, longitude)' 
      });
    }

    const userLat = parseFloat(latitude);
    const userLon = parseFloat(longitude);

    const restaurants = await prisma.restaurant.findMany({
      where: {
        latitude: { not: null },
        longitude: { not: null },
        isTemporarilyClosed: false
      },
      include: {
        socialLinks: true,
        categories: {
          orderBy: { order: 'asc' }
        }
      }
    });

    if (restaurants.length === 0) {
      return res.status(404).json({ 
        error: 'No restaurants found with coordinates' 
      });
    }

    // Найти ближайший
    let nearest = null;
    let minDistance = Infinity;

    restaurants.forEach(restaurant => {
      const distance = calculateDistance(
        userLat, 
        userLon, 
        restaurant.latitude, 
        restaurant.longitude
      );

      if (distance < minDistance) {
        minDistance = distance;
        nearest = {
          ...restaurant,
          distance: parseFloat(distance.toFixed(2)),
          isInDeliveryZone: restaurant.deliveryRadius 
            ? distance <= restaurant.deliveryRadius 
            : true,
          deliveryAvailable: restaurant.deliveryEnabled && 
            (restaurant.deliveryRadius ? distance <= restaurant.deliveryRadius : true)
        };
      }
    });

    res.json({
      userLocation: { latitude: userLat, longitude: userLon },
      restaurant: nearest
    });
  } catch (error) {
    console.error('Find nearest restaurant error:', error);
    next(error);
  }
};

export const checkBrandDelivery = async (req, res, next) => {
  try {
    const { restaurantId, latitude, longitude } = req.query;

    if (!restaurantId || !latitude || !longitude) {
      return res.status(400).json({ 
        error: 'restaurantId, latitude, and longitude are required' 
      });
    }

    const userLat = parseFloat(latitude);
    const userLon = parseFloat(longitude);

    // 1. Найти текущий ресторан и его владельца
    const currentRestaurant = await prisma.restaurant.findUnique({
      where: { id: restaurantId },
      select: { ownerId: true, name: true }
    });

    if (!currentRestaurant) {
      return res.status(404).json({ error: 'Current restaurant not found' });
    }

    // 2. Найти все рестораны этого владельца (всю сеть)
    const allBrandRestaurants = await prisma.restaurant.findMany({
      where: {
        ownerId: currentRestaurant.ownerId,
        latitude: { not: null },
        longitude: { not: null },
        isTemporarilyClosed: false,
        deliveryEnabled: true, // Ищем только те, где доставка в принципе включена
      }
    });

    // 3. Рассчитать расстояние до каждого и найти доступные
    const availableRestaurants = allBrandRestaurants
      .map(r => {
        const distance = calculateDistance(userLat, userLon, r.latitude, r.longitude);
        const isInZone = r.deliveryRadius ? distance <= r.deliveryRadius : true;
        
        if (isInZone) {
          return {
            ...r,
            distance: parseFloat(distance.toFixed(2)),
          };
        }
        return null;
      })
      .filter(Boolean) // Убрать null (недоступные)
      .sort((a, b) => a.distance - b.distance); // Сортировать по близости

    // 4. Проверить, доступен ли ТЕКУЩИЙ ресторан
    const isCurrentRestaurantAvailable = availableRestaurants.some(r => r.id === restaurantId);

    if (isCurrentRestaurantAvailable) {
      const current = availableRestaurants.find(r => r.id === restaurantId);
      return res.json({
        status: 'CURRENT_AVAILABLE',
        details: { ...current, message: 'Доставка доступна' }
      });
    }

    if (availableRestaurants.length > 0) {
      // Текущий недоступен, но есть другие
      return res.json({
        status: 'OTHERS_AVAILABLE',
        currentRestaurantName: currentRestaurant.name,
        nearest: availableRestaurants[0], // Ближайший
        options: availableRestaurants // Все доступные варианты
      });
    }

    // Ни один ресторан сети не доступен
    return res.status(404).json({
      status: 'NONE_AVAILABLE',
      message: `Доставка из ресторанов сети "${currentRestaurant.name}" по вашему адресу недоступна.`
    });

  } catch (error) {
    next(error);
  }
};

// Проверить доступность доставки по адресу
export const checkDeliveryAvailability = async (req, res, next) => {
  try {
    const { restaurantId, latitude, longitude } = req.query;

    if (!restaurantId || !latitude || !longitude) {
      return res.status(400).json({ 
        error: 'restaurantId, latitude, and longitude are required' 
      });
    }

    const restaurant = await prisma.restaurant.findUnique({
      where: { id: restaurantId }
    });

    if (!restaurant) {
      return res.status(404).json({ error: 'Restaurant not found' });
    }

    if (!restaurant.latitude || !restaurant.longitude) {
      return res.status(400).json({ 
        error: 'Restaurant does not have coordinates set' 
      });
    }

    const distance = calculateDistance(
      parseFloat(latitude),
      parseFloat(longitude),
      restaurant.latitude,
      restaurant.longitude
    );

    const isInDeliveryZone = restaurant.deliveryRadius 
      ? distance <= restaurant.deliveryRadius 
      : true;

    const deliveryAvailable = restaurant.deliveryEnabled && isInDeliveryZone;

    res.json({
      restaurantId: restaurant.id,
      restaurantName: restaurant.name,
      distance: parseFloat(distance.toFixed(2)),
      deliveryRadius: restaurant.deliveryRadius,
      isInDeliveryZone,
      deliveryAvailable,
      deliveryFee: deliveryAvailable ? restaurant.deliveryFee : null,
      message: deliveryAvailable 
        ? 'Доставка доступна' 
        : restaurant.deliveryRadius 
          ? `Вы находитесь за пределами зоны доставки (${restaurant.deliveryRadius} км)`
          : 'Доставка недоступна'
    });
  } catch (error) {
    console.error('Check delivery availability error:', error);
    next(error);
  }
};