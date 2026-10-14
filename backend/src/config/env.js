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

  // Finik Web SDK (optional until online tariff payments are enabled)
  finik: {
    apiKey: process.env.FINIK_API_KEY,
    privateKey: process.env.FINIK_PRIVATE_KEY,
    publicKey: process.env.FINIK_PUBLIC_KEY,
    accountId: process.env.FINIK_ACCOUNT_ID,
    mode: (process.env.FINIK_MODE || 'beta').toLowerCase(),
    webhookUrl: process.env.FINIK_WEBHOOK_URL,
    merchantName: process.env.FINIK_MERCHANT_NAME || 'OimoQR',
    paymentTtlMinutes: Number.parseInt(process.env.FINIK_PAYMENT_TTL_MINUTES || '30', 10),
    settlementGraceMinutes: Number.parseInt(process.env.FINIK_SETTLEMENT_GRACE_MINUTES || '1440', 10),
    webhookToleranceSeconds: Number.parseInt(process.env.FINIK_WEBHOOK_TOLERANCE_SECONDS || '300', 10),
    requestTimeoutMs: Number.parseInt(process.env.FINIK_REQUEST_TIMEOUT_MS || '10000', 10),
  },

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

if (!['beta', 'prod'].includes(config.finik.mode)) {
  throw new Error('❌ FINIK_MODE must be either beta or prod');
}

if (!Number.isInteger(config.finik.paymentTtlMinutes) || config.finik.paymentTtlMinutes < 5) {
  throw new Error('❌ FINIK_PAYMENT_TTL_MINUTES must be an integer >= 5');
}

if (!Number.isInteger(config.finik.settlementGraceMinutes) || config.finik.settlementGraceMinutes < 5) {
  throw new Error('❌ FINIK_SETTLEMENT_GRACE_MINUTES must be an integer >= 5');
}

if (!Number.isInteger(config.finik.webhookToleranceSeconds) || config.finik.webhookToleranceSeconds < 30) {
  throw new Error('❌ FINIK_WEBHOOK_TOLERANCE_SECONDS must be an integer >= 30');
}

if (!Number.isInteger(config.finik.requestTimeoutMs) || config.finik.requestTimeoutMs < 1000) {
  throw new Error('❌ FINIK_REQUEST_TIMEOUT_MS must be an integer >= 1000');
}

console.log('✅ Environment variables validated successfully');
