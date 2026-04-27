import { prisma } from '../config/prisma.js';
import telegramService from '../services/telegram.service.js';
import { getDistance, getNetworkRankedDeliveryPoints } from './geolocation.controller.js';
import { buildTrustedOrderItems, calculateDeliveryFee } from '../utils/orderPricing.js';
import { loadModifierOptionStops } from '../utils/modifierOptionStops.js';
import { hasRestaurantAccess, ensureRestaurantAccess } from '../utils/restaurantAccess.js';
import { getRestaurantDeliveryStatus } from '../utils/schedule.js';

const ALLOWED_STATUSES = [
  'new',
  'confirmed',
  'preparing',
  'ready',
  'delivered',
  'completed',
  'cancelled'
];

const ensureOrderAccess = (req, res, order) => {
  if (!order) {
    res.status(404).json({ error: 'Order not found' });
    return false;
  }

  if (req?.user?.isAdmin) return true;

  const canAccessBaseRestaurant = hasRestaurantAccess(req, order.restaurantId);
  const canAccessAssignedRestaurant = order.assignedRestaurantId
    ? hasRestaurantAccess(req, order.assignedRestaurantId)
    : false;

  if (canAccessBaseRestaurant || canAccessAssignedRestaurant) {
    return true;
  }

  res.status(403).json({ error: 'Access denied for this order' });
  return false;
};

const generateOrderNumber = () => {
  const timestamp = Date.now().toString().slice(-6);
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `#${timestamp}${random}`;
};

const roundCurrency = (value) => Number((Number(value) || 0).toFixed(2));
const hasHouseNumber = (address = '') => /\d/.test(String(address || '').trim());
const normalizePhoneDigits = (phone = '') => String(phone || '').replace(/\D/g, '');

const getMenuSourceRestaurantId = async (restaurantId) => {
  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: { id: true, sharedMenuSourceRestaurantId: true }
  });

  if (!restaurant) return null;
  return restaurant.sharedMenuSourceRestaurantId || restaurant.id;
};

const getNearestServingRestaurant = async ({ restaurantId, latitude, longitude }) => {
  const baseRestaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: { ownerId: true, city: true }
  });

  if (!baseRestaurant) return null;

  const ranked = await getNetworkRankedDeliveryPoints({
    ownerId: baseRestaurant.ownerId,
    latitude,
    longitude,
    city: baseRestaurant.city || null
  });

  return ranked.find((r) => r.inDeliveryZone && getRestaurantDeliveryStatus(r).isOpen) || null;
};

const parseSelectedModifiers = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value;

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  return [];
};

export const createOrder = async (req, res, next) => {
  try {
    const {
      restaurantId,
      items,
      total,
      customerName,
      customerPhone,
      customerEmail,
      deliveryAddress,
      deliveryLatitude,
      deliveryLongitude,
      deliveryType,
      tableNumber,
      paymentMethod,
      comment
    } = req.body;

    if (!restaurantId || !items || total === undefined) {
      return res.status(400).json({
        error: 'restaurantId, items, and total are required'
      });
    }

    const parsedTotal = parseFloat(total);
    if (!Number.isFinite(parsedTotal)) {
      return res.status(400).json({ error: 'Invalid total amount' });
    }

    const normalizedDeliveryType = deliveryType || 'delivery';
    const normalizedCustomerName = String(customerName || '').trim();
    const normalizedCustomerPhone = String(customerPhone || '').trim();
    const normalizedDeliveryAddress = String(deliveryAddress || '').trim();
    const phoneDigits = normalizePhoneDigits(normalizedCustomerPhone);

    const restaurantDetails = await prisma.restaurant.findUnique({
      where: { id: restaurantId },
      select: { id: true, businessType: true }
    });

    if (!restaurantDetails) {
      return res.status(404).json({ error: 'Restaurant not found' });
    }

    if (restaurantDetails.businessType === 'ONLINE_STORE' && normalizedDeliveryType === 'dine_in') {
      return res.status(400).json({ error: 'Заказ в зале недоступен для магазина' });
    }

    if (normalizedDeliveryType !== 'dine_in') {
      if (normalizedCustomerName.length < 2 || phoneDigits.length < 8) {
        return res.status(400).json({ error: 'Укажите имя и корректный телефон' });
      }
    }

    if (normalizedDeliveryType === 'delivery') {
      if (!normalizedDeliveryAddress) {
        return res.status(400).json({ error: 'Укажите адрес доставки' });
      }
      if (!hasHouseNumber(normalizedDeliveryAddress)) {
        return res.status(400).json({ error: 'Укажите улицу и номер дома' });
      }
    }

    const validItems = items.filter(item => item && item.id);

    const requestedDishIds = validItems.map(item => item.id);
    const menuSourceRestaurantId = await getMenuSourceRestaurantId(restaurantId);
    if (!menuSourceRestaurantId) {
      return res.status(404).json({ error: 'Restaurant not found' });
    }

    const existingDishes = await prisma.dish.findMany({
      where: {
        id: { in: requestedDishIds },
        restaurantId: menuSourceRestaurantId
      },
      select: { id: true }
    });

    if (existingDishes.length !== requestedDishIds.length) {
      const notFoundIds = requestedDishIds.filter(id => !existingDishes.some(d => d.id === id));
      return res.status(400).json({ error: `One or more dishes not found: ${notFoundIds.join(', ')}` });
    }

    let normalizedDeliveryLatitude = deliveryLatitude !== undefined && deliveryLatitude !== null
      ? parseFloat(deliveryLatitude)
      : null;
    let normalizedDeliveryLongitude = deliveryLongitude !== undefined && deliveryLongitude !== null
      ? parseFloat(deliveryLongitude)
      : null;

    if (!Number.isFinite(normalizedDeliveryLatitude)) normalizedDeliveryLatitude = null;
    if (!Number.isFinite(normalizedDeliveryLongitude)) normalizedDeliveryLongitude = null;

    let assignedRestaurantId = null;
    let servingRestaurantId = restaurantId;
    let nearestServingPoint = null;

    if (normalizedDeliveryType === 'delivery') {
      if (!Number.isFinite(normalizedDeliveryLatitude) || !Number.isFinite(normalizedDeliveryLongitude)) {
        return res.status(400).json({ error: 'Delivery coordinates are required' });
      }

      const nearest = await getNearestServingRestaurant({
        restaurantId,
        latitude: normalizedDeliveryLatitude,
        longitude: normalizedDeliveryLongitude
      });

      if (!nearest?.id) {
        return res.status(400).json({ error: 'Delivery is unavailable for this address' });
      }

      servingRestaurantId = nearest.id;
      nearestServingPoint = nearest;
      if (nearest.id !== restaurantId) {
        assignedRestaurantId = nearest.id;
      }

    }

    const trustedPricing = await buildTrustedOrderItems({
      items,
      menuSourceRestaurantId,
      deliveryType: normalizedDeliveryType
    });

    if (!trustedPricing.ok) {
      return res.status(400).json({ error: trustedPricing.error || 'Invalid order payload' });
    }

    const { trustedItems, itemsSubtotal, dishIds, modifierOptionIds } = trustedPricing;

    let servingRestaurantPricing = null;
    if (normalizedDeliveryType === 'delivery') {
      servingRestaurantPricing = nearestServingPoint || await prisma.restaurant.findUnique({
        where: { id: servingRestaurantId },
        select: {
          minOrderAmount: true,
          deliveryFee: true,
          freeDeliveryThreshold: true
        }
      });

      if (servingRestaurantPricing?.minOrderAmount && itemsSubtotal < Number(servingRestaurantPricing.minOrderAmount)) {
        return res.status(400).json({ error: `Minimum order amount for delivery: ${servingRestaurantPricing.minOrderAmount}` });
      }
    }

    const deliveryFee = calculateDeliveryFee({
      deliveryType: normalizedDeliveryType,
      itemsSubtotal,
      restaurantPricing: servingRestaurantPricing
    });
    const trustedTotal = roundCurrency(itemsSubtotal + deliveryFee);

    const servingRestaurant = await prisma.restaurant.findUnique({
      where: { id: servingRestaurantId },
      select: { id: true, sharedMenuSourceRestaurantId: true }
    });

    const effectiveStopRestaurantIds = servingRestaurant?.sharedMenuSourceRestaurantId
      ? [servingRestaurant.sharedMenuSourceRestaurantId, servingRestaurantId]
      : [servingRestaurantId];

    const stoppedDishesRaw = await prisma.dishStop.findMany({
      where: {
        restaurantId: { in: effectiveStopRestaurantIds },
        isStopped: true,
        dishId: { in: dishIds }
      },
      select: {
        dishId: true,
        reason: true,
        restaurantId: true,
        dish: {
          select: { name: true }
        }
      }
    });

    const stoppedDishesMap = new Map();
    stoppedDishesRaw.forEach((stop) => {
      const existing = stoppedDishesMap.get(stop.dishId);
      const isLocalStop = stop.restaurantId === servingRestaurantId;

      if (!existing || isLocalStop) {
        stoppedDishesMap.set(stop.dishId, stop);
      }
    });

    const stoppedDishes = Array.from(stoppedDishesMap.values());

    if (stoppedDishes.length > 0) {
      return res.status(400).json({
        error: 'Some dishes are temporarily unavailable at this restaurant',
        stoppedDishes: stoppedDishes.map((x) => ({
          dishId: x.dishId,
          name: x.dish?.name || null,
          reason: x.reason || null
        }))
      });
    }

    if (Array.isArray(modifierOptionIds) && modifierOptionIds.length > 0) {
      const {
        stopByOption: stoppedModifierOptionsMap
      } = await loadModifierOptionStops({
        restaurantId: servingRestaurantId,
        menuSourceRestaurantId: servingRestaurant?.sharedMenuSourceRestaurantId || servingRestaurantId,
        modifierOptionIds
      });

      const stoppedModifierOptions = modifierOptionIds
        .filter((optionId) => stoppedModifierOptionsMap.has(optionId))
        .map((optionId) => ({
          optionId,
          name: stoppedModifierOptionsMap.get(optionId)?.name || null,
          reason: stoppedModifierOptionsMap.get(optionId)?.reason || null
        }));

      if (stoppedModifierOptions.length > 0) {
        return res.status(400).json({
          error: 'Some modifier options are temporarily unavailable at this restaurant',
          stoppedModifierOptions
        });
      }
    }

    const orderNumber = generateOrderNumber();

    const order = await prisma.order.create({
      data: {
        orderNumber,
        restaurantId,
        assignedRestaurantId,
        totalAmount: trustedTotal,
        customerName: normalizedCustomerName || 'Customer',
        customerPhone: normalizedCustomerPhone || 'Not specified',
        customerEmail: customerEmail || null,
        deliveryAddress: normalizedDeliveryAddress || null,
        deliveryLatitude: normalizedDeliveryLatitude,
        deliveryLongitude: normalizedDeliveryLongitude,
        deliveryType: normalizedDeliveryType,
        tableNumber: restaurantDetails.businessType === 'ONLINE_STORE'
          ? null
          : (normalizedDeliveryType === 'dine_in' ? tableNumber || null : null),
        paymentMethod: paymentMethod || 'cash',
        notes: comment || null,
        items: {
          create: trustedItems
        }
      },
      include: {
        items: {
          include: {
            dish: true
          }
        },
        restaurant: {
          include: {
            socialLinks: true
          }
        },
        customerAddress: true
      }
    });

    let notificationRestaurant = order.restaurant;
    if (order.assignedRestaurantId) {
      const assignedRestaurant = await prisma.restaurant.findUnique({
        where: { id: order.assignedRestaurantId },
        include: { socialLinks: true }
      });
      if (assignedRestaurant) {
        notificationRestaurant = assignedRestaurant;
      }
    }

    if (notificationRestaurant?.telegramGroupId) {
      telegramService.sendNewOrderNotification(order, notificationRestaurant).catch(err => {
        console.error('Failed to send Telegram notification:', err);
      });
    }

    res.status(201).json({
      message: 'Order created successfully',
      order: order,
      orderNumber: order.orderNumber
    });
  } catch (error) {
    console.error('Order creation error:', error);
    res.status(500).json({
      error: 'Failed to create order',
      details: error.message || 'An internal server error occurred.'
    });
  }
};

export const getOrdersByRestaurant = async (req, res, next) => {
  try {
    const { restaurantId } = req.params;

    if (!ensureRestaurantAccess(req, res, restaurantId)) {
      return;
    }

    // Фильтр заказов: показывать заказы, которые назначены этому ресторану
    // или были созданы для этого ресторана (если не переназначены)
    const orders = await prisma.order.findMany({
      where: {
        OR: [
          { assignedRestaurantId: restaurantId },
          {
            assignedRestaurantId: null,
            restaurantId: restaurantId
          }
        ]
      },
      orderBy: { createdAt: 'desc' },
      include: {
        items: {
          include: {
            dish: {
              select: { id: true, name: true, price: true, image: true }
            }
          }
        }
      }
    });

    res.json(orders);
  } catch (error) {
    next(error);
  }
};

export const getOrderById = async (req, res, next) => {
  try {
    const { orderId } = req.params;

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: {
            dish: true // Включаем информацию о блюде для каждого элемента заказа
          }
        },
        restaurant: true,
        customer: true,
        customerAddress: true
      }
    });

    if (!ensureOrderAccess(req, res, order)) {
      return;
    }

    res.json(order);
  } catch (error) {
    next(error);
  }
};

export const updateOrderStatus = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const { status } = req.body;

    if (!status || !ALLOWED_STATUSES.includes(status)) {
      return res.status(400).json({
        error: 'Invalid status',
        allowed: ALLOWED_STATUSES
      });
    }

    const currentOrder = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        restaurantId: true,
        assignedRestaurantId: true
      }
    });

    if (!ensureOrderAccess(req, res, currentOrder)) {
      return;
    }

    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: { status },
      include: {
        items: {
          include: {
            dish: true
          }
        },
        restaurant: true,
        customer: true,
        customerAddress: true
      }
    });

    res.json({
      message: 'Order status updated',
      order: updatedOrder
    });
  } catch (error) {
    console.error('Error updating order status:', error);
    next(error);
  }
};

export const getOrderByNumber = async (req, res, next) => {
  try {
    const { orderNumber } = req.params;
    const fullOrderNumber = orderNumber.startsWith('#') ? orderNumber : `#${orderNumber}`;

    const order = await prisma.order.findUnique({
      where: { orderNumber: fullOrderNumber },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        totalAmount: true,
        deliveryType: true,
        paymentMethod: true,
        tableNumber: true,
        createdAt: true,
        updatedAt: true,
        restaurantId: true,
        assignedRestaurantId: true,
        restaurant: {
          select: {
            id: true,
            name: true,
            subdomain: true,
            phone: true,
            address: true,
            city: true,
            country: true,
            currency: true
          }
        },
        items: {
          select: {
            id: true,
            quantity: true,
            price: true,
            selectedModifiers: true,
            dish: {
              select: {
                id: true,
                name: true,
                image: true
              }
            }
          }
        }
      }
    });

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    res.json(order);
  } catch (error) {
    next(error);
  }
};

export const reassignOrder = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const { assignedRestaurantId } = req.body;

    if (!assignedRestaurantId) {
      return res.status(400).json({ error: 'assignedRestaurantId is required' });
    }

    const sourceOrder = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        restaurantId: true,
        assignedRestaurantId: true,
        restaurant: {
          select: {
            ownerId: true
          }
        }
      }
    });

    if (!ensureOrderAccess(req, res, sourceOrder)) {
      return;
    }

    // Проверяем существование целевого ресторана
    const targetRestaurant = await prisma.restaurant.findUnique({
      where: { id: assignedRestaurantId },
      include: { socialLinks: true }
    });

    if (!targetRestaurant) {
      return res.status(404).json({ error: 'Target restaurant not found' });
    }

    if (!req.user?.isAdmin) {
      const sourceOwnerId = sourceOrder?.restaurant?.ownerId;
      if (sourceOwnerId && targetRestaurant.ownerId !== sourceOwnerId) {
        return res.status(403).json({ error: 'Can only reassign order within the same network owner' });
      }
    }

    // Обновляем заказ
    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: { assignedRestaurantId },
      include: {
        restaurant: true,
        items: {
          include: {
            dish: true
          }
        }
      }
    });

    res.json({
      message: 'Order reassigned successfully',
      order: updatedOrder,
      assignedTo: {
        id: targetRestaurant.id,
        name: targetRestaurant.name,
        phone: targetRestaurant.phone,
        whatsapp: targetRestaurant.socialLinks?.whatsapp
      }
    });
  } catch (error) {
    next(error);
  }
};

// Функция для извлечения координат из Google Maps ссылки
function extractCoordinatesFromUrl(url) {
  if (!url || typeof url !== 'string') {
    return null;
  }

  // Поддерживаем разные форматы Google Maps ссылок:
  // https://maps.google.com/?q=10.767750740051,106.69813537598
  // https://www.google.com/maps?q=10.767750740051,106.69813537598
  // https://maps.app.goo.gl/... (короткие ссылки не поддерживаются)

  const patterns = [
    /[?&]q=(-?\d+\.?\d*),(-?\d+\.?\d*)/i,  // ?q=lat,lng
    /@(-?\d+\.?\d*),(-?\d+\.?\d*)/i,       // @lat,lng
    /ll=(-?\d+\.?\d*),(-?\d+\.?\d*)/i      // ll=lat,lng
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return {
        latitude: parseFloat(match[1]),
        longitude: parseFloat(match[2])
      };
    }
  }

  return null;
}

// Автоматическое переназначение заказа на ближайший ресторан
export const autoReassignOrder = async (req, res, next) => {
  try {
    const { orderId, orderNumber } = req.params;
    let { latitude, longitude, location } = req.body;

    // Если передан номер заказа вместо ID, находим заказ по номеру
    let order;
    if (orderNumber) {
      const fullOrderNumber = orderNumber.startsWith('#') ? orderNumber : `#${orderNumber}`;
      order = await prisma.order.findUnique({
        where: { orderNumber: fullOrderNumber },
        include: { restaurant: true }
      });

      if (!order) {
        return res.status(404).json({
          error: 'Order not found',
          orderNumber: fullOrderNumber
        });
      }
    } else if (orderId) {
      order = await prisma.order.findUnique({
        where: { id: orderId },
        include: { restaurant: true }
      });

      if (!order) {
        return res.status(404).json({
          error: 'Order not found',
          orderId: orderId
        });
      }
    } else {
      return res.status(400).json({ error: 'orderId or orderNumber is required' });
    }

    if (!ensureOrderAccess(req, res, order)) {
      return;
    }

    // Если передана ссылка на Google Maps, извлекаем координаты
    if (location && !latitude && !longitude) {
      const coords = extractCoordinatesFromUrl(location);
      if (coords) {
        latitude = coords.latitude;
        longitude = coords.longitude;
      } else {
        return res.status(400).json({
          error: 'Could not extract coordinates from location URL',
          hint: 'Send either {latitude, longitude} or {location: "https://maps.google.com/?q=lat,lng"}'
        });
      }
    }

    if (!latitude || !longitude) {
      return res.status(400).json({
        error: 'latitude and longitude are required',
        hint: 'Send either {latitude, longitude} or {location: "https://maps.google.com/?q=lat,lng"}'
      });
    }

    const userLat = parseFloat(latitude);
    const userLon = parseFloat(longitude);

    // Получаем все рестораны той же сети (с тем же ownerId)
    const networkRestaurants = await prisma.restaurant.findMany({
      where: {
        ownerId: order.restaurant.ownerId,
        latitude: { not: null },
        longitude: { not: null },
        deliveryEnabled: true
      },
      include: {
        socialLinks: true
      }
    });

    if (networkRestaurants.length === 0) {
      return res.status(400).json({
        error: 'No restaurants with geolocation found in this network'
      });
    }

    // Находим ближайший ресторан с учетом радиуса доставки
    const restaurantsWithDistance = networkRestaurants.map(r => ({
      restaurant: r,
      distance: getDistance(userLat, userLon, r.latitude, r.longitude),
      inDeliveryZone: r.deliveryRadius
        ? getDistance(userLat, userLon, r.latitude, r.longitude) <= r.deliveryRadius
        : true // Если радиус не задан, считаем что доставка доступна везде
    })).sort((a, b) => a.distance - b.distance);

    // Сначала ищем ближайший ресторан В ЗОНЕ доставки
    const nearest = restaurantsWithDistance.find(r => r.inDeliveryZone);

    if (!nearest) {
      return res.status(400).json({
        error: 'No restaurant in delivery zone found for this location',
        code: 'OUT_OF_DELIVERY_ZONE'
      });
    }

    let assignmentStatus = 'in_zone'; // 'in_zone', 'no_radius'

    if (!nearest.restaurant.deliveryRadius) {
      assignmentStatus = 'no_radius';
    }

    const inDeliveryZone = nearest.inDeliveryZone;

    // Обновляем заказ
    const updatedOrder = await prisma.order.update({
      where: { id: order.id },
      data: {
        assignedRestaurantId: nearest.restaurant.id,
        deliveryLatitude: userLat,
        deliveryLongitude: userLon
      },
      include: {
        restaurant: true,
        items: {
          include: {
            dish: true
          }
        }
      }
    });

    // Формируем предупреждение если клиент вне зоны доставки
    let warning = null;
    let statusMessage = 'Заказ назначен на ближайший ресторан в зоне доставки';

    if (assignmentStatus === 'no_radius') {
      statusMessage = 'Заказ назначен на ближайший ресторан (радиус доставки не настроен)';
    }

    res.json({
      message: statusMessage,
      warning,
      order: updatedOrder,
      assignedTo: {
        id: nearest.restaurant.id,
        name: nearest.restaurant.name,
        address: nearest.restaurant.address,
        phone: nearest.restaurant.phone,
        whatsapp: nearest.restaurant.socialLinks?.whatsapp,
        distance: nearest.distance.toFixed(2) + ' км',
        deliveryRadius: nearest.restaurant.deliveryRadius ? `${nearest.restaurant.deliveryRadius} км` : 'Не настроен'
      },
      customerLocation: {
        latitude: userLat,
        longitude: userLon
      },
      inDeliveryZone,
      allNearbyRestaurants: restaurantsWithDistance.slice(0, 3).map(r => ({
        id: r.restaurant.id,
        name: r.restaurant.name,
        distance: r.distance.toFixed(2) + ' км',
        inDeliveryZone: r.inDeliveryZone
      }))
    });
  } catch (error) {
    next(error);
  }
};

// Получить информацию о назначенном ресторане для заказа (GET)
export const getAssignedRestaurant = async (req, res, next) => {
  try {
    const { orderNumber } = req.params;
    const fullOrderNumber = orderNumber.startsWith('#') ? orderNumber : `#${orderNumber}`;

    const order = await prisma.order.findUnique({
      where: { orderNumber: fullOrderNumber },
      include: {
        restaurant: {
          include: {
            socialLinks: true
          }
        },
        items: {
          include: {
            dish: true
          }
        }
      }
    });

    if (!order) {
      return res.status(404).json({
        error: 'Order not found',
        orderNumber: fullOrderNumber
      });
    }

    // Определяем какой ресторан обслуживает заказ
    let assignedRestaurant;

    if (order.assignedRestaurantId) {
      // Если заказ переназначен, получаем назначенный ресторан
      assignedRestaurant = await prisma.restaurant.findUnique({
        where: { id: order.assignedRestaurantId },
        include: {
          socialLinks: true
        }
      });
    } else {
      // Иначе используем оригинальный ресторан
      assignedRestaurant = order.restaurant;
    }

    if (!assignedRestaurant) {
      return res.status(404).json({
        error: 'Assigned restaurant not found'
      });
    }

    // Расчет расстояния если есть координаты
    let distance = null;
    if (order.deliveryLatitude && order.deliveryLongitude &&
      assignedRestaurant.latitude && assignedRestaurant.longitude) {
      distance = getDistance(
        order.deliveryLatitude,
        order.deliveryLongitude,
        assignedRestaurant.latitude,
        assignedRestaurant.longitude
      ).toFixed(2);
    }

    // Формируем список блюд для массива и для текста
    const itemsList = order.items.map(item => {
      const modifiers = parseSelectedModifiers(item.selectedModifiers);
      const modifiersText = modifiers.length > 0
        ? ` (${modifiers.map(m => m.name).join(', ')})`
        : '';

      return {
        dishName: item.dish?.name || 'Удалённое блюдо',
        quantity: item.quantity,
        price: item.price,
        total: (item.price * item.quantity).toFixed(2),
        modifiers: modifiers
      };
    });

    // Формируем текстовое сообщение для клиента
    const itemsText = order.items.map(item => {
      const dishName = item.dish?.name || 'Удалённое блюдо';
      const modifiers = parseSelectedModifiers(item.selectedModifiers);
      const modifiersText = modifiers.length > 0
        ? ` (${modifiers.map(m => m.name).join(', ')})`
        : '';
      const itemTotal = (item.price * item.quantity).toFixed(2);

      return `${item.quantity}x ${dishName}${modifiersText} - ${itemTotal} ${assignedRestaurant.currency || '₽'}`;
    }).join('\n');

    const messageForClient = `📋 Ваш заказ ${order.orderNumber}\n\n` +
      `🏪 Ресторан: ${assignedRestaurant.name}\n` +
      `📍 Адрес: ${assignedRestaurant.address}\n` +
      (distance ? `🚗 Расстояние: ${distance} км\n` : '') +
      `\n📦 Состав заказа:\n${itemsText}\n\n` +
      `💰 Итого: ${order.totalAmount} ${assignedRestaurant.currency || '₽'}\n\n` +
      `📞 Телефон ресторана: ${assignedRestaurant.phone}`;

    res.json({
      orderNumber: order.orderNumber,
      restaurant: {
        id: assignedRestaurant.id,
        name: assignedRestaurant.name,
        address: assignedRestaurant.address,
        phone: assignedRestaurant.phone,
        whatsapp: assignedRestaurant.socialLinks?.whatsapp,
        subdomain: assignedRestaurant.subdomain
      },
      items: itemsList,
      itemsText: itemsText, // Текст списка блюд для вставки в сообщение
      message: messageForClient, // Готовое сообщение для клиента
      distance: distance ? `${distance} км` : null,
      deliveryLocation: order.deliveryLatitude && order.deliveryLongitude ? {
        latitude: order.deliveryLatitude,
        longitude: order.deliveryLongitude
      } : null,
      wasReassigned: !!order.assignedRestaurantId,
      totalAmount: order.totalAmount,
      currency: assignedRestaurant.currency || '₽'
    });
  } catch (error) {
    next(error);
  }
};
