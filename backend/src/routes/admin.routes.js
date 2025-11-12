import express from 'express';
import {
  updateSubscription,
  updateUserSubscription,
  extendSubscription,
  getSubscriptionStats,
  updateUserCredentials,
  getAllUsers,
  deactivateUser,
  deleteUser,
  getPricingTiers,
  createPricingTier,
  updatePricingTier,
  deletePricingTier,
  getTrialConfig,
  updateTrialConfig
} from '../controllers/admin.controller.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

// All admin routes require authentication and admin role
router.use(authenticate, requireAdmin);

router.put('/subscriptions/:id', updateSubscription);
router.post('/subscriptions/:id/extend', extendSubscription);
router.put('/users/:userId/subscriptions', updateUserSubscription);
router.get('/stats/subscriptions', getSubscriptionStats);
router.get('/users', getAllUsers);
router.put('/users/:userId/credentials', updateUserCredentials);
router.post('/users/:userId/deactivate', deactivateUser);
router.delete('/users/:userId', deleteUser);

router.get('/pricing-tiers', getPricingTiers);
router.post('/pricing-tiers', createPricingTier);
router.put('/pricing-tiers/:id', updatePricingTier);
router.delete('/pricing-tiers/:id', deletePricingTier);

router.get('/trial-config', getTrialConfig);
router.put('/trial-config', updateTrialConfig);

export default router;