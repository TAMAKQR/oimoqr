import { prisma } from '../config/prisma.js';

const generateOrderNumber = () => {
  const timestamp = Date.now().toString().slice(-6);
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `#${timestamp}${random}`;
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
      deliveryLongitude
    } = req.body;

    if (!restaurantId || !items || total === undefined) {
      return res.status(400).json({
        error: 'restaurantId, items, and total are required'
      });
    }

    // Фильтруем товары без ID, чтобы избежать ошибок
    const validItems = items.filter(item => item && item.id);

    // Проверка существования всех блюд перед созданием заказа
    const dishIds = validItems.map(item => item.id);
    const existingDishes = await prisma.dish.findMany({
      where: {
        id: { in: dishIds },
        restaurantId: restaurantId // Убедимся, что блюда принадлежат этому ресторану
      },
      select: { id: true }
    });

    if (existingDishes.length !== dishIds.length) {
      const notFoundIds = dishIds.filter(id => !existingDishes.some(d => d.id === id));
      return res.status(400).json({ error: `One or more dishes not found: ${notFoundIds.join(', ')}` });
    }

    const orderNumber = generateOrderNumber();

    const order = await prisma.order.create({
      data: {
        orderNumber,
        restaurantId,
        totalAmount: parseFloat(total),
        customerName: customerName || 'Клиент',
        customerPhone: customerPhone || 'Не указан',
        customerEmail: customerEmail || null,
        deliveryAddress: deliveryAddress || null,
        deliveryLatitude: deliveryLatitude ? parseFloat(deliveryLatitude) : null,
        deliveryLongitude: deliveryLongitude ? parseFloat(deliveryLongitude) : null,
        items: {
          create: validItems.map(item => ({
            dishId: item.id,
            quantity: parseInt(item.quantity, 10),
            price: item.price ?? 0, // Цена за единицу на момент заказа, с fallback на 0
            selectedModifiers: item.selectedModifiers ? JSON.stringify(item.selectedModifiers) : undefined
          }))
        }
      },
      include: {
        items: true, // Включаем созданные товары в ответ
        restaurant: {
          include: {
            socialLinks: true // Явно включаем социальные сети ресторана
          }
        }
      }
    });

    res.status(201).json({
      message: 'Order created successfully',
      order: order,
      orderNumber: order.orderNumber // Добавляем номер заказа на верхний уровень ответа
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
          select: {
            id: true // Просто чтобы можно было посчитать количество
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
        restaurant: true
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

export const getOrderByNumber = async (req, res, next) => {
  try {
    const { orderNumber } = req.params;
    const fullOrderNumber = `#${orderNumber}`;

    const order = await prisma.order.findUnique({
      where: { orderNumber: fullOrderNumber },
      include: {
        restaurant: true,
        items: {
          include: {
            dish: true
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

    // Проверяем существование целевого ресторана
    const targetRestaurant = await prisma.restaurant.findUnique({
      where: { id: assignedRestaurantId },
      include: { socialLinks: true }
    });

    if (!targetRestaurant) {
      return res.status(404).json({ error: 'Target restaurant not found' });
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
    const { orderId } = req.params;
    let { latitude, longitude, location } = req.body;

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

    // Получаем заказ
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        restaurant: true
      }
    });

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

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

    // Находим ближайший ресторан
    const restaurantsWithDistance = networkRestaurants.map(r => ({
      restaurant: r,
      distance: getDistance(userLat, userLon, r.latitude, r.longitude)
    })).sort((a, b) => a.distance - b.distance);

    const nearest = restaurantsWithDistance[0];

    // Проверяем, находится ли клиент в зоне доставки
    const inDeliveryZone = nearest.restaurant.deliveryRadius 
      ? nearest.distance <= nearest.restaurant.deliveryRadius
      : true;

    // Обновляем заказ
    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
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

    res.json({
      message: 'Order auto-assigned to nearest restaurant',
      order: updatedOrder,
      assignedTo: {
        id: nearest.restaurant.id,
        name: nearest.restaurant.name,
        address: nearest.restaurant.address,
        phone: nearest.restaurant.phone,
        whatsapp: nearest.restaurant.socialLinks?.whatsapp,
        distance: nearest.distance.toFixed(2) + ' км'
      },
      customerLocation: {
        latitude: userLat,
        longitude: userLon
      },
      inDeliveryZone,
      allNearbyRestaurants: restaurantsWithDistance.slice(0, 3).map(r => ({
        id: r.restaurant.id,
        name: r.restaurant.name,
        distance: r.distance.toFixed(2) + ' км'
      }))
    });
  } catch (error) {
    next(error);
  }
};
