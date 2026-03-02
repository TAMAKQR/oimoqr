import express from 'express';
import { createOrder, getOrdersByRestaurant, getOrderById, getOrderByNumber, reassignOrder, autoReassignOrder, getAssignedRestaurant, updateOrderStatus } from '../controllers/orders.controller.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

const requireOrderAutomationAccess = (req, res, next) => {
    const secret = process.env.ORDER_AUTOREASSIGN_TOKEN;
    const tokenFromHeader = req.headers['x-order-reassign-token'] || req.headers['x-webhook-token'];

    if (secret && tokenFromHeader && tokenFromHeader === secret) {
        req.isOrderAutomationAuthorized = true;
        return next();
    }

    return authenticate(req, res, next);
};

router.post('/', createOrder);
router.get('/restaurant/:restaurantId', authenticate, getOrdersByRestaurant);
router.get('/number/:orderNumber', getOrderByNumber);
router.get('/number/:orderNumber/assigned-restaurant', getAssignedRestaurant); // GET информация о назначенном ресторане
router.get('/:orderId', authenticate, getOrderById);
router.patch('/:orderId/status', authenticate, updateOrderStatus);
router.put('/:orderId/reassign', authenticate, reassignOrder);
router.post('/:orderId/auto-reassign', requireOrderAutomationAccess, autoReassignOrder); // По ID заказа
router.post('/number/:orderNumber/auto-reassign', requireOrderAutomationAccess, autoReassignOrder); // По номеру заказа (ДЛЯ SENDPULSE)

export default router;
