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
 * WhatsApp авторизация - отправка кода
 */
import whatsappService from '../services/whatsappService.js';

// Временное хранилище кодов (в продакшене лучше использовать Redis)
const verificationCodes = new Map();

// Очистка старых кодов каждые 10 минут
setInterval(() => {
    const now = Date.now();
    for (const [phone, data] of verificationCodes.entries()) {
        if (now - data.timestamp > 5 * 60 * 1000) { // 5 минут
            verificationCodes.delete(phone);
        }
    }
}, 10 * 60 * 1000);

export const sendWhatsAppCode = async (req, res, next) => {
    try {
        const { phoneNumber } = req.body;

        console.log('📱 Sending WhatsApp verification code to:', phoneNumber);

        if (!phoneNumber) {
            return res.status(400).json({ error: 'Phone number is required' });
        }

        // Валидация номера
        if (!whatsappService.isValidPhoneNumber(phoneNumber)) {
            return res.status(400).json({ error: 'Invalid phone number format' });
        }

        // Форматируем номер
        const formattedPhone = whatsappService.formatPhoneNumber(phoneNumber);

        // Проверяем не отправляли ли код недавно (защита от спама)
        const existingCode = verificationCodes.get(formattedPhone);
        if (existingCode && Date.now() - existingCode.timestamp < 60 * 1000) {
            return res.status(429).json({
                error: 'Code already sent. Please wait 1 minute before requesting again.',
                retryAfter: 60 - Math.floor((Date.now() - existingCode.timestamp) / 1000)
            });
        }

        // Генерируем код
        const code = whatsappService.generateCode();

        // Сохраняем код
        verificationCodes.set(formattedPhone, {
            code,
            timestamp: Date.now(),
            attempts: 0
        });

        // Отправляем код через WhatsApp
        try {
            await whatsappService.sendVerificationCode(formattedPhone, code);

            console.log(`✅ Verification code sent to ${formattedPhone}`);

            res.json({
                success: true,
                message: 'Verification code sent via WhatsApp',
                phoneNumber: formattedPhone
            });
        } catch (error) {
            console.error('❌ Failed to send WhatsApp:', error);
            // Если WhatsApp не работает, показываем код в консоли для разработки
            if (process.env.NODE_ENV === 'development') {
                console.log(`🔑 DEV MODE - Verification code for ${formattedPhone}: ${code}`);
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

        console.log('🔐 Verifying WhatsApp code for:', phoneNumber);

        if (!phoneNumber || !code) {
            return res.status(400).json({ error: 'Phone number and code are required' });
        }

        const formattedPhone = whatsappService.formatPhoneNumber(phoneNumber);

        // Проверяем код
        const storedData = verificationCodes.get(formattedPhone);

        if (!storedData) {
            return res.status(400).json({ error: 'Verification code expired or not found' });
        }

        // Проверяем количество попыток
        if (storedData.attempts >= 3) {
            verificationCodes.delete(formattedPhone);
            return res.status(429).json({ error: 'Too many failed attempts. Please request a new code.' });
        }

        // Проверяем код
        if (storedData.code !== code) {
            storedData.attempts++;
            return res.status(400).json({
                error: 'Invalid verification code',
                attemptsLeft: 3 - storedData.attempts
            });
        }

        // Код верный, удаляем из хранилища
        verificationCodes.delete(formattedPhone);

        // Ищем или создаем клиента
        let customer = await prisma.customer.findUnique({
            where: { phone: formattedPhone }
        });

        if (!customer) {
            // Создаем нового клиента без пароля (вход только через WhatsApp)
            customer = await prisma.customer.create({
                data: {
                    phone: formattedPhone,
                    name: `Клиент ${formattedPhone.slice(-4)}`,
                    password: '', // Пустой пароль для WhatsApp авторизации
                    registeredRestaurantId: restaurantId || null
                }
            });
            console.log(`✅ New customer created via WhatsApp: ${customer.id}`);
        } else {
            // Обновляем ресторан если нужно
            if (restaurantId && !customer.registeredRestaurantId) {
                await prisma.customer.update({
                    where: { id: customer.id },
                    data: { registeredRestaurantId: restaurantId }
                });
            }
            console.log(`✅ Existing customer logged in via WhatsApp: ${customer.id}`);
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
