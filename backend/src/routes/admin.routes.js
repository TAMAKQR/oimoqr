import express from 'express';
import {
  getAllRestaurants,
  getRestaurantById,
  updateSubscription,
  extendSubscription,
  getSubscriptionStats,
  updateUserCredentials
} from '../controllers/admin.controller.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

// All admin routes require authentication and admin role
router.use(authenticate, requireAdmin);

router.get('/restaurants', getAllRestaurants);
router.get('/restaurants/:id', getRestaurantById);
router.put('/subscriptions/:id', updateSubscription);
router.post('/subscriptions/:id/extend', extendSubscription);
router.get('/stats/subscriptions', getSubscriptionStats);
router.put('/users/:userId/credentials', updateUserCredentials);

export default router;