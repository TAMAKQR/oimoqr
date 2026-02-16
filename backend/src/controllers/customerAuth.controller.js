import { prisma } from '../config/prisma.js';
import bcrypt from 'bcryptjs';
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

/**
 * SMS авторизация - отправка кода через Twilio Verify
 */
import whatsappService from '../services/whatsappService.js';

export const sendWhatsAppCode = async (req, res, next) => {
    try {
        const { phoneNumber } = req.body;

        console.log('📱 Sending SMS verification code to:', phoneNumber);

        if (!phoneNumber) {
            return res.status(400).json({ error: 'Phone number is required' });
        }

        // Валидация номера
        if (!whatsappService.isValidPhoneNumber(phoneNumber)) {
            return res.status(400).json({ error: 'Invalid phone number format' });
        }

        // Форматируем номер
        const formattedPhone = whatsappService.formatPhoneNumber(phoneNumber);

        // Отправляем код через Twilio Verify (SMS)
        try {
            const result = await whatsappService.sendVerificationCode(formattedPhone);

            console.log(`✅ Verification code sent to ${formattedPhone}`);

            res.json({
                success: true,
                message: 'Verification code sent via SMS',
                phoneNumber: formattedPhone,
                channel: result.channel || 'sms'
            });
        } catch (error) {
            console.error('❌ Failed to send verification:', error);
            // В dev-режиме показываем ошибку подробнее
            if (process.env.NODE_ENV === 'development') {
                console.log(`⚠️ DEV MODE - SMS verification failed: ${error.message}`);
            }
            res.status(500).json({
                error: 'Failed to send verification code',
                details: error.message
            });
        }
    } catch (error) {
        next(error);
    }
};

export const verifyWhatsAppCode = async (req, res, next) => {
    try {
        const { phoneNumber, code, restaurantId } = req.body;

        console.log('🔐 Verifying SMS code for:', phoneNumber);

        if (!phoneNumber || !code) {
            return res.status(400).json({ error: 'Phone number and code are required' });
        }

        const formattedPhone = whatsappService.formatPhoneNumber(phoneNumber);

        // Проверяем код через Twilio Verify
        const verifyResult = await whatsappService.checkVerificationCode(formattedPhone, code);

        if (!verifyResult.success) {
            return res.status(400).json({
                error: 'Invalid verification code',
                status: verifyResult.status
            });
        }

        // Ищем или создаем клиента
        let customer = await prisma.customer.findUnique({
            where: { phone: formattedPhone }
        });

        if (!customer) {
            // Создаем нового клиента без пароля (вход только через SMS)
            customer = await prisma.customer.create({
                data: {
                    phone: formattedPhone,
                    name: `Клиент ${formattedPhone.slice(-4)}`,
                    password: '', // Пустой пароль для SMS авторизации
                    registeredRestaurantId: restaurantId || null
                }
            });
            console.log(`✅ New customer created via SMS: ${customer.id}`);
        } else {
            // Обновляем ресторан если нужно
            if (restaurantId && !customer.registeredRestaurantId) {
                await prisma.customer.update({
                    where: { id: customer.id },
                    data: { registeredRestaurantId: restaurantId }
                });
            }
            console.log(`✅ Existing customer logged in via SMS: ${customer.id}`);
        }

        // Генерируем JWT токен
        const token = jwt.sign(
            {
                customerId: customer.id,
                phone: customer.phone,
                type: 'customer'
            },
            process.env.JWT_SECRET || 'your-secret-key',
            { expiresIn: '30d' }
        );

        // Убираем пароль из ответа
        const { password: _, ...customerData } = customer;

        res.json({
            success: true,
            message: 'Phone number verified successfully',
            token,
            customer: customerData
        });

    } catch (error) {
        next(error);
    }
};
