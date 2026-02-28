/**
 * Middleware для проверки лимитов подписки
 * - SMS лимиты
 * - Лимиты базы клиентов
 * - Проверка доступа к модулю доставки
 */

import { prisma } from '../config/prisma.js';

/**
 * Проверка доступности модуля доставки
 */
export const checkDeliveryAccess = async (req, res, next) => {
    try {
        const { restaurantId } = req.params;

        const restaurant = await prisma.restaurant.findUnique({
            where: { id: restaurantId },
            include: {
                subscriptions: {
                    include: { pricingTier: true }
                }
            }
        });

        if (!restaurant) {
            return res.status(404).json({ error: 'Restaurant not found' });
        }

        const subscription = restaurant.subscriptions?.[0];
        if (!subscription) {
            return res.status(402).json({
                error: 'No active subscription',
                code: 'SUBSCRIPTION_REQUIRED'
            });
        }

        // Проверяем включен ли модуль доставки в тарифе или как add-on
        const hasDelivery =
            subscription.pricingTier?.includesDelivery ||
            subscription.addons?.includes('delivery');

        if (!hasDelivery) {
            return res.status(402).json({
                error: 'Delivery module not available. Please upgrade your plan or add the Delivery add-on.',
                code: 'DELIVERY_MODULE_REQUIRED',
                upgrade: {
                    message: 'Add Delivery module for $19.99/month',
                    price: 19.99,
                    addon: 'delivery'
                }
            });
        }

        // Сохраняем подписку в req для дальнейшего использования
        req.subscription = subscription;
        next();
    } catch (error) {
        console.error('Error checking delivery access:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

/**
 * Проверка и учет использования SMS
 */
export const checkSmsLimit = async (req, res, next) => {
    try {
        const { restaurantId } = req.body;

        if (!restaurantId) {
            return next(); // Пропускаем если нет restaurantId
        }

        const restaurant = await prisma.restaurant.findUnique({
            where: { id: restaurantId },
            include: {
                subscriptions: {
                    include: { pricingTier: true }
                }
            }
        });

        const subscription = restaurant?.subscriptions?.[0];
        if (!subscription?.pricingTier) {
            return res.status(402).json({
                error: 'Active subscription required to send SMS',
                code: 'SUBSCRIPTION_REQUIRED'
            });
        }

        const tier = subscription.pricingTier;

        // Безлимитный тариф (-1)
        if (tier.includedSmsCount === -1) {
            req.smsCharge = 0;
            req.subscription = subscription;
            return next();
        }

        // Проверяем нужно ли сбросить счетчик (новый месяц)
        const now = new Date();
        const resetDate = subscription.smsResetDate ? new Date(subscription.smsResetDate) : null;

        if (!resetDate || resetDate < now) {
            // Сбрасываем счетчик и устанавливаем новую дату сброса
            const nextResetDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);

            await prisma.subscription.update({
                where: { id: subscription.id },
                data: {
                    smsUsedThisMonth: 0,
                    smsResetDate: nextResetDate,
                    smsOverageCharges: 0
                }
            });

            subscription.smsUsedThisMonth = 0;
            subscription.smsOverageCharges = 0;
        }

        // Рассчитываем стоимость этой SMS
        let smsCharge = 0;
        if (subscription.smsUsedThisMonth >= tier.includedSmsCount) {
            // Превышен лимит - начисляем overage
            smsCharge = tier.smsOveragePrice;
        }

        // Сохраняем информацию в req для использования в контроллере
        req.smsCharge = smsCharge;
        req.subscription = subscription;
        req.shouldIncrementSmsCounter = true;

        next();
    } catch (error) {
        console.error('Error checking SMS limit:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

/**
 * Увеличение счетчика SMS после успешной отправки
 * Вызывать после того, как SMS реально отправлена
 */
export const incrementSmsCounter = async (subscriptionId, smsCharge = 0) => {
    try {
        await prisma.subscription.update({
            where: { id: subscriptionId },
            data: {
                smsUsedThisMonth: { increment: 1 },
                smsOverageCharges: { increment: smsCharge }
            }
        });
    } catch (error) {
        console.error('Error incrementing SMS counter:', error);
    }
};

/**
 * Проверка лимита базы клиентов
 */
export const checkCustomerLimit = async (req, res, next) => {
    try {
        const { restaurantId } = req.body;

        if (!restaurantId) {
            return next();
        }

        const restaurant = await prisma.restaurant.findUnique({
            where: { id: restaurantId },
            include: {
                subscriptions: {
                    include: { pricingTier: true }
                }
            }
        });

        const subscription = restaurant?.subscriptions?.[0];
        if (!subscription?.pricingTier) {
            return res.status(402).json({
                error: 'Active subscription required',
                code: 'SUBSCRIPTION_REQUIRED'
            });
        }

        const tier = subscription.pricingTier;

        // Если лимита нет (NULL) - пропускаем
        if (!tier.maxCustomers) {
            return next();
        }

        // Считаем текущее количество клиентов
        const customerCount = await prisma.customer.count({
            where: { registeredRestaurantId: restaurantId }
        });

        if (customerCount >= tier.maxCustomers) {
            return res.status(402).json({
                error: `Customer limit reached (${tier.maxCustomers}). Please upgrade your plan.`,
                code: 'CUSTOMER_LIMIT_REACHED',
                currentCount: customerCount,
                limit: tier.maxCustomers,
                upgrade: {
                    message: 'Upgrade to Professional plan for unlimited customers',
                    suggestedPlan: 'PROFESSIONAL'
                }
            });
        }

        next();
    } catch (error) {
        console.error('Error checking customer limit:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

/**
 * Получение информации об использовании для dashboard
 */
export const getSubscriptionUsage = async (req, res) => {
    try {
        const { restaurantId } = req.params;

        const restaurant = await prisma.restaurant.findUnique({
            where: { id: restaurantId },
            include: {
                subscriptions: {
                    include: { pricingTier: true }
                }
            }
        });

        if (!restaurant) {
            return res.status(404).json({ error: 'Restaurant not found' });
        }

        const subscription = restaurant.subscriptions?.[0];
        if (!subscription) {
            return res.status(404).json({ error: 'No active subscription' });
        }

        const tier = subscription.pricingTier;

        // Считаем использование
        const customerCount = await prisma.customer.count({
            where: { registeredRestaurantId: restaurantId }
        });

        const usage = {
            sms: {
                used: subscription.smsUsedThisMonth,
                included: tier?.includedSmsCount === -1 ? 'unlimited' : tier?.includedSmsCount || 0,
                overage: subscription.smsUsedThisMonth > (tier?.includedSmsCount || 0)
                    ? subscription.smsUsedThisMonth - tier.includedSmsCount
                    : 0,
                overageCharges: subscription.smsOverageCharges,
                resetDate: subscription.smsResetDate
            },
            customers: {
                used: customerCount,
                limit: tier?.maxCustomers || 'unlimited',
                percentage: tier?.maxCustomers
                    ? Math.round((customerCount / tier.maxCustomers) * 100)
                    : 0
            },
            restaurants: {
                used: await prisma.restaurant.count({
                    where: { ownerId: restaurant.ownerId }
                }),
                limit: tier?.maxRestaurants || 'unlimited'
            },
            modules: {
                delivery: tier?.includesDelivery || subscription.addons?.includes('delivery'),
                analytics: subscription.addons?.includes('analytics'),
                customersPro: subscription.addons?.includes('customers_pro')
            },
            plan: {
                name: tier?.name,
                price: tier?.price,
                status: subscription.status,
                currentPeriodEnd: subscription.currentPeriodEnd
            }
        };

        res.json(usage);
    } catch (error) {
        console.error('Error getting subscription usage:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

export default {
    checkDeliveryAccess,
    checkSmsLimit,
    incrementSmsCounter,
    checkCustomerLimit,
    getSubscriptionUsage
};

