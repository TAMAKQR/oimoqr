import { Router } from 'express';
import { getNearbyRestaurants, checkDelivery } from '../controllers/geolocation.controller.js';

const router = Router();

router.get('/geolocation/nearby-restaurants', getNearbyRestaurants);

export default router;