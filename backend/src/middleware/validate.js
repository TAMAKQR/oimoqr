import { validationResult } from 'express-validator';

/**
 * Middleware для обработки результатов валидации express-validator
 */
export const validate = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const formattedErrors = errors.array().map(err => ({
      field: err.path || err.param,
      message: err.msg
    }));
    
    return res.status(400).json({
      error: 'Validation failed',
      details: formattedErrors
    });
  }
  
  next();
};