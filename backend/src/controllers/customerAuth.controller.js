import { prisma } from '../config/prisma.js';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

/**
 * Регистрация нового клиента
 */
export const registerCustomer = async (req, res, next) => {
    try {
        const { phone, name, email, password, restaurantId } = req.body;

        // Проверка обязательных полей
        if (!phone || !password) {
            return res.status(400).json({ error: 'Phone and password are required' });
        }

        // Проверка существующего клиента
        const existingCustomer = await prisma.customer.findUnique({
            where: { phone }
        });

        if (existingCustomer) {
            return res.status(400).json({ error: 'Customer with this phone already exists' });
        }

        // Хешируем пароль
        const hashedPassword = await bcrypt.hash(password, 10);

        // Создаем клиента
        const customer = await prisma.customer.create({
            data: {
                phone,
                name: name || null,
                email: email || null,
                password: hashedPassword,
                registeredRestaurantId: restaurantId || null
            }
        });

        // Генерируем JWT токен
        const token = jwt.sign(
            { customerId: customer.id, phone: customer.phone },
            process.env.JWT_SECRET || 'your-secret-key',
            { expiresIn: '30d' }
        );

        // Убираем пароль из ответа
        const { password: _, ...customerData } = customer;

        res.status(201).json({
            message: 'Customer registered successfully',
            customer: customerData,
            token
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Вход клиента
 */
export const loginCustomer = async (req, res, next) => {
    try {
        const { phone, password, restaurantId } = req.body;

        if (!phone || !password) {
            return res.status(400).json({ error: 'Phone and password are required' });
        }

        console.info('[CUSTOMER_LOGIN_ATTEMPT]', { phone });

        // Поиск клиента по телефону
        const customer = await prisma.customer.findUnique({
            where: { phone }
        });

        if (!customer) {
            console.warn('[CUSTOMER_LOGIN_FAIL_NOT_FOUND]', { phone });
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Проверка пароля
        const isValidPassword = await bcrypt.compare(password, customer.password);

        if (!isValidPassword) {
            console.warn('[CUSTOMER_LOGIN_FAIL_BAD_PASSWORD]', { phone });
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Обновляем registeredRestaurantId, если прислали и ещё не сохранено
        if (restaurantId && !customer.registeredRestaurantId) {
            await prisma.customer.update({
                where: { id: customer.id },
                data: { registeredRestaurantId: restaurantId }
            });
        }

        // Генерируем JWT токен
        const token = jwt.sign(
            { customerId: customer.id, phone: customer.phone },
            process.env.JWT_SECRET || 'your-secret-key',
            { expiresIn: '30d' }
        );

        // Убираем пароль из ответа
        const { password: _, ...customerData } = customer;

        res.json({
            message: 'Login successful',
            customer: customerData,
            token
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Получить текущего клиента (по токену)
 */
export const getCurrentCustomer = async (req, res, next) => {
    try {
        const customerId = req.customerId; // Устанавливается в middleware

        const customer = await prisma.customer.findUnique({
            where: { id: customerId },
            include: {
                savedAddresses: true,
                favoriteDishes: {
                    include: {
                        dish: {
                            include: {
                                category: true
                            }
                        }
                    }
                }
            }
        });

        if (!customer) {
            return res.status(404).json({ error: 'Customer not found' });
        }

        // Убираем пароль из ответа
        const { password: _, ...customerData } = customer;

        res.json(customerData);
    } catch (error) {
        next(error);
    }
};
