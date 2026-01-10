import express from 'express';
import {
    getCategoryGroups,
    createCategoryGroup,
    updateCategoryGroup,
    deleteCategoryGroup,
    uploadGroupImage
} from '../controllers/categoryGroup.controller.js';
import { upload } from '../middleware/upload.js';

const router = express.Router();

// Получить все группы категорий ресторана
router.get('/:restaurantId/groups', getCategoryGroups);

// Создать группу категорий
router.post('/:restaurantId/groups', createCategoryGroup);

// Обновить группу категорий
router.put('/groups/:id', updateCategoryGroup);

// Загрузить изображение для группы категорий
router.post('/groups/:id/image', upload.single('image'), uploadGroupImage);

// Удалить группу категорий
router.delete('/groups/:id', deleteCategoryGroup);

export default router;
