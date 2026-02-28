/**
 * Brand Routes - маршруты для управления брендами/сетями ресторанов
 */

import express from 'express';
import {
    getBrands,
    getBrandById,
    createBrand,
    updateBrand,
    deleteBrand,
    addRestaurantToBrand,
    removeRestaurantFromBrand
} from '../controllers/brand.controller.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// Все маршруты требуют аутентификации
router.use(authenticate);

/**
 * GET /api/brands
 * Получить все бренды текущего пользователя
 */
router.get('/', getBrands);

/**
 * GET /api/brands/:id
 * Получить конкретный бренд
 */
router.get('/:id', getBrandById);

/**
 * POST /api/brands
 * Создать новый бренд
 * Body: { name, description?, logo? }
 */
router.post('/', createBrand);

/**
 * PUT /api/brands/:id
 * Обновить бренд
 * Body: { name?, description?, logo? }
 */
router.put('/:id', updateBrand);

/**
 * DELETE /api/brands/:id
 * Удалить бренд
 */
router.delete('/:id', deleteBrand);

/**
 * PUT /api/brands/:brandId/restaurants/:restaurantId
 * Добавить ресторан в бренд
 */
router.put('/:brandId/restaurants/:restaurantId', addRestaurantToBrand);

/**
 * DELETE /api/brands/:brandId/restaurants/:restaurantId
 * Убрать ресторан из бренда
 */
router.delete('/:brandId/restaurants/:restaurantId', removeRestaurantFromBrand);

export default router;
