import { prisma } from '../config/prisma.js';

const YANDEX_GEOCODER_KEY = process.env.YANDEX_GEOCODER_KEY || '';

// Функция для расчета расстояния по формуле гаверсинусов
export function getDistance(lat1, lon1, lat2, lon2) {
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

export const getNetworkRankedDeliveryPoints = async ({ ownerId, latitude, longitude }) => {
  const networkRestaurants = await prisma.restaurant.findMany({
    where: {
      ownerId,
      deliveryEnabled: true,
      latitude: { not: null },
      longitude: { not: null }
    },
    select: {
      id: true,
      name: true,
      subdomain: true,
      address: true,
      latitude: true,
      longitude: true,
      deliveryRadius: true,
      minOrderAmount: true,
      deliveryFee: true,
      freeDeliveryThreshold: true,
      currency: true
    }
  });

  if (networkRestaurants.length === 0) {
    return [];
  }

  return networkRestaurants
    .map((restaurant) => {
      const distance = getDistance(latitude, longitude, restaurant.latitude, restaurant.longitude);
      const inDeliveryZone = restaurant.deliveryRadius ? distance <= restaurant.deliveryRadius : true;

      return {
        ...restaurant,
        distance,
        inDeliveryZone
      };
    })
    .sort((a, b) => a.distance - b.distance);
};

export const checkDelivery = async (req, res, next) => {
  const { restaurantId, subdomain, latitude, longitude } = req.query;

  if ((!restaurantId && !subdomain) || !latitude || !longitude) {
    return res.status(400).json({ error: 'restaurantId or subdomain, latitude, and longitude are required' });
  }

  try {
    const userLat = parseFloat(latitude);
    const userLon = parseFloat(longitude);

    if (!Number.isFinite(userLat) || !Number.isFinite(userLon)) {
      return res.status(400).json({ error: 'Invalid latitude or longitude' });
    }

    const baseRestaurant = subdomain
      ? await prisma.restaurant.findUnique({
        where: { subdomain },
        select: { id: true, ownerId: true }
      })
      : await prisma.restaurant.findUnique({
        where: { id: restaurantId },
        select: { id: true, ownerId: true }
      });

    if (!baseRestaurant) {
      return res.status(404).json({ error: 'Restaurant not found' });
    }

    const ranked = await getNetworkRankedDeliveryPoints({
      ownerId: baseRestaurant.ownerId,
      latitude: userLat,
      longitude: userLon
    });

    if (ranked.length === 0) {
      return res.json({
        deliveryAvailable: false,
        inDeliveryZone: false,
        message: 'No active delivery points found in this network',
        servingRestaurant: null,
        alternatives: []
      });
    }

    const nearestInZone = ranked.find((r) => r.inDeliveryZone);

    if (!nearestInZone) {
      return res.json({
        deliveryAvailable: false,
        inDeliveryZone: false,
        message: 'Address is outside the network delivery zone',
        servingRestaurant: null,
        alternatives: ranked.slice(0, 5).map((r) => ({
          id: r.id,
          name: r.name,
          subdomain: r.subdomain,
          address: r.address,
          distance: Number(r.distance.toFixed(2)),
          inDeliveryZone: r.inDeliveryZone
        }))
      });
    }

    res.json({
      deliveryAvailable: true,
      inDeliveryZone: true,
      distance: Number(nearestInZone.distance.toFixed(2)),
      deliveryRadius: nearestInZone.deliveryRadius,
      message: 'Delivery is available for this address',
      servingRestaurant: {
        id: nearestInZone.id,
        name: nearestInZone.name,
        subdomain: nearestInZone.subdomain,
        distance: Number(nearestInZone.distance.toFixed(2)),
        deliveryRadius: nearestInZone.deliveryRadius,
        deliveryFee: nearestInZone.deliveryFee,
        minOrderAmount: nearestInZone.minOrderAmount,
        freeDeliveryThreshold: nearestInZone.freeDeliveryThreshold,
        currency: nearestInZone.currency
      },
      alternatives: ranked.slice(0, 5).map((r) => ({
        id: r.id,
        name: r.name,
        subdomain: r.subdomain,
        address: r.address,
        distance: Number(r.distance.toFixed(2)),
        inDeliveryZone: r.inDeliveryZone
      }))
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

export const getNearestRestaurantBySubdomain = async (req, res, next) => {
  const { subdomain, latitude, longitude } = req.query;

  if (!subdomain || !latitude || !longitude) {
    return res.status(400).json({ error: 'subdomain, latitude and longitude are required' });
  }

  try {
    const baseRestaurant = await prisma.restaurant.findUnique({
      where: { subdomain },
      select: { id: true, ownerId: true }
    });

    if (!baseRestaurant) {
      return res.status(404).json({ error: 'Restaurant not found' });
    }

    const userLat = parseFloat(latitude);
    const userLon = parseFloat(longitude);

    if (!Number.isFinite(userLat) || !Number.isFinite(userLon)) {
      return res.status(400).json({ error: 'Invalid latitude or longitude' });
    }

    const ranked = await getNetworkRankedDeliveryPoints({
      ownerId: baseRestaurant.ownerId,
      latitude: userLat,
      longitude: userLon
    });

    if (ranked.length === 0) {
      return res.status(404).json({ error: 'No delivery points found for this network' });
    }

    const nearestInZone = ranked.find((r) => r.inDeliveryZone);

    res.json({
      nearestRestaurant: nearestInZone
        ? {
          ...nearestInZone,
          distance: Number(nearestInZone.distance.toFixed(2))
        }
        : null,
      inDeliveryZone: Boolean(nearestInZone),
      alternatives: ranked.slice(0, 5).map((r) => ({
        ...r,
        distance: Number(r.distance.toFixed(2))
      }))
    });
  } catch (error) {
    next(error);
  }
};

// Address suggestions via Yandex Geocoder API
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
