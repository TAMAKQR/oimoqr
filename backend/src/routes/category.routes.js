import express from 'express';
import {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  reorderCategories
} from '../controllers/category.controller.js';
import { getDishes } from '../controllers/dish.controller.js';
import { authenticate, requireRestaurant } from '../middleware/auth.js';

const router = express.Router();

// Public route
router.get('/restaurant/:restaurantId', getCategories);

// Get dishes for a category
router.get('/:categoryId/dishes', authenticate, getDishes);

// Protected routes
router.post('/', authenticate, requireRestaurant, createCategory);
router.post('/:restaurantId/reorder', authenticate, requireRestaurant, reorderCategories);
router.put('/:id', authenticate, requireRestaurant, updateCategory);
router.delete('/:id', authenticate, requireRestaurant, deleteCategory);

export default router;