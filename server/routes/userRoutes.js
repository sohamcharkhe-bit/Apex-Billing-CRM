const express = require('express');
const requireLogin = require('../middleware/requireLogin');
const requireRole = require('../middleware/requireRole');
const UserModel = require('../models/userModel');
const { isValidEmail, validatePersonName } = require('../utils/validators');

const router = express.Router();
// Enforce admin-only access for entire user management group
router.use(requireLogin);
router.use(requireRole('admin'));

// GET /api/users
router.get('/', (req, res) => {
  const users = UserModel.getAll();
  res.json({ success: true, users });
});

// POST /api/users (FIX 1: Validate name regex)
router.post('/', (req, res) => {
  const { name, email, password, role, status } = req.body;

  if (!name || !String(name).trim()) {
    return res.status(400).json({ success: false, error: 'Full name is required.' });
  }

  if (!validatePersonName(name)) {
    return res.status(400).json({ 
      success: false, 
      error: 'Full name can only contain letters, spaces, apostrophes, hyphens, and periods (no numbers).' 
    });
  }

  if (!email || !isValidEmail(email)) {
    return res.status(400).json({ success: false, error: 'A valid email address is required.' });
  }

  if (!password || String(password).length < 6) {
    return res.status(400).json({ success: false, error: 'Password must be at least 6 characters.' });
  }

  if (!['admin', 'staff'].includes(role)) {
    return res.status(400).json({ success: false, error: "Role must be 'admin' or 'staff'." });
  }

  const existing = UserModel.findByEmail(email);
  if (existing) {
    return res.status(400).json({ success: false, error: 'A user with this email already exists.' });
  }

  const newUser = UserModel.createUser({
    name,
    email,
    password,
    role,
    status: status === 'inactive' ? 'inactive' : 'active'
  });

  res.status(201).json({
    success: true,
    message: `User ${newUser.name} created successfully.`,
    user: newUser
  });
});

// PUT /api/users/:id (FIX 1: Validate name regex)
router.put('/:id', (req, res) => {
  const user = UserModel.findById(req.params.id);
  if (!user) {
    return res.status(404).json({ success: false, error: 'User not found.' });
  }

  const { name, role, status, password } = req.body;

  if (!name || !String(name).trim()) {
    return res.status(400).json({ success: false, error: 'Full name is required.' });
  }

  if (!validatePersonName(name)) {
    return res.status(400).json({ 
      success: false, 
      error: 'Full name can only contain letters, spaces, apostrophes, hyphens, and periods (no numbers).' 
    });
  }

  if (!['admin', 'staff'].includes(role)) {
    return res.status(400).json({ success: false, error: "Role must be 'admin' or 'staff'." });
  }

  if (user.id === req.session.user.id && status === 'inactive') {
    return res.status(400).json({ success: false, error: 'You cannot deactivate your own admin account.' });
  }

  const updated = UserModel.updateUser(req.params.id, {
    name,
    role,
    status: status === 'inactive' ? 'inactive' : 'active',
    password
  });

  res.json({
    success: true,
    message: 'User updated successfully.',
    user: updated
  });
});

// POST /api/users/:id/toggle-status
router.post('/:id/toggle-status', (req, res) => {
  const user = UserModel.findById(req.params.id);
  if (!user) {
    return res.status(404).json({ success: false, error: 'User not found.' });
  }

  if (user.id === req.session.user.id) {
    return res.status(400).json({ success: false, error: 'You cannot deactivate your own admin account.' });
  }

  const updated = UserModel.toggleStatus(req.params.id);
  res.json({
    success: true,
    message: `User status changed to ${updated.status}.`,
    user: updated
  });
});

module.exports = router;
