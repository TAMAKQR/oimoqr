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
  deleteModifierOptionImage
} from '../controllers/dish.controller.js';
import { authenticate, requireRestaurant } from '../middleware/auth.js';
import { upload } from '../middleware/upload.js';

const router = express.Router();

// Public route
router.get('/category/:categoryId', getDishes);

// Protected routes - Dishes
router.post('/', authenticate, requireRestaurant, createDish);
router.post('/category/:categoryId/reorder', authenticate, requireRestaurant, reorderDishes);
router.put('/:id', authenticate, requireRestaurant, updateDish);
router.post('/:id/upload-image', authenticate, requireRestaurant, upload.single('image'), uploadDishImage);
router.delete('/:id/image', authenticate, requireRestaurant, deleteDishImage);
router.patch('/:id/toggle-availability', authenticate, requireRestaurant, toggleDishAvailability);
router.delete('/:id', authenticate, requireRestaurant, deleteDish);

// Protected routes - Modifiers
router.post('/:dishId/modifiers', authenticate, requireRestaurant, createModifier);
router.put('/modifiers/:id', authenticate, requireRestaurant, updateModifier);
router.delete('/modifiers/:id', authenticate, requireRestaurant, deleteModifier);

// Protected routes - Modifier Options
router.post('/modifiers/:modifierId/options', authenticate, requireRestaurant, createModifierOption);
router.put('/modifiers/options/:optionId', authenticate, requireRestaurant, updateModifierOption);
router.delete('/modifiers/options/:optionId', authenticate, requireRestaurant, deleteModifierOption);
// ✅ Upload/delete images for modifier options
router.post('/modifiers/options/:optionId/upload-image', authenticate, requireRestaurant, upload.single('image'), uploadModifierOptionImage);
router.delete('/modifiers/options/:optionId/image', authenticate, requireRestaurant, deleteModifierOptionImage);

export default router;