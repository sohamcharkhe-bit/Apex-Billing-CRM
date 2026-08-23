const config = require('../config/config');

/**
 * Middleware ensuring user is logged in with an active session.
 * Enforces inactivity timeout.
 */
function requireLogin(req, res, next) {
  if (!req.session || !req.session.user) {
    if (req.xhr || req.headers.accept?.includes('application/json') || req.path.startsWith('/api/')) {
      return res.status(401).json({ success: false, error: 'Authentication required. Please log in.' });
    }
    return res.redirect('/login.html');
  }

  // Check inactivity timeout
  const now = Date.now();
  const timeoutMs = (config.sessionTimeoutMinutes || 60) * 60 * 1000;
  if (req.session.lastActivity && (now - req.session.lastActivity > timeoutMs)) {
    req.session.destroy(() => {
      res.clearCookie('connect.sid');
      if (req.xhr || req.headers.accept?.includes('application/json') || req.path.startsWith('/api/')) {
        return res.status(401).json({ success: false, error: 'Session expired due to inactivity. Please log in again.' });
      }
      return res.redirect('/login.html?expired=1');
    });
    return;
  }

  req.session.lastActivity = now;
  next();
}

module.exports = requireLogin;
