/**
 * Brand Controller - управление брендами/сетями ресторанов
 * 
 * Один бренд объединяет несколько ресторанов под одной подпиской.
 * Это упрощает управление сетями: один биллинг, общие лимиты SMS/клиентов.
 */

import { prisma } from '../config/prisma.js';

/**
 * GET /api/brands
 * Получить все бренды текущего пользователя
 */
export const getBrands = async (req, res) => {
    try {
        const userId = req.user.id;

        const brands = await prisma.restaurantBrand.findMany({
            where: { ownerId: userId },
            include: {
                restaurants: {
                    select: {
                        id: true,
                        name: true,
                        subdomain: true,
                        logo: true,
                        city: true
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        res.json(brands);
    } catch (error) {
        console.error('Error fetching brands:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

/**
 * GET /api/brands/:id
 * Получить конкретный бренд со всей информацией
 */
export const getBrandById = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        const brand = await prisma.restaurantBrand.findFirst({
            where: {
                id,
                ownerId: userId // Проверяем что бренд принадлежит пользователю
            },
            include: {
                restaurants: {
                    include: {
                        _count: {
                            select: {
                                orders: true,
                                registeredCustomers: true,
                                dishes: true
                            }
                        }
                    }
                },
                owner: {
                    select: {
                        id: true,
                        name: true,
                        email: true
                    }
                }
            }
        });

        if (!brand) {
            return res.status(404).json({ error: 'Brand not found' });
        }

        res.json(brand);
    } catch (error) {
        console.error('Error fetching brand:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

/**
 * POST /api/brands
 * Создать новый бренд
 */
export const createBrand = async (req, res) => {
    try {
        const userId = req.user.id;
        const { name, description, logo } = req.body;

        if (!name) {
            return res.status(400).json({ error: 'Brand name is required' });
        }

        const brand = await prisma.restaurantBrand.create({
            data: {
                name,
                description,
                logo,
                ownerId: userId
            },
            include: {
                restaurants: true
            }
        });

        res.status(201).json(brand);
    } catch (error) {
        console.error('Error creating brand:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

/**
 * PUT /api/brands/:id
 * Обновить информацию о бренде
 */
export const updateBrand = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        const { name, description, logo } = req.body;

        // Проверяем что бренд принадлежит пользователю
        const existingBrand = await prisma.restaurantBrand.findFirst({
            where: { id, ownerId: userId }
        });

        if (!existingBrand) {
            return res.status(404).json({ error: 'Brand not found' });
        }

        const brand = await prisma.restaurantBrand.update({
            where: { id },
            data: {
                ...(name && { name }),
                ...(description !== undefined && { description }),
                ...(logo !== undefined && { logo })
            },
            include: {
                restaurants: true
            }
        });

        res.json(brand);
    } catch (error) {
        console.error('Error updating brand:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

/**
 * DELETE /api/brands/:id
 * Удалить бренд (рестораны остаются, но отвязываются от бренда)
 */
export const deleteBrand = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        // Проверяем что бренд принадлежит пользователю
        const brand = await prisma.restaurantBrand.findFirst({
            where: { id, ownerId: userId },
            include: { restaurants: true }
        });

        if (!brand) {
            return res.status(404).json({ error: 'Brand not found' });
        }

        // Отвязываем рестораны от бренда
        await prisma.restaurant.updateMany({
            where: { brandId: id },
            data: { brandId: null }
        });

        // Удаляем бренд
        await prisma.restaurantBrand.delete({
            where: { id }
        });

        res.json({
            message: 'Brand deleted successfully',
            restaurantsUnlinked: brand.restaurants.length
        });
    } catch (error) {
        console.error('Error deleting brand:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

/**
 * PUT /api/brands/:brandId/restaurants/:restaurantId
 * Добавить ресторан в бренд
 */
export const addRestaurantToBrand = async (req, res) => {
    try {
        const { brandId, restaurantId } = req.params;
        const userId = req.user.id;

        // Проверяем что бренд принадлежит пользователю
        const brand = await prisma.restaurantBrand.findFirst({
            where: { id: brandId, ownerId: userId },
            include: {
                restaurants: true
            }
        });

        if (!brand) {
            return res.status(404).json({ error: 'Brand not found' });
        }

        // Проверяем что ресторан принадлежит пользователю
        const restaurant = await prisma.restaurant.findFirst({
            where: { id: restaurantId, ownerId: userId }
        });

        if (!restaurant) {
            return res.status(404).json({ error: 'Restaurant not found' });
        }

        // Добавляем ресторан в бренд
        const updatedRestaurant = await prisma.restaurant.update({
            where: { id: restaurantId },
            data: { brandId }
        });

        res.json({
            message: 'Restaurant added to brand successfully',
            restaurant: updatedRestaurant,
            brand: {
                id: brand.id,
                name: brand.name,
                restaurantCount: brand.restaurants.length + 1
            }
        });
    } catch (error) {
        console.error('Error adding restaurant to brand:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

/**
 * DELETE /api/brands/:brandId/restaurants/:restaurantId
 * Убрать ресторан из бренда
 */
export const removeRestaurantFromBrand = async (req, res) => {
    try {
        const { brandId, restaurantId } = req.params;
        const userId = req.user.id;

        // Проверяем что бренд принадлежит пользователю
        const brand = await prisma.restaurantBrand.findFirst({
            where: { id: brandId, ownerId: userId }
        });

        if (!brand) {
            return res.status(404).json({ error: 'Brand not found' });
        }

        // Проверяем что ресторан принадлежит бренду
        const restaurant = await prisma.restaurant.findFirst({
            where: {
                id: restaurantId,
                brandId,
                ownerId: userId
            }
        });

        if (!restaurant) {
            return res.status(404).json({ error: 'Restaurant not found in this brand' });
        }

        // Отвязываем ресторан от бренда
        const updatedRestaurant = await prisma.restaurant.update({
            where: { id: restaurantId },
            data: { brandId: null }
        });

        res.json({
            message: 'Restaurant removed from brand successfully',
            restaurant: updatedRestaurant
        });
    } catch (error) {
        console.error('Error removing restaurant from brand:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

export default {
    getBrands,
    getBrandById,
    createBrand,
    updateBrand,
    deleteBrand,
    addRestaurantToBrand,
    removeRestaurantFromBrand
};
