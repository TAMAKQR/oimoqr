import { Router } from 'express';
import { getActivePricingTiers } from '../controllers/pricing.controller.js';

const router = Router();

router.get('/pricing-tiers', getActivePricingTiers);

export default router;