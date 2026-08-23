/**
 * Middleware ensuring user has the required role (e.g. 'admin').
 */
function requireRole(requiredRole) {
  return (req, res, next) => {
    if (!req.session || !req.session.user) {
      return res.status(401).json({ success: false, error: 'Authentication required.' });
    }

    if (req.session.user.role !== requiredRole) {
      return res.status(403).json({ 
        success: false, 
        error: `Access denied. Requires '${requiredRole}' privileges.` 
      });
    }

    next();
  };
}

module.exports = requireRole;
