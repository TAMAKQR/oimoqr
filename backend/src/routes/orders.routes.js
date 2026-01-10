import express from 'express';
import { createOrder, getOrdersByRestaurant, getOrderById, getOrderByNumber, reassignOrder, autoReassignOrder, getAssignedRestaurant, updateOrderStatus } from '../controllers/orders.controller.js';

const router = express.Router();

router.post('/', createOrder);
router.get('/restaurant/:restaurantId', getOrdersByRestaurant);
router.get('/number/:orderNumber', getOrderByNumber);
router.get('/number/:orderNumber/assigned-restaurant', getAssignedRestaurant); // GET информация о назначенном ресторане
router.get('/:orderId', getOrderById);
router.patch('/:orderId/status', updateOrderStatus);
router.put('/:orderId/reassign', reassignOrder);
router.post('/:orderId/auto-reassign', autoReassignOrder); // По ID заказа
router.post('/number/:orderNumber/auto-reassign', autoReassignOrder); // По номеру заказа (ДЛЯ SENDPULSE)

export default router;
