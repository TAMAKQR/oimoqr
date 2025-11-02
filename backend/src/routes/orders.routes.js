import express from 'express';
import { createOrder, getOrdersByRestaurant, getOrderById } from '../controllers/orders.controller.js';

const router = express.Router();

router.post('/', createOrder);
router.get('/restaurant/:restaurantId', getOrdersByRestaurant);
router.get('/:orderId', getOrderById);

export default router;
