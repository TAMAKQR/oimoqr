import { prisma } from '../config/prisma.js';
import telegramService from '../services/telegram.service.js';

// Обновить настройки Telegram для ресторана
export const updateTelegramSettings = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { telegramGroupId } = req.body;

        // Проверяем права доступа
        const restaurant = await prisma.restaurant.findUnique({
            where: { id },
            select: { ownerId: true }
        });

        if (!restaurant) {
            return res.status(404).json({ error: 'Restaurant not found' });
        }

        // Проверяем права доступа (владелец или стафф)
        const isOwner = restaurant.ownerId === req.user.id;
        const isStaff = req.user.restaurantStaff?.some(s => s.restaurantId === id);
        if (!isOwner && !isStaff && !req.user.isAdmin) {
            return res.status(403).json({ error: 'Access denied' });
        }

        // Обновляем настройки
        const updated = await prisma.restaurant.update({
            where: { id },
            data: {
                telegramGroupId: telegramGroupId || null
            },
            select: {
                id: true,
                name: true,
                telegramGroupId: true
            }
        });

        res.json({
            message: 'Telegram settings updated',
            restaurant: updated
        });
    } catch (error) {
        next(error);
    }
};

// Тестовое сообщение в Telegram группу
export const testTelegramConnection = async (req, res, next) => {
    try {
        const { id } = req.params;

        const restaurant = await prisma.restaurant.findUnique({
            where: { id },
            select: {
                ownerId: true,
                telegramGroupId: true,
                name: true
            }
        });

        if (!restaurant) {
            return res.status(404).json({ error: 'Restaurant not found' });
        }

        // Проверяем права доступа (владелец или стафф)
        const isOwner = restaurant.ownerId === req.user.id;
        const isStaff = req.user.restaurantStaff?.some(s => s.restaurantId === id);
        if (!isOwner && !isStaff && !req.user.isAdmin) {
            return res.status(403).json({ error: 'Access denied' });
        }

        if (!restaurant.telegramGroupId) {
            return res.status(400).json({ error: 'Telegram group ID not configured' });
        }

        // Тестируем подключение
        await telegramService.testConnection(restaurant.telegramGroupId);

        res.json({
            message: 'Test message sent successfully',
            success: true
        });
    } catch (error) {
        res.status(400).json({
            error: error.message || 'Failed to send test message',
            success: false
        });
    }
};
