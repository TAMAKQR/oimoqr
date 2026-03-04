import express from 'express';
import {
  getDeliveryLocations,
  createDeliveryLocation,
  updateDeliveryLocation,
  deleteDeliveryLocation
} from '../controllers/delivery-locations.controller.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router({ mergeParams: true });

router.get('/restaurants/:restaurantId/delivery-locations', authenticate, getDeliveryLocations);
router.post('/restaurants/:restaurantId/delivery-locations', authenticate, createDeliveryLocation);
router.put('/restaurants/:restaurantId/delivery-locations/:locationId', authenticate, updateDeliveryLocation);
router.delete('/restaurants/:restaurantId/delivery-locations/:locationId', authenticate, deleteDeliveryLocation);

export default router;
