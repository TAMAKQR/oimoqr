import { prisma } from '../config/prisma.js';

/**
 * Получить все группы категорий ресторана
 */
export const getCategoryGroups = async (req, res, next) => {
    try {
        const { restaurantId } = req.params;

        const groups = await prisma.categoryGroup.findMany({
            where: { restaurantId },
            include: {
                categories: {
                    orderBy: { order: 'asc' }
                }
            },
            orderBy: { order: 'asc' }
        });

        res.json(groups);
    } catch (error) {
        next(error);
    }
};

/**
 * Создать группу категорий
 */
export const createCategoryGroup = async (req, res, next) => {
    try {
        const { restaurantId } = req.params;
        const { name, description, image, order } = req.body;

        const group = await prisma.categoryGroup.create({
            data: {
                name,
                description,
                image,
                order: order || 0,
                restaurantId
            }
        });

        res.status(201).json(group);
    } catch (error) {
        next(error);
    }
};

/**
 * Обновить группу категорий
 */
export const updateCategoryGroup = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { name, description, image, order } = req.body;

        const group = await prisma.categoryGroup.update({
            where: { id },
            data: {
                ...(name && { name }),
                ...(description !== undefined && { description }),
                ...(image !== undefined && { image }),
                ...(order !== undefined && { order })
            }
        });

        res.json(group);
    } catch (error) {
        next(error);
    }
};

/**
 * Удалить группу категорий
 */
export const deleteCategoryGroup = async (req, res, next) => {
    try {
        const { id } = req.params;

        await prisma.categoryGroup.delete({
            where: { id }
        });

        res.json({ message: 'Category group deleted successfully' });
    } catch (error) {
        next(error);
    }
};

/**
 * Загрузить изображение для группы категорий
 */
export const uploadGroupImage = async (req, res, next) => {
    try {
        const { id } = req.params;

        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        console.log('📸 Uploading group image:', {
            filename: req.file.filename,
            path: req.file.path,
            destination: req.file.destination
        });

        // Check if group exists
        const group = await prisma.categoryGroup.findUnique({
            where: { id }
        });

        if (!group) {
            return res.status(404).json({ error: 'Category group not found' });
        }

        // Get image URL (Cloudinary returns full URL, local storage returns filename)
        const imageUrl = req.file.path && req.file.path.startsWith('http')
            ? req.file.path
            : `/uploads/${req.file.filename}`;

        console.log('📸 Group image URL:', imageUrl);

        // Update group with image URL
        const updatedGroup = await prisma.categoryGroup.update({
            where: { id },
            data: { image: imageUrl }
        });

        res.json({
            message: 'Image uploaded successfully',
            imageUrl,
            group: updatedGroup
        });
    } catch (error) {
        next(error);
    }
};
