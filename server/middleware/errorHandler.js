const config = require('../config/config');

/**
 * Centralized Express Error Handling Middleware.
 */
function errorHandler(err, req, res, next) {
  // Safe logging on server console
  console.error('[Server Error]', {
    message: err.message,
    stack: config.env === 'development' ? err.stack : undefined,
    path: req.path,
    method: req.method,
    ip: req.ip
  });

  const statusCode = err.status || err.statusCode || 500;
  const isDev = config.env === 'development';

  const response = {
    success: false,
    error: isDev ? (err.message || 'An unexpected error occurred.') : 'An internal server error occurred. Please contact support.'
  };

  if (isDev && err.stack) {
    response.stack = err.stack;
  }

  res.status(statusCode).json(response);
}

module.exports = errorHandler;
