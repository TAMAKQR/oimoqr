import { prisma } from '../config/prisma.js';
import { getRestaurantDeliveryStatus } from '../utils/schedule.js';

const YANDEX_GEOCODER_KEY = process.env.YANDEX_GEOCODER_KEY || '';
const TRUE_VALUES = new Set(['1', 'true', 'yes', 'on']);

const parseBoolean = (value) => TRUE_VALUES.has(String(value || '').toLowerCase());

const normalizeLocationText = (value) => String(value || '')
  .toLowerCase()
  .replace(/ё/g, 'е')
  .replace(/[^a-zа-я0-9\s-]/gi, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const detectCityFromComponents = (components = []) => {
  const kindsPriority = ['locality', 'province', 'area', 'district'];
  for (const kind of kindsPriority) {
    const candidate = components.find((component) => component?.kind === kind && component?.name);
    if (candidate?.name) return candidate.name;
  }
  return '';
};

const isCityMatched = ({ expectedCity, detectedCity, fullAddress }) => {
  const normalizedExpected = normalizeLocationText(expectedCity);
  if (!normalizedExpected) return true;

  const normalizedDetected = normalizeLocationText(detectedCity);
  if (normalizedDetected && (
    normalizedDetected === normalizedExpected
    || normalizedDetected.includes(normalizedExpected)
    || normalizedExpected.includes(normalizedDetected)
  )) {
    return true;
  }

  const normalizedAddress = normalizeLocationText(fullAddress);
  return normalizedAddress.includes(normalizedExpected);
};

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

export const getNetworkRankedDeliveryPoints = async ({ ownerId, latitude, longitude, city = null }) => {
  const cityFilter = String(city || '').trim();
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
      city: true,
      latitude: true,
      longitude: true,
      deliveryRadius: true,
      minOrderAmount: true,
      deliveryFee: true,
      freeDeliveryThreshold: true,
      currency: true,
      workingHours: true,
      deliveryHours: true,
      isTemporarilyClosed: true
    }
  });

  const scopedRestaurants = cityFilter
    ? networkRestaurants.filter((restaurant) => isCityMatched({
      expectedCity: cityFilter,
      detectedCity: restaurant.city,
      fullAddress: restaurant.address
    }))
    : networkRestaurants;

  if (scopedRestaurants.length === 0) {
    return [];
  }

  return scopedRestaurants
    .map((restaurant) => {
      const distance = getDistance(latitude, longitude, restaurant.latitude, restaurant.longitude);
      const inDeliveryZone = restaurant.deliveryRadius ? distance <= restaurant.deliveryRadius : true;
      const deliveryStatus = getRestaurantDeliveryStatus(restaurant);

      return {
        ...restaurant,
        distance,
        inDeliveryZone,
        deliveryOpenNow: deliveryStatus.isOpen,
        deliveryStatusMessage: deliveryStatus.message
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
        select: { id: true, ownerId: true, city: true }
      })
      : await prisma.restaurant.findUnique({
        where: { id: restaurantId },
        select: { id: true, ownerId: true, city: true }
      });

    if (!baseRestaurant) {
      return res.status(404).json({ error: 'Restaurant not found' });
    }

    const enforcedCity = String(baseRestaurant.city || '').trim();
    const ranked = await getNetworkRankedDeliveryPoints({
      ownerId: baseRestaurant.ownerId,
      latitude: userLat,
      longitude: userLon,
      city: enforcedCity || null
    });

    if (ranked.length === 0) {
      return res.json({
        deliveryAvailable: false,
        inDeliveryZone: false,
        message: enforcedCity
          ? `Доставка доступна только в городе ${enforcedCity}`
          : 'Активные точки доставки сети не найдены',
        servingRestaurant: null,
        alternatives: []
      });
    }

    const nearestInZone = ranked.find((r) => r.inDeliveryZone && r.deliveryOpenNow);

    if (!nearestInZone) {
      const nearestClosedInZone = ranked.find((r) => r.inDeliveryZone);

      if (nearestClosedInZone) {
        return res.json({
          deliveryAvailable: false,
          inDeliveryZone: true,
          message: nearestClosedInZone.deliveryStatusMessage
            ? `Доставка сейчас недоступна: ${nearestClosedInZone.deliveryStatusMessage}`
            : 'Доставка сейчас недоступна для этого адреса',
          servingRestaurant: {
            id: nearestClosedInZone.id,
            name: nearestClosedInZone.name,
            subdomain: nearestClosedInZone.subdomain,
            distance: Number(nearestClosedInZone.distance.toFixed(2)),
            deliveryRadius: nearestClosedInZone.deliveryRadius,
            deliveryOpenNow: false,
            deliveryStatusMessage: nearestClosedInZone.deliveryStatusMessage
          },
          alternatives: ranked.slice(0, 5).map((r) => ({
            id: r.id,
            name: r.name,
            subdomain: r.subdomain,
            address: r.address,
            distance: Number(r.distance.toFixed(2)),
            inDeliveryZone: r.inDeliveryZone,
            deliveryOpenNow: r.deliveryOpenNow,
            deliveryStatusMessage: r.deliveryStatusMessage
          }))
        });
      }
    }

    if (!nearestInZone) {
      return res.json({
        deliveryAvailable: false,
        inDeliveryZone: false,
        message: enforcedCity
          ? `Адрес вне зоны доставки в городе ${enforcedCity}`
          : 'Адрес вне зоны доставки сети',
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
      message: 'Доставка доступна для этого адреса',
      servingRestaurant: {
        id: nearestInZone.id,
        name: nearestInZone.name,
        subdomain: nearestInZone.subdomain,
        distance: Number(nearestInZone.distance.toFixed(2)),
        deliveryRadius: nearestInZone.deliveryRadius,
        deliveryFee: nearestInZone.deliveryFee,
        minOrderAmount: nearestInZone.minOrderAmount,
        freeDeliveryThreshold: nearestInZone.freeDeliveryThreshold,
        currency: nearestInZone.currency,
        deliveryOpenNow: nearestInZone.deliveryOpenNow,
        deliveryStatusMessage: nearestInZone.deliveryStatusMessage
      },
      alternatives: ranked.slice(0, 5).map((r) => ({
        id: r.id,
        name: r.name,
        subdomain: r.subdomain,
        address: r.address,
        distance: Number(r.distance.toFixed(2)),
        inDeliveryZone: r.inDeliveryZone,
        deliveryOpenNow: r.deliveryOpenNow,
        deliveryStatusMessage: r.deliveryStatusMessage
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
      select: { id: true, ownerId: true, city: true }
    });

    if (!baseRestaurant) {
      return res.status(404).json({ error: 'Restaurant not found' });
    }

    const userLat = parseFloat(latitude);
    const userLon = parseFloat(longitude);

    if (!Number.isFinite(userLat) || !Number.isFinite(userLon)) {
      return res.status(400).json({ error: 'Invalid latitude or longitude' });
    }

    const enforcedCity = String(baseRestaurant.city || '').trim();
    const ranked = await getNetworkRankedDeliveryPoints({
      ownerId: baseRestaurant.ownerId,
      latitude: userLat,
      longitude: userLon,
      city: enforcedCity || null
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
  const expectedCity = String(city || '').trim();
  const strictCity = parseBoolean(req.query.strictCity);
  const shouldFilterByCity = Boolean(expectedCity) && strictCity;

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
      const detectedCity = detectCityFromComponents(addressDetails);
      const cityMatched = isCityMatched({
        expectedCity,
        detectedCity,
        fullAddress: meta?.text || ''
      });
      const street = addressDetails.filter(c => c.kind === 'street').map(c => c.name).join(', ');
      const house = addressDetails.filter(c => c.kind === 'house').map(c => c.name).join(', ');
      const locality = addressDetails.filter(c => c.kind === 'locality').map(c => c.name).join(', ');
      const [lon, lat] = geo.Point.pos.split(' ').map(Number);

      return {
        title: street ? `${street}${house ? ', ' + house : ''}` : geo.name || '',
        subtitle: locality || meta?.text || '',
        fullAddress: meta?.text || '',
        city: detectedCity || '',
        cityMatched,
        latitude: lat,
        longitude: lon
      };
    }).filter(s => s.title && (!shouldFilterByCity || s.cityMatched));

    res.json({ suggestions });
  } catch (error) {
    console.error('Yandex Suggest via Geocoder error:', error);
    res.json({ suggestions: [] });
  }
};

// Геокодинг адреса через Yandex Geocoder API
export const geocodeAddress = async (req, res, next) => {
  const { address, city } = req.query;
  const strictCity = parseBoolean(req.query.strictCity);

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
    const components = geoObject?.metaDataProperty?.GeocoderMetaData?.Address?.Components || [];
    const detectedCity = detectCityFromComponents(components);
    const [lon, lat] = geoObject.Point.pos.split(' ').map(Number);
    const formattedAddress = geoObject.metaDataProperty?.GeocoderMetaData?.text || address;
    const cityMatched = isCityMatched({
      expectedCity: city,
      detectedCity,
      fullAddress: formattedAddress
    });

    if (strictCity && city && !cityMatched) {
      return res.json({
        found: false,
        cityMismatch: true,
        message: `Адрес должен быть в городе ${city}`
      });
    }

    res.json({
      found: true,
      latitude: lat,
      longitude: lon,
      formattedAddress,
      detectedCity: detectedCity || '',
      cityMatched
    });
  } catch (error) {
    console.error('Yandex Geocoder error:', error);
    next(error);
  }
};
