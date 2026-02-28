/**
 * Middleware для проверки лимитов подписки на уровне бренда
 * - SMS лимиты (общие для всех ресторанов бренда)
 * - Лимиты базы клиентов (суммарно по всему бренду)
 * - Проверка доступа к модулю доставки
 */

import { prisma } from '../config/prisma.js';

/**
 * Проверка доступности модуля доставки
 * Подписка проверяется на уровне бренда, к которому принадлежит ресторан
 */
export const checkDeliveryAccess = async (req, res, next) => {
    try {
        const { restaurantId } = req.params;

        const restaurant = await prisma.restaurant.findUnique({
            where: { id: restaurantId },
            include: {
                brand: {
                    include: {
                        subscription: {
                            include: { pricingTier: true }
                        }
                    }
                }
            }
        });

        if (!restaurant) {
            return res.status(404).json({ error: 'Restaurant not found' });
        }

        // Если ресторан не привязан к бренду, требуется создать бренд
        if (!restaurant.brand) {
            return res.status(402).json({
                error: 'Restaurant must be part of a brand. Please create a brand first.',
                code: 'BRAND_REQUIRED'
            });
        }

        const subscription = restaurant.brand.subscription;
        if (!subscription) {
            return res.status(402).json({
                error: 'No active subscription for this brand',
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
        req.brand = restaurant.brand;
        next();
    } catch (error) {
        console.error('Error checking delivery access:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

/**
 * Проверка и учет использования SMS
 * SMS счетчик общий для всех ресторанов бренда
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
                brand: {
                    include: {
                        subscription: {
                            include: { pricingTier: true }
                        }
                    }
                }
            }
        });

        if (!restaurant?.brand?.subscription?.pricingTier) {
            return res.status(402).json({
                error: 'Active subscription required to send SMS',
                code: 'SUBSCRIPTION_REQUIRED'
            });
        }

        const subscription = restaurant.brand.subscription;
        const tier = subscription.pricingTier;

        // Безлимитный тариф (-1)
        if (tier.includedSmsCount === -1) {
            req.smsCharge = 0;
            req.subscription = subscription;
            req.brand = restaurant.brand;
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
        req.brand = restaurant.brand;
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
 * Считаем клиентов по ВСЕМ ресторанам бренда
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
                brand: {
                    include: {
                        subscription: {
                            include: { pricingTier: true }
                        },
                        restaurants: true // Получаем все рестораны бренда
                    }
                }
            }
        });

        if (!restaurant?.brand?.subscription?.pricingTier) {
            return res.status(402).json({
                error: 'Active subscription required',
                code: 'SUBSCRIPTION_REQUIRED'
            });
        }

        const subscription = restaurant.brand.subscription;
        const tier = subscription.pricingTier;

        // Если лимита нет (NULL) - пропускаем
        if (!tier.maxCustomers) {
            return next();
        }

        // Считаем клиентов по ВСЕМ ресторанам бренда
        const brandRestaurantIds = restaurant.brand.restaurants.map(r => r.id);
        const customerCount = await prisma.customer.count({
            where: {
                registeredRestaurantId: {
                    in: brandRestaurantIds
                }
            }
        });

        if (customerCount >= tier.maxCustomers) {
            return res.status(402).json({
                error: `Customer limit reached for your brand (${tier.maxCustomers}). Please upgrade your plan.`,
                code: 'CUSTOMER_LIMIT_REACHED',
                currentCount: customerCount,
                limit: tier.maxCustomers,
                brandName: restaurant.brand.name,
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
 * Показывает статистику по всему бренду (все рестораны)
 */
export const getSubscriptionUsage = async (req, res) => {
    try {
        const { restaurantId } = req.params;

        const restaurant = await prisma.restaurant.findUnique({
            where: { id: restaurantId },
            include: {
                brand: {
                    include: {
                        subscription: {
                            include: { pricingTier: true }
                        },
                        restaurants: true
                    }
                }
            }
        });

        if (!restaurant) {
            return res.status(404).json({ error: 'Restaurant not found' });
        }

        if (!restaurant.brand) {
            return res.status(404).json({ error: 'Restaurant is not part of a brand' });
        }

        const brand = restaurant.brand;
        const subscription = brand.subscription;

        if (!subscription) {
            return res.status(404).json({ error: 'No active subscription for this brand' });
        }

        const tier = subscription.pricingTier;

        // Считаем использование по всем ресторанам бренда
        const brandRestaurantIds = brand.restaurants.map(r => r.id);

        const customerCount = await prisma.customer.count({
            where: {
                registeredRestaurantId: {
                    in: brandRestaurantIds
                }
            }
        });

        const usage = {
            brand: {
                id: brand.id,
                name: brand.name,
                restaurantCount: brand.restaurants.length
            },
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
                used: brand.restaurants.length,
                limit: tier?.maxRestaurants || 'unlimited',
                percentage: tier?.maxRestaurants
                    ? Math.round((brand.restaurants.length / tier.maxRestaurants) * 100)
                    : 0
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

