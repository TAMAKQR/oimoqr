import dotenv from 'dotenv';

// Загружаем переменные окружения
dotenv.config({ path: '.env.local' });
dotenv.config();

// Список обязательных переменных
const requiredEnvVars = ['JWT_SECRET', 'DATABASE_URL'];

// Проверка наличия обязательных переменных
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(`❌ Missing required environment variable: ${envVar}`);
  }
}

// Экспорт конфигурации
export const config = {
  port: parseInt(process.env.PORT) || 5001,
  jwtSecret: process.env.JWT_SECRET,
  databaseUrl: process.env.DATABASE_URL,
  nodeEnv: process.env.NODE_ENV || 'development',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',

  // Cloudinary (опционально)
  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    apiKey: process.env.CLOUDINARY_API_KEY,
    apiSecret: process.env.CLOUDINARY_API_SECRET,
  },

  // Email (опционально)
  email: {
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT) || 587,
    user: process.env.EMAIL_USER,
    password: process.env.EMAIL_PASSWORD,
    from: process.env.EMAIL_FROM,
  },
};

// Валидация числовых значений
if (isNaN(config.port)) {
  throw new Error('❌ PORT must be a valid number');
}

console.log('✅ Environment variables validated successfully');
