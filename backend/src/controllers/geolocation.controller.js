import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Функция для расчета расстояния по формуле гаверсинусов
function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Радиус Земли в км
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  return distance;
}

export const checkDelivery = async (req, res, next) => {
  const { restaurantId, latitude, longitude } = req.query;

  if (!restaurantId || !latitude || !longitude) {
    return res.status(400).json({ error: 'restaurantId, latitude, and longitude are required' });
  }

  try {
    const restaurant = await prisma.restaurant.findUnique({
      where: { id: restaurantId },
      select: { latitude: true, longitude: true, deliveryRadius: true }
    });

    if (!restaurant || !restaurant.latitude || !restaurant.longitude || !restaurant.deliveryRadius) {
      return res.json({ deliveryAvailable: false, message: 'Для этого ресторана не настроена зона доставки.' });
    }

    const userLat = parseFloat(latitude);
    const userLon = parseFloat(longitude);

    const distance = getDistance(userLat, userLon, restaurant.latitude, restaurant.longitude);
    const deliveryAvailable = distance <= restaurant.deliveryRadius;

    res.json({
      deliveryAvailable,
      distance: distance.toFixed(2),
      deliveryRadius: restaurant.deliveryRadius,
      message: deliveryAvailable
        ? 'Доставка доступна по вашему адресу'
        : `Вы находитесь за пределами зоны доставки (${restaurant.deliveryRadius} км)`
    });
  } catch (error) {
    next(error);
  }
};

export const getNearbyRestaurants = async (req, res, next) => {
  const { latitude, longitude } = req.query;

  if (!latitude || !longitude) {
    return res.status(400).json({ error: 'Latitude and longitude are required' });
  }

  try {
    const userLat = parseFloat(latitude);
    const userLon = parseFloat(longitude);

    const allRestaurants = await prisma.restaurant.findMany({
      where: {
        deliveryEnabled: true,
        latitude: { not: null },
        longitude: { not: null },
      },
      select: {
        id: true,
        name: true,
        subdomain: true,
        address: true,
        latitude: true,
        longitude: true,
        deliveryRadius: true,
      },
    });

    const restaurantsWithDistance = allRestaurants.map(r => ({
      ...r,
      distance: getDistance(userLat, userLon, r.latitude, r.longitude),
    })).sort((a, b) => a.distance - b.distance);

    res.json(restaurantsWithDistance);
  } catch (error) {
    next(error);
  }
};