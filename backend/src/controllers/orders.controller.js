import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const generateOrderNumber = () => {
  const timestamp = Date.now().toString().slice(-6);
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `#${timestamp}${random}`;
};

export const createOrder = async (req, res, next) => {
  try {
    const { restaurantId, items, total, customerPhone } = req.body;

    if (!restaurantId || !items || total === undefined) {
      return res.status(400).json({
        error: 'restaurantId, items, and total are required'
      });
    }

    const orderNumber = generateOrderNumber();

    const order = await prisma.order.create({
      data: {
        orderNumber,
        restaurantId,
        items: JSON.stringify(items),
        total: parseFloat(total),
        customerPhone
      }
    });

    res.status(201).json({
      id: order.id,
      orderNumber: order.orderNumber,
      createdAt: order.createdAt
    });
  } catch (error) {
    console.error('Order creation error:', error.message);
    res.status(500).json({
      error: 'Failed to create order',
      details: error.message
    });
  }
};

export const getOrdersByRestaurant = async (req, res, next) => {
  try {
    const { restaurantId } = req.params;

    const orders = await prisma.order.findMany({
      where: { restaurantId },
      orderBy: { createdAt: 'desc' }
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
      where: { id: orderId }
    });

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    res.json({
      ...order,
      items: JSON.parse(order.items)
    });
  } catch (error) {
    next(error);
  }
};

export const getOrderByNumber = async (req, res, next) => {
  try {
    const { orderNumber } = req.params;

    const order = await prisma.order.findUnique({
      where: { orderNumber },
      include: { restaurant: true }
    });

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    res.json({
      ...order,
      items: JSON.parse(order.items)
    });
  } catch (error) {
    next(error);
  }
};
