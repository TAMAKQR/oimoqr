import jwt from 'jsonwebtoken';

/**
 * Middleware для аутентификации клиентов
 * Проверяет JWT токен и добавляет customerId в req
 */
export const authenticateCustomer = (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const token = authHeader.substring(7); // Remove 'Bearer ' prefix

        if (!process.env.JWT_SECRET) {
            console.error('CRITICAL: JWT_SECRET environment variable is not set!');
            return res.status(500).json({ error: 'Server configuration error' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Проверяем, что это токен клиента
        if (!decoded.customerId) {
            return res.status(401).json({ error: 'Invalid customer token' });
        }

        req.customerId = decoded.customerId;
        req.customerPhone = decoded.phone;

        next();
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'Token expired' });
        }
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ error: 'Invalid token' });
        }
        return res.status(500).json({ error: 'Authentication failed' });
    }
};

/**
 * Опциональная аутентификация клиента
 * Не требует токен, но если он есть - проверяет
 */
export const optionalCustomerAuth = (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return next();
        }

        const token = authHeader.substring(7);

        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            if (decoded.customerId) {
                req.customerId = decoded.customerId;
                req.customerPhone = decoded.phone;
            }
        } catch (error) {
            // Игнорируем ошибки для опциональной аутентификации
        }

        next();
    } catch (error) {
        next();
    }
};
