import { prisma } from '../config/prisma.js';
import bcrypt from 'bcryptjs';
import telegramService from '../services/telegram.service.js';

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
                        currency: true
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
            deliveryAddress
        } = req.body;

        if (!restaurantId || !items || !Array.isArray(items) || items.length === 0 || total === undefined) {
            return res.status(400).json({
                error: 'restaurantId, items (non-empty array), and total are required'
            });
        }

        // Получаем данные клиента
        const customer = await prisma.customer.findUnique({
            where: { id: customerId }
        });

        if (!customer) {
            return res.status(404).json({ error: 'Customer not found' });
        }

        // Генерируем номер заказа
        const timestamp = Date.now().toString().slice(-6);
        const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
        const orderNumber = `#${timestamp}${random}`;

        // Фильтруем товары
        const validItems = items.filter(item => item && item.id);
        const dishIds = validItems.map(item => item.id);

        // Проверка существования блюд
        const existingDishes = await prisma.dish.findMany({
            where: {
                id: { in: dishIds },
                restaurantId: restaurantId
            },
            select: { id: true }
        });

        if (existingDishes.length !== dishIds.length) {
            const notFoundIds = dishIds.filter(id => !existingDishes.some(d => d.id === id));
            return res.status(400).json({ error: `One or more dishes not found: ${notFoundIds.join(', ')}` });
        }

        // Создаем заказ
        const order = await prisma.order.create({
            data: {
                orderNumber,
                restaurantId,
                customerId,
                totalAmount: parseFloat(total),
                customerName: customer.name || 'Клиент',
                customerPhone: customer.phone,
                customerEmail: customer.email,
                deliveryAddress: deliveryAddress || null,
                notes: comment || null,
                deliveryType: deliveryType || 'delivery',
                paymentMethod: paymentMethod || 'cash',
                customerAddressId: customerAddressId || null,
                items: {
                    create: validItems.map(item => ({
                        dishId: item.id,
                        quantity: parseInt(item.quantity, 10),
                        price: item.price ?? 0,
                        selectedModifiers: item.selectedModifiers ? JSON.stringify(item.selectedModifiers) : undefined
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
                }
            }
        });

        // 🔔 Отправляем уведомление в Telegram
        if (order.restaurant?.telegramGroupId) {
            telegramService.sendNewOrderNotification(order, order.restaurant).catch(err => {
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