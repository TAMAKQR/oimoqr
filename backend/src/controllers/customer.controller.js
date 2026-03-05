import { prisma } from '../config/prisma.js';
import bcrypt from 'bcryptjs';
import telegramService from '../services/telegram.service.js';
import { getNetworkRankedDeliveryPoints } from './geolocation.controller.js';
import { buildTrustedOrderItems, calculateDeliveryFee } from '../utils/orderPricing.js';

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
        select: { ownerId: true, city: true }
    });

    if (!baseRestaurant) return null;

    const ranked = await getNetworkRankedDeliveryPoints({
        ownerId: baseRestaurant.ownerId,
        latitude,
        longitude,
        city: baseRestaurant.city || null
    });

    return ranked.find((r) => r.inDeliveryZone) || null;
};

const DEFAULT_BONUS_RATE = 0;
const DEFAULT_BONUS_EXPIRY_DAYS = 90;
const roundCurrency = (value) => Number((Number(value) || 0).toFixed(2));
const hasHouseNumber = (address = '') => /\d/.test(String(address || '').trim());
const normalizePhoneDigits = (phone = '') => String(phone || '').replace(/\D/g, '');

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

const toOrderDate = (order) => {
    const value = order?.createdAt || order?.updatedAt || order?.date;
    const parsed = value ? new Date(value) : null;
    return parsed && !Number.isNaN(parsed.getTime()) ? parsed : null;
};

const getTier = (activeDeliveryOrders, tierConfig) => {
    const silverFromOrders = Number.isFinite(Number(tierConfig?.bonusSilverFromOrders))
        ? Number(tierConfig.bonusSilverFromOrders)
        : 8;
    const goldFromOrders = Number.isFinite(Number(tierConfig?.bonusGoldFromOrders))
        ? Number(tierConfig.bonusGoldFromOrders)
        : 20;
    const bronzeLabel = tierConfig?.bonusBronzeLabel || 'Bronze';
    const silverLabel = tierConfig?.bonusSilverLabel || 'Silver';
    const goldLabel = tierConfig?.bonusGoldLabel || 'Gold';

    if (activeDeliveryOrders >= goldFromOrders) {
        return {
            name: goldLabel,
            color: 'text-amber-600',
            bg: 'bg-amber-50',
            nextAt: null
        };
    }

    if (activeDeliveryOrders >= silverFromOrders) {
        return {
            name: silverLabel,
            color: 'text-slate-600',
            bg: 'bg-slate-50',
            nextAt: goldFromOrders
        };
    }

    return {
        name: bronzeLabel,
        color: 'text-orange-600',
        bg: 'bg-orange-50',
        nextAt: silverFromOrders
    };
};

const buildBonusSummaryFromOrders = (orders = []) => {
    const now = new Date();

    const bonusSystemActive = orders.some((order) => {
        const config = getEffectiveBonusConfig(order?.restaurant);
        return config.enabled && config.rate > 0;
    });

    const transactions = orders
        .filter((order) => isBonusEligibleOrderType(order?.deliveryType) && isDeliveredStatus(order?.status))
        .map((order) => {
            const config = getEffectiveBonusConfig(order?.restaurant);
            if (!config.enabled || config.rate <= 0) {
                return null;
            }

            const total = Number(order?.totalAmount || 0);
            if (!Number.isFinite(total) || total <= 0) {
                return null;
            }

            const earned = Math.floor(total * config.rate);
            if (earned <= 0) {
                return null;
            }

            const orderDate = toOrderDate(order);
            const expiresAt = orderDate
                ? new Date(orderDate.getTime() + config.expiryDays * 24 * 60 * 60 * 1000)
                : null;
            const isActive = expiresAt ? expiresAt > now : false;

            return {
                id: order?.id,
                orderNumber: order?.orderNumber || order?.id,
                total,
                earned,
                rate: config.rate,
                expiryDays: config.expiryDays,
                orderDate,
                expiresAt,
                isActive
            };
        })
        .filter(Boolean)
        .sort((a, b) => {
            const aTime = a.orderDate ? a.orderDate.getTime() : 0;
            const bTime = b.orderDate ? b.orderDate.getTime() : 0;
            return bTime - aTime;
        });

    const spentTotal = orders.reduce((sum, order) => {
        const spent = Math.floor(Number(order?.bonusSpent || 0));
        return sum + (Number.isFinite(spent) && spent > 0 ? spent : 0);
    }, 0);

    const activeEarned = transactions
        .filter((tx) => tx.isActive)
        .reduce((sum, tx) => sum + tx.earned, 0);
    const lifetimePoints = transactions.reduce((sum, tx) => sum + tx.earned, 0);
    const availablePoints = Math.max(0, activeEarned - spentTotal);
    const expiredPoints = Math.max(0, lifetimePoints - activeEarned);

    const deliveryOrdersCount = transactions.length;
    const tierSourceOrder = orders.find((order) => {
        const config = getEffectiveBonusConfig(order?.restaurant);
        return config.enabled;
    });
    const activeSubscription = tierSourceOrder?.restaurant?.subscriptions?.find((s) => s?.status === 'ACTIVE')
        || tierSourceOrder?.restaurant?.subscriptions?.[0];
    const tierConfig = activeSubscription?.pricingTier || null;
    const tier = getTier(deliveryOrdersCount, tierConfig);

    return {
        bonusSystemActive,
        activePoints: availablePoints,
        lifetimePoints,
        expiredPoints,
        spentPoints: spentTotal,
        deliveryOrdersCount,
        tier,
        transactions
    };
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

const getCustomerAvailableBonusPoints = async (customerId, dbClient = prisma) => {
    const now = new Date();
    const orders = await dbClient.order.findMany({
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

const withSerializableRetry = async (operation, retries = 2) => {
    for (let attempt = 0; attempt <= retries; attempt += 1) {
        try {
            return await operation();
        } catch (error) {
            const isSerializationConflict = error?.code === 'P2034';
            const shouldRetry = isSerializationConflict && attempt < retries;
            if (!shouldRetry) {
                throw error;
            }
        }
    }

    throw new Error('Transaction retry failed');
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

        const normalizedCustomerName = String(customer.name || '').trim();
        const normalizedCustomerPhone = String(customer.phone || '').trim();
        const phoneDigits = normalizePhoneDigits(normalizedCustomerPhone);
        if (normalizedDeliveryType !== 'dine_in' && (normalizedCustomerName.length < 2 || phoneDigits.length < 8)) {
            return res.status(400).json({ error: 'Профиль должен содержать имя и корректный телефон' });
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
 * Загрузить аватар клиента
 */
export const uploadCustomerAvatar = async (req, res, next) => {
    try {
        const customerId = req.customerId;

        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const avatarUrl = req.file.path?.startsWith('http')
            ? req.file.path
            : `/uploads/${req.file.filename}`;

        const updatedCustomer = await prisma.customer.update({
            where: { id: customerId },
            data: { avatar: avatarUrl }
        });

        const { password: _, ...customerData } = updatedCustomer;

        res.json({
            message: 'Avatar uploaded successfully',
            avatar: avatarUrl,
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

export const getBonusSummary = async (req, res, next) => {
    try {
        const customerId = req.customerId;
        const { transactionsLimit = 10 } = req.query;

        const parsedLimit = Math.min(Math.max(parseInt(transactionsLimit, 10) || 10, 1), 100);

        const orders = await prisma.order.findMany({
            where: { customerId },
            select: {
                id: true,
                orderNumber: true,
                totalAmount: true,
                status: true,
                deliveryType: true,
                createdAt: true,
                updatedAt: true,
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
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        const summary = buildBonusSummaryFromOrders(orders);

        res.json({
            ...summary,
            transactions: summary.transactions.slice(0, parsedLimit)
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
        if (!hasHouseNumber(address)) {
            return res.status(400).json({ error: 'Укажите улицу и номер дома' });
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

        if (address !== undefined && address !== null && String(address).trim() && !hasHouseNumber(address)) {
            return res.status(400).json({ error: 'Укажите улицу и номер дома' });
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

        const normalizedDeliveryType = deliveryType || 'delivery';

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

        const menuSourceRestaurantId = await getMenuSourceRestaurantId(restaurantId);
        if (!menuSourceRestaurantId) {
            return res.status(404).json({ error: 'Restaurant not found' });
        }

        const trustedPricing = await buildTrustedOrderItems({
            items,
            menuSourceRestaurantId,
            deliveryType: normalizedDeliveryType
        });

        if (!trustedPricing.ok) {
            return res.status(400).json({ error: trustedPricing.error || 'Invalid order payload' });
        }

        const { trustedItems, itemsSubtotal, dishIds } = trustedPricing;

        let normalizedDeliveryLatitude = null;
        let normalizedDeliveryLongitude = null;
        let resolvedDeliveryAddress = deliveryAddress || null;
        let assignedRestaurantId = null;
        let servingRestaurantId = restaurantId;
        let nearestServingPoint = null;

        if (normalizedDeliveryType === 'delivery') {
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

            if (!String(resolvedDeliveryAddress || '').trim() || !hasHouseNumber(resolvedDeliveryAddress)) {
                return res.status(400).json({ error: 'Укажите улицу и номер дома' });
            }

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
            nearestServingPoint = nearest;
            if (nearest.id !== restaurantId) {
                assignedRestaurantId = nearest.id;
            }
        }

        let servingRestaurantPricing = null;
        if (normalizedDeliveryType === 'delivery') {
            servingRestaurantPricing = nearestServingPoint || await prisma.restaurant.findUnique({
                where: { id: servingRestaurantId },
                select: {
                    minOrderAmount: true,
                    deliveryFee: true,
                    freeDeliveryThreshold: true
                }
            });

            if (servingRestaurantPricing?.minOrderAmount && itemsSubtotal < Number(servingRestaurantPricing.minOrderAmount)) {
                return res.status(400).json({ error: `Minimum order amount for delivery: ${servingRestaurantPricing.minOrderAmount}` });
            }
        }

        const deliveryFeeAmount = calculateDeliveryFee({
            deliveryType: normalizedDeliveryType,
            itemsSubtotal,
            restaurantPricing: servingRestaurantPricing
        });
        const orderTotalBeforeBonus = roundCurrency(itemsSubtotal + deliveryFeeAmount);

        const servingRestaurant = await prisma.restaurant.findUnique({
            where: { id: servingRestaurantId },
            select: { id: true, sharedMenuSourceRestaurantId: true }
        });

        const effectiveStopRestaurantIds = servingRestaurant?.sharedMenuSourceRestaurantId
            ? [servingRestaurant.sharedMenuSourceRestaurantId, servingRestaurantId]
            : [servingRestaurantId];

        const stoppedDishesRaw = await prisma.dishStop.findMany({
            where: {
                restaurantId: { in: effectiveStopRestaurantIds },
                isStopped: true,
                dishId: { in: dishIds }
            },
            select: {
                dishId: true,
                reason: true,
                restaurantId: true,
                dish: { select: { name: true } }
            }
        });

        const stoppedDishesMap = new Map();
        stoppedDishesRaw.forEach((stop) => {
            const existing = stoppedDishesMap.get(stop.dishId);
            const isLocalStop = stop.restaurantId === servingRestaurantId;

            if (!existing || isLocalStop) {
                stoppedDishesMap.set(stop.dishId, stop);
            }
        });

        const stoppedDishes = Array.from(stoppedDishesMap.values());

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

        const createOrderData = {
            orderNumber,
            restaurantId,
            assignedRestaurantId,
            customerId,
            customerName: normalizedCustomerName || 'Customer',
            customerPhone: normalizedCustomerPhone,
            customerEmail: customer.email,
            deliveryAddress: resolvedDeliveryAddress,
            deliveryLatitude: normalizedDeliveryLatitude,
            deliveryLongitude: normalizedDeliveryLongitude,
            notes: comment || null,
            deliveryType: normalizedDeliveryType,
            paymentMethod: paymentMethod || 'cash',
            tableNumber: tableNumber || null,
            customerAddressId: customerAddressId || null,
            items: {
                create: trustedItems
            }
        };

        const includeOrderRelations = {
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
        };

        const order = requestedBonusToSpend > 0
            ? await withSerializableRetry(() => prisma.$transaction(async (tx) => {
                await tx.$queryRaw`SELECT id FROM "Customer" WHERE id = ${customerId} FOR UPDATE`;

                const servingRestaurantBonusSettings = await tx.restaurant.findUnique({
                    where: { id: servingRestaurantId },
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
                const servingRestaurantBonusConfig = getEffectiveBonusConfig(servingRestaurantBonusSettings);

                if (!servingRestaurantBonusConfig.enabled) {
                    throw Object.assign(new Error('Bonus program is disabled for this restaurant'), { statusCode: 400 });
                }

                const availableBonusPoints = await getCustomerAvailableBonusPoints(customerId, tx);
                const maxByOrderTotal = Math.max(0, Math.floor(orderTotalBeforeBonus));
                const appliedBonusSpent = Math.min(requestedBonusToSpend, availableBonusPoints, maxByOrderTotal);

                if (appliedBonusSpent <= 0) {
                    throw Object.assign(new Error('No available bonuses to spend'), { statusCode: 400 });
                }

                const finalTotal = roundCurrency(Math.max(0, orderTotalBeforeBonus - appliedBonusSpent));

                return tx.order.create({
                    data: {
                        ...createOrderData,
                        totalAmount: finalTotal,
                        bonusSpent: appliedBonusSpent
                    },
                    include: includeOrderRelations
                });
            }, { isolationLevel: 'Serializable' }))
            : await prisma.order.create({
                data: {
                    ...createOrderData,
                    totalAmount: orderTotalBeforeBonus,
                    bonusSpent: 0
                },
                include: includeOrderRelations
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
        if (error?.statusCode === 400) {
            return res.status(400).json({ error: error.message });
        }

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
