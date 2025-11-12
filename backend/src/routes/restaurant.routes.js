import express from 'express';
import {
  getRestaurantBySubdomain,
  updateRestaurant,
  uploadBanner,
  deleteBanner,
  uploadLogo,
  deleteLogo,
  updateMenuCardStyle,
  createRestaurant,
  deleteRestaurant,
  copyMenu,
  getRestaurantCategories
} from '../controllers/restaurant.controller.js';
import { getCategories } from '../controllers/category.controller.js';
import { getRestaurantDishes } from '../controllers/dish.controller.js';
import { authenticate } from '../middleware/auth.js';
import { upload } from '../middleware/upload.js';

const router = express.Router();

// Create new restaurant (authenticated)
router.post('/', authenticate, createRestaurant);

// Get categories list only (for translations) - MUST be before /:subdomain
router.get('/:restaurantId/categories-list', authenticate, getRestaurantCategories);

// Get categories for a restaurant (protected) - MUST be before /:subdomain
router.get('/:restaurantId/categories', authenticate, getCategories);

// Get dishes for a restaurant (protected) - MUST be before /:subdomain
router.get('/:restaurantId/dishes', authenticate, getRestaurantDishes);

// Protected routes
router.put('/:id', authenticate, updateRestaurant);
router.put('/:id/menu-style', authenticate, updateMenuCardStyle);
router.post('/:id/copy-menu', authenticate, copyMenu);
router.post('/:id/upload-banner', authenticate, upload.single('banner'), uploadBanner);
router.delete('/:id/delete-banner', authenticate, deleteBanner);
router.post('/:id/upload-logo', authenticate, upload.single('logo'), uploadLogo);
router.delete('/:id/delete-logo', authenticate, deleteLogo);
router.delete('/:id', authenticate, deleteRestaurant);

// Public route - get restaurant by subdomain - MUST be last
router.get('/:subdomain', getRestaurantBySubdomain);

export default router;