import rateLimit from 'express-rate-limit';

const isProduction = process.env.NODE_ENV === 'production';

export const rateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isProduction ? 100 : 1000, // give dev builds plenty of headroom
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    if (!isProduction) return true;

    const path = req.originalUrl || req.path || '';
    if (path.includes('/api/auth/login') || path === '/auth/login') {
      return true;
    }

    return false;
  },
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isProduction ? 5 : 100,
  message: 'Too many login attempts, please try again later.',
  keyGenerator: (req) => {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const ip = req.ip || req.headers['x-forwarded-for'] || 'unknown';
    return email ? `${ip}:${email}` : String(ip);
  },
  skipSuccessfulRequests: true,
  skip: () => !isProduction,
});