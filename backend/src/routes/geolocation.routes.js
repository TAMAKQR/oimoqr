import { Router } from 'express';
import { getNearbyRestaurants, getNearestRestaurantBySubdomain, checkDelivery, geocodeAddress, suggestAddress } from '../controllers/geolocation.controller.js';

const router = Router();

router.get('/nearby-restaurants', getNearbyRestaurants);
router.get('/nearest-by-subdomain', getNearestRestaurantBySubdomain);
router.get('/check-delivery', checkDelivery);
router.get('/geocode', geocodeAddress);
router.get('/suggest', suggestAddress);

export default router;
