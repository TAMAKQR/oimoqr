import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Config
import { config } from './config/env.js';

// Routes
import authRoutes from './routes/auth.routes.js';
import restaurantRoutes from './routes/restaurant.routes.js';
import categoryRoutes from './routes/category.routes.js';
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

// Middleware
import { errorHandler } from './middleware/errorHandler.js';
import { rateLimiter } from './middleware/rateLimiter.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5001; // Используем PORT из переменной окружения или 5001 по умолчанию

app.set('trust proxy', 1);

// Security middleware
app.use(helmet());

// Расширенное логирование для отладки CORS (до CORS middleware)
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

// CORS configuration
const allowedOrigins = ['https://oimoqr.com', 'https://www.oimoqr.com'];

const corsOptions = {
  origin: (origin, callback) => {
    console.log('CORS CHECK: origin:', origin);
    if (allowedOrigins.includes(origin) || !origin) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 600
};

app.use(cors(corsOptions));

// Явная обработка preflight-запросов OPTIONS (вдруг прокси/путь блокирует их)
app.options('*', cors(corsOptions));

// Фallback middleware: на всякий случай выставляем CORS заголовки для разрешённых origin
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && Array.isArray(allowedOrigins) && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,PATCH,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  }
  next();
});

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
app.use('/api', deliveryLocationsRoutes);
app.use('/api/restaurants', restaurantRoutes);
app.use('/api/restaurants', staffRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/dishes', dishRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/languages', languageRoutes);
app.use('/api/geolocation', geolocationRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/migration', migrationRoutes);

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
