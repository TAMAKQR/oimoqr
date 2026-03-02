import express from 'express';
import { createOrder, getOrdersByRestaurant, getOrderById, getOrderByNumber, reassignOrder, autoReassignOrder, getAssignedRestaurant, updateOrderStatus } from '../controllers/orders.controller.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

router.post('/', createOrder);
router.get('/restaurant/:restaurantId', authenticate, getOrdersByRestaurant);
router.get('/number/:orderNumber', getOrderByNumber);
router.get('/number/:orderNumber/assigned-restaurant', getAssignedRestaurant); // GET информация о назначенном ресторане
router.get('/:orderId', authenticate, getOrderById);
router.patch('/:orderId/status', authenticate, updateOrderStatus);
router.put('/:orderId/reassign', authenticate, reassignOrder);
router.post('/:orderId/auto-reassign', authenticate, autoReassignOrder); // По ID заказа
router.post('/number/:orderNumber/auto-reassign', authenticate, autoReassignOrder); // По номеру заказа

export default router;
