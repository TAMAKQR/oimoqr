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

    const orders = await prisma.order.findMany({
      where: { restaurantId },
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
