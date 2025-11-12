export const errorHandler = (err, req, res, next) => {
  console.error('Error:', err);
  console.error('Stack:', err.stack);
  console.error('Request path:', req.path);
  console.error('Request body:', req.body);

  // Prisma errors
  if (err.code === 'P2002') {
    return res.status(400).json({
      error: 'Duplicate entry',
      field: err.meta?.target?.[0] || 'unknown'
    });
  }

  if (err.code === 'P2025') {
    return res.status(404).json({
      error: 'Record not found'
    });
  }

  // Validation errors
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: 'Validation failed',
      details: err.errors
    });
  }

  // Default error
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error'
  });
};