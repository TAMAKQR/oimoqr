import rateLimit from 'express-rate-limit';

const isProduction = process.env.NODE_ENV === 'production';

export const rateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isProduction ? 100 : 1000, // give dev builds plenty of headroom
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => !isProduction, // disable the limiter outside production
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isProduction ? 5 : 100,
  message: 'Too many login attempts, please try again later.',
  skipSuccessfulRequests: true,
  skip: () => !isProduction,
});