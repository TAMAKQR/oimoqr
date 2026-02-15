import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const YANDEX_GEOCODER_KEY = process.env.YANDEX_GEOCODER_KEY || '';

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

// Подсказки адресов через Yandex Geocoder API (множественные результаты)
export const suggestAddress = async (req, res, next) => {
  const { text, city, country } = req.query;

  if (!text || text.length < 3) {
    return res.json({ suggestions: [] });
  }

  if (!YANDEX_GEOCODER_KEY) {
    return res.status(500).json({ error: 'Ключ Yandex не настроен' });
  }

  try {
    // Формируем запрос с учётом города/страны для точности
    let query = text;
    if (city && !text.toLowerCase().includes(city.toLowerCase())) {
      query = `${city}, ${text}`;
    } else if (country && !text.toLowerCase().includes(country.toLowerCase())) {
      query = `${country}, ${text}`;
    }

    const url = `https://geocode-maps.yandex.ru/1.x/?apikey=${YANDEX_GEOCODER_KEY}&geocode=${encodeURIComponent(query)}&format=json&results=5&kind=house`;
    const response = await fetch(url);
    const data = await response.json();

    const featureMembers = data?.response?.GeoObjectCollection?.featureMember || [];
    const suggestions = featureMembers.map(item => {
      const geo = item.GeoObject;
      const meta = geo.metaDataProperty?.GeocoderMetaData;
      const addressDetails = meta?.Address?.Components || [];
      const street = addressDetails.filter(c => c.kind === 'street').map(c => c.name).join(', ');
      const house = addressDetails.filter(c => c.kind === 'house').map(c => c.name).join(', ');
      const locality = addressDetails.filter(c => c.kind === 'locality').map(c => c.name).join(', ');
      const [lon, lat] = geo.Point.pos.split(' ').map(Number);

      return {
        title: street ? `${street}${house ? ', ' + house : ''}` : geo.name || '',
        subtitle: locality || meta?.text || '',
        fullAddress: meta?.text || '',
        latitude: lat,
        longitude: lon
      };
    }).filter(s => s.title);

    res.json({ suggestions });
  } catch (error) {
    console.error('Yandex Suggest via Geocoder error:', error);
    res.json({ suggestions: [] });
  }
};

// Геокодинг адреса через Yandex Geocoder API
export const geocodeAddress = async (req, res, next) => {
  const { address } = req.query;

  if (!address) {
    return res.status(400).json({ error: 'Укажите адрес' });
  }

  if (!YANDEX_GEOCODER_KEY) {
    return res.status(500).json({ error: 'Ключ Yandex Geocoder не настроен' });
  }

  try {
    const url = `https://geocode-maps.yandex.ru/1.x/?apikey=${YANDEX_GEOCODER_KEY}&geocode=${encodeURIComponent(address)}&format=json&results=1`;
    const response = await fetch(url);
    const data = await response.json();

    const featureMember = data?.response?.GeoObjectCollection?.featureMember;
    if (!featureMember || featureMember.length === 0) {
      return res.json({ found: false, message: 'Адрес не найден' });
    }

    const geoObject = featureMember[0].GeoObject;
    const [lon, lat] = geoObject.Point.pos.split(' ').map(Number);
    const formattedAddress = geoObject.metaDataProperty?.GeocoderMetaData?.text || address;

    res.json({
      found: true,
      latitude: lat,
      longitude: lon,
      formattedAddress
    });
  } catch (error) {
    console.error('Yandex Geocoder error:', error);
    next(error);
  }
};