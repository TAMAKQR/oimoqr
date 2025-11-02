import express from 'express';
import { 
  getDeliveryLocations, 
  createDeliveryLocation, 
  updateDeliveryLocation, 
  deleteDeliveryLocation 
} from '../controllers/delivery-locations.controller.js';

const router = express.Router({ mergeParams: true });

router.get('/restaurants/:restaurantId/delivery-locations', getDeliveryLocations);
router.post('/restaurants/:restaurantId/delivery-locations', createDeliveryLocation);
router.put('/restaurants/:restaurantId/delivery-locations/:locationId', updateDeliveryLocation);
router.delete('/restaurants/:restaurantId/delivery-locations/:locationId', deleteDeliveryLocation);

export default router;
