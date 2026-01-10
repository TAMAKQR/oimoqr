import { prisma } from '../models/index.js';

/**
 * Middleware для отслеживания просмотров меню
 * Записывает просмотр в таблицу MenuView
 */
export const trackMenuView = async (req, res, next) => {
    try {
        // Получаем IP адрес пользователя
        const ipAddress = req.headers['x-forwarded-for']?.split(',')[0] ||
            req.connection?.remoteAddress ||
            req.socket?.remoteAddress ||
            req.ip;

        // Получаем User-Agent
        const userAgent = req.headers['user-agent'];

        // Получаем restaurantId из response locals (будет установлен в контроллере)
        const restaurantId = res.locals.restaurantId;

        if (restaurantId) {
            // Создаем запись о просмотре асинхронно (не блокируем ответ)
            prisma.menuView.create({
                data: {
                    restaurantId,
                    ipAddress,
                    userAgent
                }
            }).catch(err => {
                // Логируем ошибку, но не прерываем запрос
                console.error('Error tracking menu view:', err);
            });
        }

        next();
    } catch (error) {
        // Не прерываем запрос при ошибке трекинга
        console.error('Error in trackMenuView middleware:', error);
        next();
    }
};
