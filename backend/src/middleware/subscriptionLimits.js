/**
 * Middleware для проверки лимитов подписки
 * 
 * ⚠️ ВРЕМЕННО ОТКЛЮЧЕНО - требуется применить миграцию БД!
 * Раскомментировать после выполнения: backend/prisma/migrations/add_delivery_addon_and_limits.sql
 * 
 * Все middleware временно заменены на заглушки (просто пропускают запросы)
 */

import { prisma } from '../config/prisma.js';

// Все функции временно отключены - просто пропускают запросы
export const checkDeliveryAccess = async (req, res, next) => next();
export const checkSmsLimit = async (req, res, next) => next();
export const checkCustomerLimit = async (req, res, next) => next();
export const incrementSmsCounter = async (subscriptionId, smsCharge = 0) => { /* temporarily disabled */ };

export const getSubscriptionUsage = async (req, res) => {
    res.json({
        message: 'Subscription limits temporarily disabled. Apply migration first.',
        migrationFile: 'backend/prisma/migrations/add_delivery_addon_and_limits.sql'
    });
};

export default {
    checkDeliveryAccess,
    checkSmsLimit,
    incrementSmsCounter,
    checkCustomerLimit,
    getSubscriptionUsage
};

/* ========================================
   ВРЕМЕННО ЗАКОММЕНТИРОВАНО
   Раскомментировать после применения миграции!
   ========================================

ВЕСЬ КОД ЗАКОММЕНТИРОВАН ДЛЯ БЕЗОПАСНОГО ДЕПЛОЯ
После применения миграции раскомментировать содержимое из git истории

======================================== */
