const crypto = require('crypto');

/**
 * Custom CSRF protection middleware.
 * Assigns a unique csrfToken to each session and verifies it on mutating requests (POST/PUT/PATCH/DELETE).
 */
function csrfMiddleware(req, res, next) {
  // Ensure session has a CSRF token
  if (req.session && !req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(32).toString('hex');
  }

  // Safe HTTP methods do not mutate data
  const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
  if (safeMethods.includes(req.method)) {
    return next();
  }

  // Exempt public auth endpoints like /api/auth/login if session is not established yet
  if (req.path === '/api/auth/login') {
    return next();
  }

  // Mutating methods must supply valid CSRF token in header or body
  const clientToken = req.headers['x-csrf-token'] || req.body?._csrf;
  const sessionToken = req.session?.csrfToken;

  if (!sessionToken || !clientToken || clientToken !== sessionToken) {
    return res.status(403).json({
      success: false,
      error: 'Invalid or missing CSRF token. Please refresh the page and try again.'
    });
  }

  next();
}

module.exports = csrfMiddleware;
