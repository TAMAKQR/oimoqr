import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Config
import { config } from './config/env.js';

// Routes
import authRoutes from './routes/auth.routes.js';
import restaurantRoutes from './routes/restaurant.routes.js';
import categoryRoutes from './routes/category.routes.js';
import categoryGroupRoutes from './routes/categoryGroup.routes.js';
import dishRoutes from './routes/dish.routes.js';
import adminRoutes from './routes/admin.routes.js';
import ordersRoutes from './routes/orders.routes.js';
import deliveryLocationsRoutes from './routes/delivery-locations.routes.js';
import staffRoutes from './routes/staff.routes.js';
import publicRoutes from './routes/public.routes.js';
import languageRoutes from './routes/language.routes.js';
import geolocationRoutes from './routes/geolocation.routes.js';
import analyticsRoutes from './routes/analytics.routes.js';
import pricingRoutes from './routes/pricing.routes.js';
import migrationRoutes from './routes/migration.routes.js';
import productRoutes from './routes/product.routes.js';
import customerRoutes from './routes/customer.routes.js';
import telegramRoutes from './routes/telegram.routes.js';
import modifierTemplateRoutes from './routes/modifierTemplate.routes.js';

// Middleware
import { errorHandler } from './middleware/errorHandler.js';
import { rateLimiter } from './middleware/rateLimiter.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5001; // Используем PORT из переменной окружения или 5001 по умолчанию

app.set('trust proxy', 1);

// Security middleware (allow images to be fetched cross-origin for customer menu)
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));

// Расширенное логирование для отладки CORS + timing (только DEV)
if (process.env.NODE_ENV !== 'production') {
  app.use((req, res, next) => {
    console.log(`CORS DEBUG: method=${req.method}, origin=${req.headers.origin}, url=${req.originalUrl}`);
    console.log('CORS DEBUG: headers:', req.headers);
    next();
  });

  // Timing middleware — логируем время выполнения каждого запроса
  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      const ms = Date.now() - start;
      console.log(`TIMING: ${req.method} ${req.originalUrl} ${res.statusCode} ${ms}ms`);
    });
    next();
  });
}

// ✅ ОПТИМИЗАЦИЯ: HTTP Кэширование для статических данных
app.use((req, res, next) => {
  // Кэшируем GET запросы к API ресторанов, категорий и блюд ТОЛЬКО для публичных запросов
  // НЕ кэшируем запросы с авторизацией (админка)
  const isAuthenticated = req.headers.authorization;

  // Для публичного меню ресторана всегда отдаем свежие данные (стоп-лист/доступность должны обновляться мгновенно)
  if (req.method === 'GET' && !isAuthenticated && req.url.startsWith('/api/restaurants/')) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  } else

    if (req.method === 'GET' && !isAuthenticated && (
      req.url.startsWith('/api/categories') ||
      req.url.startsWith('/api/dishes')
    )) {
      // Кэшируем на 5 минут (300 секунд) только для публичных запросов
      res.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=600');
    } else if (req.method === 'GET' && isAuthenticated) {
      // Для авторизованных запросов (админка) - НЕ кэшируем
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    }

  // ✅ ИСПРАВЛЕНИЕ: Кэшируем uploads на 1 час (не 1 день) для возможности обновления
  // Добавляем must-revalidate для проверки актуальности при обновлении
  if (req.url.startsWith('/uploads')) {
    res.setHeader('Cache-Control', 'public, max-age=3600, must-revalidate');
    // Добавляем ETag для более умного кэширования
    res.setHeader('Vary', 'Accept-Encoding');
  }

  next();
});

// CORS configuration - УЛУЧШЕННАЯ ВЕРСИЯ
const allowedExactOrigins = new Set([
  'https://oimoqr.com',
  'https://www.oimoqr.com',
  'https://oimoqr-frontend.vercel.app',
  'https://oimoqr-frontend-git-main-dastans-projects-e0330c7f.vercel.app',
  'http://localhost:5173',
  'http://localhost:5174'
]);

const isAllowedOrigin = (origin) => {
  if (allowedExactOrigins.has(origin)) return true;

  // Allow all oimoqr subdomains (e.g. backend.oimoqr.com, foo.oimoqr.com)
  if (/^https:\/\/([a-z0-9-]+\.)*oimoqr\.com$/i.test(origin)) return true;

  // Allow Vercel preview/branch deploys
  if (/^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(origin)) return true;

  return false;
};

// ✅ Упрощенная и более надежная CORS конфигурация для production
const corsOptions = {
  origin: (origin, callback) => {
    // Логируем для отладки
    if (process.env.NODE_ENV !== 'production') {
      console.log('🔒 CORS CHECK: origin =', origin);
    }

    // Server-to-server / health checks / curl / Postman
    if (!origin) return callback(null, true);

    if (isAllowedOrigin(origin)) {
      return callback(null, true);
    }

    console.warn('⚠️ CORS blocked origin:', origin);
    return callback(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Content-Range', 'X-Content-Range'],
  maxAge: 86400, // 24 часа для preflight кэша
  preflightContinue: false,
  optionsSuccessStatus: 204
};

app.use(cors(corsOptions));

// Явная обработка preflight-запросов OPTIONS
app.options('*', cors(corsOptions));

// ✅ ОПТИМИЗАЦИЯ: Gzip/Brotli компрессия ответов (уменьшение на 70-80%)
app.use(compression({
  filter: (req, res) => {
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  },
  level: 6 // Баланс между скоростью и степенью сжатия
}));

// Rate limiting
app.use('/api/', rateLimiter);

// Body parsing middleware - увеличен лимит для загрузки изображений
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Static files (uploads)
app.use('/uploads', express.static(join(__dirname, '../uploads')));

// API Routes
app.use('/api', publicRoutes); // Public routes first
app.use('/api', pricingRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api', deliveryLocationsRoutes);
app.use('/api/restaurants', restaurantRoutes);
app.use('/api/restaurants', categoryGroupRoutes);
app.use('/api/restaurants', staffRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/dishes', dishRoutes);
app.use('/api/products', productRoutes);
app.use('/api/modifiers', modifierTemplateRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/languages', languageRoutes);
app.use('/api/geolocation', geolocationRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/migration', migrationRoutes);
app.use('/api', telegramRoutes);

// Health check route
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handling middleware
app.use(errorHandler);

// ✅ Single start command
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📝 Environment: ${config.nodeEnv}`);
  console.log(`🌐 Frontend URL: ${config.frontendUrl}`);
});

export default app;
