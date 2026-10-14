import { Router } from 'express';
import {
  getPayment,
  getSubscription,
  startPayment,
} from '../controllers/billing.controller.js';
import { authenticate } from '../middleware/auth.js';
import { requireBillingOwner } from '../middleware/billingOwner.js';

const router = Router();

router.use(authenticate, requireBillingOwner);

router.get('/subscription', getSubscription);
router.post('/payments', startPayment);
router.get('/payments/:paymentId', getPayment);

export default router;
