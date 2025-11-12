import express from 'express';
import { 
  findNearbyRestaurants, 
  findNearestRestaurant, 
  checkDeliveryAvailability 
} from '../controllers/geolocation.controller.js';

const router = express.Router();

// GET /api/geolocation/nearby?latitude=55.7558&longitude=37.6173&maxDistance=10
router.get('/nearby', findNearbyRestaurants);

// GET /api/geolocation/nearest?latitude=55.7558&longitude=37.6173
router.get('/nearest', findNearestRestaurant);

// GET /api/geolocation/check-delivery?restaurantId=xxx&latitude=55.7558&longitude=37.6173
router.get('/check-delivery', checkDeliveryAvailability);

export default router;