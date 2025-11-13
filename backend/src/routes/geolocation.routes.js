import { Router } from 'express';
import { getNearbyRestaurants, checkDelivery } from '../controllers/geolocation.controller.js';

const router = Router();

router.get('/nearby-restaurants', getNearbyRestaurants);
router.get('/check-delivery', checkDelivery);

export default router;