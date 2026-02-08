import express from 'express';
import {
  getDishes,
  createDish,
  updateDish,
  uploadDishImage,
  deleteDishImage,
  deleteDish,
  toggleDishAvailability,
  createModifier,
  updateModifier,
  deleteModifier,
  reorderDishes,
  createModifierOption,
  updateModifierOption,
  deleteModifierOption,
  uploadModifierOptionImage,
  deleteModifierOptionImage,
  getDishRecommendations
} from '../controllers/dish.controller.js';
import { authenticate, requireRestaurant } from '../middleware/auth.js';
import { upload } from '../middleware/upload.js';

const router = express.Router();

// Public routes - FIRST to avoid conflicts
router.get('/category/:categoryId', getDishes);
router.get('/:dishId/recommendations', getDishRecommendations);

// Protected routes - Specific paths FIRST (category, modifiers)
router.post('/', authenticate, requireRestaurant, createDish);
router.post('/category/:categoryId/reorder', authenticate, requireRestaurant, reorderDishes);

// Modifier routes with 'modifiers' keyword
router.put('/modifiers/:id', authenticate, requireRestaurant, updateModifier);
router.delete('/modifiers/:id', authenticate, requireRestaurant, deleteModifier);

// Modifier Options with 'modifiers/options' keyword
router.post('/modifiers/:modifierId/options', authenticate, requireRestaurant, createModifierOption);
router.put('/modifiers/options/:optionId', authenticate, requireRestaurant, updateModifierOption);
router.delete('/modifiers/options/:optionId', authenticate, requireRestaurant, deleteModifierOption);
router.post('/modifiers/options/:optionId/upload-image', authenticate, requireRestaurant, upload.single('image'), uploadModifierOptionImage);
router.delete('/modifiers/options/:optionId/image', authenticate, requireRestaurant, deleteModifierOptionImage);

// Dynamic dish routes - AFTER specific routes to avoid conflicts
router.post('/:dishId/modifiers', authenticate, requireRestaurant, createModifier);
router.put('/:id', authenticate, requireRestaurant, updateDish);
router.post('/:id/upload-image', authenticate, requireRestaurant, upload.single('image'), uploadDishImage);
router.delete('/:id/image', authenticate, requireRestaurant, deleteDishImage);
router.patch('/:id/toggle-availability', authenticate, requireRestaurant, toggleDishAvailability);
router.delete('/:id', authenticate, requireRestaurant, deleteDish);

export default router;