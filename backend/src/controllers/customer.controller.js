import { prisma } from '../config/prisma.js';
import bcrypt from 'bcryptjs';
import telegramService from '../services/telegram.service.js';
import { getNetworkRankedDeliveryPoints } from './geolocation.controller.js';

const getMenuSourceRestaurantId = async (restaurantId) => {
    const restaurant = await prisma.restaurant.findUnique({
        where: { id: restaurantId },
        select: { id: true, sharedMenuSourceRestaurantId: true }
    });

    if (!restaurant) return null;
    return restaurant.sharedMenuSourceRestaurantId || restaurant.id;
};

const getNearestServingRestaurant = async ({ restaurantId, latitude, longitude }) => {
    const baseRestaurant = await prisma.restaurant.findUnique({
        where: { id: restaurantId },
        select: { ownerId: true }
    });

    if (!baseRestaurant) return null;

    const ranked = await getNetworkRankedDeliveryPoints({
        ownerId: baseRestaurant.ownerId,
        latitude,
        longitude
    });

    return ranked.find((r) => r.inDeliveryZone) || null;
};

const DEFAULT_BONUS_RATE = 0;
const DEFAULT_BONUS_EXPIRY_DAYS = 90;

const isDeliveredStatus = (status) => {
    const normalized = String(status || '').toLowerCase();
    return normalized.includes('delivered') ||
        normalized.includes('completed') ||
        normalized.includes('finished') ||
        normalized.includes('done') ||
        normalized.includes('success');
};

const isBonusEligibleOrderType = (deliveryType) => {
    const normalized = String(deliveryType || '').toLowerCase();
    return normalized === 'delivery' || normalized === 'pickup';
};

const getActiveTierBonusConfig = (subscriptions = []) => {
    if (!Array.isArray(subscriptions) || subscriptions.length === 0) return null;
    const active = subscriptions.find((s) => s?.status === 'ACTIVE') || subscriptions[0];
    return active?.pricingTier || null;
};

const getEffectiveBonusConfig = (restaurant) => {
    const tier = getActiveTierBonusConfig(restaurant?.subscriptions || []);
    const useTier = restaurant?.useTierBonusSettings !== false;
    const hasTierBonusConfig = Boolean(tier);

    if (useTier && hasTierBonusConfig) {
        return {
            enabled: Boolean(tier?.bonusProgramEnabled),
            rate: Number.isFinite(Number(tier?.bonusAccrualRate)) ? Number(tier?.bonusAccrualRate) : DEFAULT_BONUS_RATE,
            expiryDays: Number.isFinite(Number(tier?.bonusExpiryDays)) ? Number(tier?.bonusExpiryDays) : DEFAULT_BONUS_EXPIRY_DAYS
        };
    }

    return {
        enabled: Boolean(restaurant?.bonusProgramEnabled),
        rate: Number.isFinite(Number(restaurant?.bonusAccrualRate)) ? Number(restaurant?.bonusAccrualRate) : DEFAULT_BONUS_RATE,
        expiryDays: Number.isFinite(Number(restaurant?.bonusExpiryDays)) ? Number(restaurant?.bonusExpiryDays) : DEFAULT_BONUS_EXPIRY_DAYS
    };
};

const getRestaurantBonusSettings = async (restaurantId) => {
    if (!restaurantId) return null;
    return prisma.restaurant.findUnique({
        where: { id: restaurantId },
        select: {
            useTierBonusSettings: true,
            bonusProgramEnabled: true,
            bonusAccrualRate: true,
            bonusExpiryDays: true,
            subscriptions: {
                select: {
                    status: true,
                    pricingTier: {
                        select: {
                            bonusProgramEnabled: true,
                            bonusAccrualRate: true,
                            bonusExpiryDays: true
                        }
                    }
                }
            }
        }
    });
};

const getCustomerAvailableBonusPoints = async (customerId) => {
    const now = new Date();
    const orders = await prisma.order.findMany({
        where: { customerId },
        select: {
            status: true,
            deliveryType: true,
            totalAmount: true,
            createdAt: true,
            bonusSpent: true,
            restaurant: {
                select: {
                    useTierBonusSettings: true,
                    bonusProgramEnabled: true,
                    bonusAccrualRate: true,
                    bonusExpiryDays: true,
                    subscriptions: {
                        select: {
                            status: true,
                            pricingTier: {
                                select: {
                                    bonusProgramEnabled: true,
                                    bonusAccrualRate: true,
                                    bonusExpiryDays: true
                                }
                            }
                        }
                    }
                }
            }
        }
    });

    const spentTotal = orders.reduce((sum, order) => {
        const value = Math.floor(Number(order?.bonusSpent || 0));
        return sum + (Number.isFinite(value) && value > 0 ? value : 0);
    }, 0);

    const activeEarned = orders.reduce((sum, order) => {
        if (!isBonusEligibleOrderType(order?.deliveryType)) return sum;
        if (!isDeliveredStatus(order?.status)) return sum;

        const config = getEffectiveBonusConfig(order?.restaurant);
        if (!config.enabled || config.rate <= 0) return sum;

        const totalAmount = Number(order?.totalAmount || 0);
        if (!Number.isFinite(totalAmount) || totalAmount <= 0) return sum;

        const earned = Math.floor(totalAmount * config.rate);
        if (earned <= 0) return sum;

        const expiryDays = Number.isFinite(Number(config.expiryDays)) ? Number(config.expiryDays) : DEFAULT_BONUS_EXPIRY_DAYS;
        const orderDate = order?.createdAt ? new Date(order.createdAt) : null;
        if (!orderDate || Number.isNaN(orderDate.getTime())) return sum;

        const expiresAt = new Date(orderDate.getTime() + expiryDays * 24 * 60 * 60 * 1000);
        if (expiresAt <= now) return sum;

        return sum + earned;
    }, 0);

    return Math.max(0, activeEarned - spentTotal);
};

/**
 * Получить профиль клиента
 */
export const getProfile = async (req, res, next) => {
    try {
        const customerId = req.customerId;

        const customer = await prisma.customer.findUnique({
            where: { id: customerId },
            include: {
                savedAddresses: {
                    orderBy: { isDefault: 'desc' }
                },
                favoriteDishes: {
                    include: {
                        dish: {
                            include: {
                                category: true,
                                restaurant: {
                                    select: {
                                        id: true,
                                        name: true,
                                        subdomain: true
                                    }
                                }
                            }
                        }
                    }
                }
            }
        });

        if (!customer) {
            return res.status(404).json({ error: 'Customer not found' });
        }

        // Parse preferences if it's a JSON string
        if (customer.preferences && typeof customer.preferences === 'string') {
            try {
                customer.preferences = JSON.parse(customer.preferences);
            } catch (e) {
                customer.preferences = null;
            }
        }

        const { password: _, ...customerData } = customer;
        res.json(customerData);
    } catch (error) {
        next(error);
    }
};

/**
 * Обновить профиль клиента
 */
export const updateProfile = async (req, res, next) => {
    try {
        const customerId = req.customerId;
        const { name, email, avatar, preferences } = req.body;

        const updatedCustomer = await prisma.customer.update({
            where: { id: customerId },
            data: {
                name: name || undefined,
                email: email || undefined,
                avatar: avatar || undefined,
                preferences: preferences ? JSON.stringify(preferences) : undefined
            }
        });

        const { password: _, ...customerData } = updatedCustomer;
        res.json({
            message: 'Profile updated successfully',
            customer: customerData
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Изменить пароль
 */
export const changePassword = async (req, res, next) => {
    try {
        const customerId = req.customerId;
        const { currentPassword, newPassword } = req.body;

        if (!newPassword || newPassword.length < 6) {
            return res.status(400).json({ error: 'New password must be at least 6 characters' });
        }

        const customer = await prisma.customer.findUnique({
            where: { id: customerId }
        });

        // Если у клиента есть текущий пароль, проверяем его
        if (customer.password) {
            if (!currentPassword) {
                return res.status(400).json({ error: 'Current password is required' });
            }

            const isValid = await bcrypt.compare(currentPassword, customer.password);
            if (!isValid) {
                return res.status(401).json({ error: 'Current password is incorrect' });
            }
        }

        // Хешируем новый пароль
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        await prisma.customer.update({
            where: { id: customerId },
            data: { password: hashedPassword }
        });

        res.json({ message: 'Password changed successfully' });
    } catch (error) {
        next(error);
    }
};

/**
 * Получить историю заказов клиента
 */
export const getOrderHistory = async (req, res, next) => {
    try {
        const customerId = req.customerId;
        const { limit = 20, offset = 0 } = req.query;

        const orders = await prisma.order.findMany({
            where: { customerId },
            include: {
                items: {
                    include: {
                        dish: true,
                        product: true
                    }
                },
                restaurant: {
                    select: {
                        id: true,
                        name: true,
                        subdomain: true,
                        logo: true,
                        currency: true,
                        useTierBonusSettings: true,
                        bonusProgramEnabled: true,
                        bonusAccrualRate: true,
                        bonusExpiryDays: true,
                        subscriptions: {
                            select: {
                                status: true,
                                pricingTier: {
                                    select: {
                                        bonusProgramEnabled: true,
                                        bonusAccrualRate: true,
                                        bonusExpiryDays: true,
                                        bonusBronzeLabel: true,
                                        bonusSilverLabel: true,
                                        bonusGoldLabel: true,
                                        bonusSilverFromOrders: true,
                                        bonusGoldFromOrders: true
                                    }
                                }
                            }
                        }
                    }
                },
                customerAddress: true
            },
            orderBy: { createdAt: 'desc' },
            take: parseInt(limit),
            skip: parseInt(offset)
        });

        const totalOrders = await prisma.order.count({
            where: { customerId }
        });

        res.json({
            orders,
            total: totalOrders,
            limit: parseInt(limit),
            offset: parseInt(offset)
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Добавить блюдо в избранное
 */
export const addToFavorites = async (req, res, next) => {
    try {
        const customerId = req.customerId;
        const { dishId } = req.body;

        if (!dishId) {
            return res.status(400).json({ error: 'Dish ID is required' });
        }

        // Проверяем существование блюда
        const dish = await prisma.dish.findUnique({
            where: { id: dishId }
        });

        if (!dish) {
            return res.status(404).json({ error: 'Dish not found' });
        }

        // Проверяем, не добавлено ли уже
        const existing = await prisma.customerFavorite.findUnique({
            where: {
                customerId_dishId: {
                    customerId,
                    dishId
                }
            }
        });

        if (existing) {
            return res.status(400).json({ error: 'Dish already in favorites' });
        }

        const favorite = await prisma.customerFavorite.create({
            data: {
                customerId,
                dishId
            },
            include: {
                dish: {
                    include: {
                        category: true,
                        restaurant: {
                            select: {
                                id: true,
                                name: true,
                                subdomain: true
                            }
                        }
                    }
                }
            }
        });

        res.status(201).json({
            message: 'Added to favorites',
            favorite
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Удалить блюдо из избранного
 */
export const removeFromFavorites = async (req, res, next) => {
    try {
        const customerId = req.customerId;
        const { dishId } = req.params;

        const favorite = await prisma.customerFavorite.findUnique({
            where: {
                customerId_dishId: {
                    customerId,
                    dishId
                }
            }
        });

        if (!favorite) {
            return res.status(404).json({ error: 'Favorite not found' });
        }

        await prisma.customerFavorite.delete({
            where: {
                customerId_dishId: {
                    customerId,
                    dishId
                }
            }
        });

        res.json({ message: 'Removed from favorites' });
    } catch (error) {
        next(error);
    }
};

/**
 * Получить избранные блюда
 */
export const getFavorites = async (req, res, next) => {
    try {
        const customerId = req.customerId;

        const favorites = await prisma.customerFavorite.findMany({
            where: { customerId },
            include: {
                dish: {
                    include: {
                        category: true,
                        restaurant: {
                            select: {
                                id: true,
                                name: true,
                                subdomain: true,
                                logo: true,
                                currency: true
                            }
                        },
                        modifiers: {
                            include: {
                                options: true
                            }
                        }
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        res.json(favorites);
    } catch (error) {
        next(error);
    }
};

/**
 * Добавить адрес
 */
export const addAddress = async (req, res, next) => {
    try {
        const customerId = req.customerId;
        const { address, entrance, floor, apartment, latitude, longitude, label, comment, isDefault } = req.body;

        if (!address) {
            return res.status(400).json({ error: 'Address is required' });
        }

        // Если новый адрес устанавливается как default, убираем default у остальных
        if (isDefault) {
            await prisma.customerAddress.updateMany({
                where: { customerId },
                data: { isDefault: false }
            });
        }

        const newAddress = await prisma.customerAddress.create({
            data: {
                address,
                entrance: entrance || null,
                floor: floor || null,
                apartment: apartment || null,
                latitude: latitude ? parseFloat(latitude) : null,
                longitude: longitude ? parseFloat(longitude) : null,
                label: label || null,
                comment: comment || null,
                isDefault: isDefault || false,
                customer: {
                    connect: { id: customerId }
                }
            }
        });

        res.status(201).json({
            message: 'Address added successfully',
            address: newAddress
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Обновить адрес
 */
export const updateAddress = async (req, res, next) => {
    try {
        const customerId = req.customerId;
        const { addressId } = req.params;
        const { address, latitude, longitude, label, isDefault } = req.body;

        // Проверяем, принадлежит ли адрес клиенту
        const existingAddress = await prisma.customerAddress.findUnique({
            where: { id: addressId }
        });

        if (!existingAddress || existingAddress.customerId !== customerId) {
            return res.status(404).json({ error: 'Address not found' });
        }

        // Если адрес устанавливается как default, убираем default у остальных
        if (isDefault && !existingAddress.isDefault) {
            await prisma.customerAddress.updateMany({
                where: { customerId, id: { not: addressId } },
                data: { isDefault: false }
            });
        }

        const updatedAddress = await prisma.customerAddress.update({
            where: { id: addressId },
            data: {
                address: address || undefined,
                latitude: latitude ? parseFloat(latitude) : undefined,
                longitude: longitude ? parseFloat(longitude) : undefined,
                label: label !== undefined ? label : undefined,
                isDefault: isDefault !== undefined ? isDefault : undefined
            }
        });

        res.json({
            message: 'Address updated successfully',
            address: updatedAddress
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Удалить адрес
 */
export const deleteAddress = async (req, res, next) => {
    try {
        const customerId = req.customerId;
        const { addressId } = req.params;

        const address = await prisma.customerAddress.findUnique({
            where: { id: addressId }
        });

        if (!address || address.customerId !== customerId) {
            return res.status(404).json({ error: 'Address not found' });
        }

        await prisma.customerAddress.delete({
            where: { id: addressId }
        });

        res.json({ message: 'Address deleted successfully' });
    } catch (error) {
        next(error);
    }
};
/**
 * Получить все адреса клиента
 */
export const getAddresses = async (req, res, next) => {
    try {
        const customerId = req.customerId;

        const addresses = await prisma.customerAddress.findMany({
            where: { customerId },
            orderBy: [
                { isDefault: 'desc' },
                { createdAt: 'desc' }
            ]
        });

        res.json({ addresses });
    } catch (error) {
        next(error);
    }
};

/**
 * Создать заказ от авторизованного клиента
 */
export const createCustomerOrder = async (req, res, next) => {
    try {
        const customerId = req.customerId;
        const {
            restaurantId,
            items,
            total,
            deliveryType,
            paymentMethod,
            comment,
            customerAddressId,
            deliveryAddress,
            tableNumber,
            bonusToSpend
        } = req.body;

        if (!restaurantId || !items || !Array.isArray(items) || items.length === 0 || total === undefined) {
            return res.status(400).json({
                error: 'restaurantId, items (non-empty array), and total are required'
            });
        }

        const parsedTotal = parseFloat(total);
        if (!Number.isFinite(parsedTotal)) {
            return res.status(400).json({ error: 'Invalid total amount' });
        }

        const requestedBonusToSpend = bonusToSpend !== undefined && bonusToSpend !== null
            ? parseInt(bonusToSpend, 10)
            : 0;

        if (!Number.isFinite(requestedBonusToSpend) || requestedBonusToSpend < 0) {
            return res.status(400).json({ error: 'bonusToSpend must be a non-negative integer' });
        }

        const customer = await prisma.customer.findUnique({
            where: { id: customerId }
        });

        if (!customer) {
            return res.status(404).json({ error: 'Customer not found' });
        }

        const timestamp = Date.now().toString().slice(-6);
        const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
        const orderNumber = `#${timestamp}${random}`;

        const validItems = items.filter(item => item && item.id);
        const dishIds = validItems.map(item => item.id);
        const menuSourceRestaurantId = await getMenuSourceRestaurantId(restaurantId);
        if (!menuSourceRestaurantId) {
            return res.status(404).json({ error: 'Restaurant not found' });
        }

        const existingDishes = await prisma.dish.findMany({
            where: {
                id: { in: dishIds },
                restaurantId: menuSourceRestaurantId
            },
            select: { id: true }
        });

        if (existingDishes.length !== dishIds.length) {
            const notFoundIds = dishIds.filter(id => !existingDishes.some(d => d.id === id));
            return res.status(400).json({ error: `One or more dishes not found: ${notFoundIds.join(', ')}` });
        }

        let normalizedDeliveryLatitude = null;
        let normalizedDeliveryLongitude = null;
        let resolvedDeliveryAddress = deliveryAddress || null;
        let assignedRestaurantId = null;
        let servingRestaurantId = restaurantId;

        if (deliveryType === 'delivery') {
            if (!customerAddressId) {
                return res.status(400).json({ error: 'customerAddressId is required for delivery' });
            }

            const selectedAddress = await prisma.customerAddress.findFirst({
                where: { id: customerAddressId, customerId },
                select: {
                    id: true,
                    address: true,
                    latitude: true,
                    longitude: true
                }
            });

            if (!selectedAddress) {
                return res.status(400).json({ error: 'Selected address not found' });
            }

            normalizedDeliveryLatitude = selectedAddress.latitude ?? null;
            normalizedDeliveryLongitude = selectedAddress.longitude ?? null;
            resolvedDeliveryAddress = selectedAddress.address || resolvedDeliveryAddress;

            if (!Number.isFinite(normalizedDeliveryLatitude) || !Number.isFinite(normalizedDeliveryLongitude)) {
                return res.status(400).json({ error: 'Delivery coordinates are required' });
            }

            const nearest = await getNearestServingRestaurant({
                restaurantId,
                latitude: normalizedDeliveryLatitude,
                longitude: normalizedDeliveryLongitude
            });

            if (!nearest?.id) {
                return res.status(400).json({ error: 'Delivery is unavailable for this address' });
            }

            servingRestaurantId = nearest.id;
            if (nearest.id !== restaurantId) {
                assignedRestaurantId = nearest.id;
            }

            if (nearest.minOrderAmount && parsedTotal < nearest.minOrderAmount) {
                return res.status(400).json({ error: `Minimum order amount for delivery: ${nearest.minOrderAmount}` });
            }
        }

        const stoppedDishes = await prisma.dishStop.findMany({
            where: {
                restaurantId: servingRestaurantId,
                isStopped: true,
                dishId: { in: dishIds }
            },
            select: {
                dishId: true,
                reason: true,
                dish: { select: { name: true } }
            }
        });

        if (stoppedDishes.length > 0) {
            return res.status(400).json({
                error: 'Some dishes are temporarily unavailable at this restaurant',
                stoppedDishes: stoppedDishes.map((x) => ({
                    dishId: x.dishId,
                    name: x.dish?.name || null,
                    reason: x.reason || null
                }))
            });
        }

        let appliedBonusSpent = 0;
        if (requestedBonusToSpend > 0) {
            const servingRestaurantBonusSettings = await getRestaurantBonusSettings(servingRestaurantId);
            const servingRestaurantBonusConfig = getEffectiveBonusConfig(servingRestaurantBonusSettings);

            if (!servingRestaurantBonusConfig.enabled) {
                return res.status(400).json({ error: 'Bonus program is disabled for this restaurant' });
            }

            const availableBonusPoints = await getCustomerAvailableBonusPoints(customerId);
            const maxByOrderTotal = Math.max(0, Math.floor(parsedTotal));
            appliedBonusSpent = Math.min(requestedBonusToSpend, availableBonusPoints, maxByOrderTotal);

            if (appliedBonusSpent <= 0) {
                return res.status(400).json({ error: 'No available bonuses to spend' });
            }
        }

        const finalTotal = Math.max(0, parsedTotal - appliedBonusSpent);

        const order = await prisma.order.create({
            data: {
                orderNumber,
                restaurantId,
                assignedRestaurantId,
                customerId,
                totalAmount: finalTotal,
                bonusSpent: appliedBonusSpent,
                customerName: customer.name || 'Customer',
                customerPhone: customer.phone,
                customerEmail: customer.email,
                deliveryAddress: resolvedDeliveryAddress,
                deliveryLatitude: normalizedDeliveryLatitude,
                deliveryLongitude: normalizedDeliveryLongitude,
                notes: comment || null,
                deliveryType: deliveryType || 'delivery',
                paymentMethod: paymentMethod || 'cash',
                tableNumber: tableNumber || null,
                customerAddressId: customerAddressId || null,
                items: {
                    create: validItems.map(item => ({
                        dishId: item.id,
                        quantity: parseInt(item.quantity, 10),
                        price: item.price ?? 0,
                        selectedModifiers: item.selectedModifiers?.length > 0 ? item.selectedModifiers : undefined
                    }))
                }
            },
            include: {
                items: {
                    include: {
                        dish: true
                    }
                },
                restaurant: {
                    include: {
                        socialLinks: true
                    }
                },
                customerAddress: true
            }
        });

        let notificationRestaurant = order.restaurant;
        if (order.assignedRestaurantId) {
            const assignedRestaurant = await prisma.restaurant.findUnique({
                where: { id: order.assignedRestaurantId },
                include: { socialLinks: true }
            });
            if (assignedRestaurant) {
                notificationRestaurant = assignedRestaurant;
            }
        }

        if (notificationRestaurant?.telegramGroupId) {
            telegramService.sendNewOrderNotification(order, notificationRestaurant).catch(err => {
                console.error('Failed to send Telegram notification:', err);
            });
        }

        res.status(201).json({
            message: 'Order created successfully',
            order: order,
            orderNumber: order.orderNumber
        });
    } catch (error) {
        console.error('Order creation error:', error);
        res.status(500).json({
            error: 'Failed to create order',
            details: error.message || 'An internal server error occurred.'
        });
    }
};

/**
 * Получить список ресторанов клиента (где он делал заказы или добавлял в избранное)
 */
export const getMyRestaurants = async (req, res, next) => {
    try {
        const customerId = req.customerId;

        if (!customerId) {
            return res.status(401).json({ error: 'Customer not authenticated' });
        }

        // Получаем зарегистрированный ресторан (если сохранён при логине/регистрации)
        const customer = await prisma.customer.findUnique({
            where: { id: customerId },
            select: { registeredRestaurantId: true }
        });

        // Используем простой подход - получаем все заказы и избранное клиента
        const [orders, favorites] = await Promise.all([
            prisma.order.findMany({
                where: { customerId },
                select: { restaurantId: true },
                distinct: ['restaurantId']
            }),
            prisma.customerFavorite.findMany({
                where: { customerId },
                include: {
                    dish: {
                        select: { restaurantId: true }
                    }
                }
            })
        ]);

        // Собираем уникальные ID ресторанов
        const restaurantIds = new Set();

        if (customer?.registeredRestaurantId) {
            restaurantIds.add(customer.registeredRestaurantId);
        }

        orders.forEach(order => {
            if (order.restaurantId) {
                restaurantIds.add(order.restaurantId);
            }
        });

        favorites.forEach(fav => {
            if (fav.dish?.restaurantId) {
                restaurantIds.add(fav.dish.restaurantId);
            }
        });

        if (restaurantIds.size === 0) {
            return res.json({ restaurants: [] });
        }

        // Получаем данные ресторанов
        const restaurants = await Promise.all(
            Array.from(restaurantIds).map(async (restaurantId) => {
                const [restaurant, orderCount, favoriteCount] = await Promise.all([
                    prisma.restaurant.findUnique({
                        where: { id: restaurantId },
                        select: {
                            id: true,
                            name: true,
                            subdomain: true,
                            description: true,
                            logo: true,
                            currency: true
                        }
                    }),
                    prisma.order.count({
                        where: { customerId, restaurantId }
                    }),
                    prisma.customerFavorite.count({
                        where: {
                            customerId,
                            dish: { restaurantId }
                        }
                    })
                ]);

                return {
                    ...restaurant,
                    orderCount,
                    favoriteCount
                };
            })
        );

        // Фильтруем null значения и сортируем
        const validRestaurants = restaurants
            .filter(r => r && r.id)
            .sort((a, b) => b.orderCount - a.orderCount);

        res.json({ restaurants: validRestaurants });
    } catch (error) {
        console.error('Error getting customer restaurants:', error);
        console.error('Error stack:', error.stack);
        res.status(500).json({
            error: 'Failed to get restaurants',
            details: error.message
        });
    }
};
