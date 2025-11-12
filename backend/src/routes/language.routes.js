import express from 'express';
import { 
  getAvailableLanguages,
  getRestaurantLanguages,
  updateRestaurantLanguages,
  getDishTranslations,
  getAllDishTranslations,
  createDishTranslation,
  updateDishTranslation,
  deleteDishTranslation,
  getCategoryTranslations,
  createCategoryTranslation,
  updateCategoryTranslation,
  deleteCategoryTranslation
} from '../controllers/language.controller.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

router.get('/available', getAvailableLanguages);

router.get('/restaurants/:restaurantId', authenticate, getRestaurantLanguages);
router.put('/restaurants/:restaurantId', authenticate, updateRestaurantLanguages);

router.get('/restaurants/:restaurantId/translations', authenticate, getAllDishTranslations);

// Dish translations
router.get('/restaurants/:restaurantId/dishes/:dishId/translations', authenticate, getDishTranslations);
router.post('/restaurants/:restaurantId/dishes/:dishId/translations', authenticate, createDishTranslation);

// Category translations
router.get('/restaurants/:restaurantId/categories/:categoryId/translations', authenticate, getCategoryTranslations);
router.post('/restaurants/:restaurantId/categories/:categoryId/translations', authenticate, createCategoryTranslation);

router.put('/translations/:translationId', authenticate, updateDishTranslation);
router.delete('/translations/:translationId', authenticate, deleteDishTranslation);

router.put('/category-translations/:translationId', authenticate, updateCategoryTranslation);
router.delete('/category-translations/:translationId', authenticate, deleteCategoryTranslation);

export default router;
