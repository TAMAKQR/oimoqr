import express from 'express';
import {
  getRestaurantStaff,
  addStaff,
  updateStaff,
  removeStaff,
  getStaffPermissions,
  updateStaffPermissions
} from '../controllers/staff.controller.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

router.get('/:restaurantId/staff', authenticate, getRestaurantStaff);
router.post('/:restaurantId/staff', authenticate, addStaff);
router.put('/:restaurantId/staff/:staffId', authenticate, updateStaff);
router.delete('/:restaurantId/staff/:staffId', authenticate, removeStaff);
router.get('/:restaurantId/staff/:staffId/permissions', authenticate, getStaffPermissions);
router.put('/:restaurantId/staff/:staffId/permissions', authenticate, updateStaffPermissions);

export default router;
