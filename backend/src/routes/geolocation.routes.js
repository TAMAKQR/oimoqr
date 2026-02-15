import { Router } from 'express';
import { getNearbyRestaurants, checkDelivery, geocodeAddress } from '../controllers/geolocation.controller.js';

const router = Router();

router.get('/nearby-restaurants', getNearbyRestaurants);
router.get('/check-delivery', checkDelivery);
router.get('/geocode', geocodeAddress);

export default router;