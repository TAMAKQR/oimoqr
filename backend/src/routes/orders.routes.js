import express from 'express';
import { createOrder, getOrdersByRestaurant, getOrderById, getOrderByNumber } from '../controllers/orders.controller.js';

const router = express.Router();

router.post('/', createOrder);
router.get('/restaurant/:restaurantId', getOrdersByRestaurant);
router.get('/number/:orderNumber', getOrderByNumber);
router.get('/:orderId', getOrderById);

export default router;
