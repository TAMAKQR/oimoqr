import express from 'express';
import {
    getCategoryGroups,
    createCategoryGroup,
    updateCategoryGroup,
    deleteCategoryGroup,
    uploadGroupImage
} from '../controllers/categoryGroup.controller.js';
import { authenticate } from '../middleware/auth.js';
import { upload } from '../middleware/upload.js';

const router = express.Router();

// Получить все группы категорий ресторана
router.get('/:restaurantId/groups', authenticate, getCategoryGroups);

// Создать группу категорий
router.post('/:restaurantId/groups', authenticate, createCategoryGroup);

// Обновить группу категорий
router.put('/groups/:id', authenticate, updateCategoryGroup);

// Загрузить изображение для группы категорий
router.post('/groups/:id/image', authenticate, upload.single('image'), uploadGroupImage);

// Удалить группу категорий
router.delete('/groups/:id', authenticate, deleteCategoryGroup);

export default router;
