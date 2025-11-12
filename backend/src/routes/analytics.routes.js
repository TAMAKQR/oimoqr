import express from 'express';
import {
  getRestaurantStats,
  getRestaurantViews
} from '../controllers/analytics.controller.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// Получить статистику ресторана
router.get('/restaurant/:restaurantId', authenticate, getRestaurantStats);

// Получить просмотры ресторана
router.get('/restaurant/:restaurantId/views', authenticate, getRestaurantViews);

export default router;