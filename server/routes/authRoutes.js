const express = require('express');
const crypto = require('crypto');
const UserModel = require('../models/userModel');
const requireLogin = require('../middleware/requireLogin');

const router = express.Router();

// GET /api/auth/csrf-token
router.get('/csrf-token', (req, res) => {
  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(32).toString('hex');
  }
  res.json({ success: true, csrfToken: req.session.csrfToken });
});

// GET /api/auth/me
router.get('/me', (req, res) => {
  if (!req.session || !req.session.user) {
    return res.status(401).json({ success: false, user: null });
  }
  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(32).toString('hex');
  }
  res.json({
    success: true,
    user: req.session.user,
    csrfToken: req.session.csrfToken
  });
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ success: false, error: 'Email and password are required.' });
  }

  const user = UserModel.findByEmail(email);
  if (!user) {
    return res.status(401).json({ success: false, error: 'Invalid email or password.' });
  }

  if (user.status !== 'active') {
    return res.status(403).json({ success: false, error: 'Your account is deactivated. Please contact an administrator.' });
  }

  const passwordValid = UserModel.verifyPassword(password, user.password_hash);
  if (!passwordValid) {
    return res.status(401).json({ success: false, error: 'Invalid email or password.' });
  }

  // Prevent session fixation by regenerating session on login
  req.session.regenerate((err) => {
    if (err) {
      return res.status(500).json({ success: false, error: 'Session initialization error.' });
    }

    req.session.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role
    };
    req.session.lastActivity = Date.now();
    req.session.csrfToken = crypto.randomBytes(32).toString('hex');

    res.json({
      success: true,
      message: 'Login successful.',
      user: req.session.user,
      csrfToken: req.session.csrfToken
    });
  });
});

// POST /api/auth/logout
router.post('/logout', requireLogin, (req, res) => {
  req.session.destroy((err) => {
    res.clearCookie('connect.sid');
    res.json({ success: true, message: 'Logged out successfully.' });
  });
});

module.exports = router;
