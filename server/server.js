const express = require('express');
const session = require('express-session');
const path = require('path');
const morgan = require('morgan');
const config = require('./config/config');

// Initialize database
const db = require('./db/database');
const autoSeedIfEmpty = require('./db/autoSeed');
autoSeedIfEmpty(db);

// Middlewares
const cors = require('cors');
const csrfMiddleware = require('./middleware/csrf');
const errorHandler = require('./middleware/errorHandler');

// Route handlers
const authRoutes = require('./routes/authRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const productRoutes = require('./routes/productRoutes');
const invoiceRoutes = require('./routes/invoiceRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const reportRoutes = require('./routes/reportRoutes');
const userRoutes = require('./routes/userRoutes');

const app = express();

// Trust reverse proxy (Required for Render, Heroku, AWS load balancers to handle HTTPS cookies)
app.set('trust proxy', 1);

// Enable Cross-Origin Resource Sharing for Netlify, custom domains, and local dev
app.use(cors({
  origin: (origin, callback) => {
    callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token', 'Accept']
}));

// Request logging (sanitized, no credential logging)
if (config.env !== 'test') {
  app.use(morgan(':method :url :status :response-time ms'));
}

// Body parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session configuration (supports same-origin, Netlify proxy, and cross-origin)
const isProduction = config.env === 'production';
app.use(session({
  secret: config.sessionSecret,
  resave: false,
  saveUninitialized: false,
  proxy: true, // Tell express-session to trust reverse proxies (Render / Netlify)
  cookie: {
    httpOnly: true,
    sameSite: isProduction ? 'none' : 'lax',
    secure: isProduction ? true : 'auto',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// CSRF Protection
app.use(csrfMiddleware);

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/products', productRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/users', userRoutes);

// Brand config endpoint (safe public metadata)
app.get('/api/config', (req, res) => {
  res.json({
    success: true,
    brand: config.brand
  });
});

// Serve static frontend assets
app.use(express.static(path.join(__dirname, '../public')));

// Root redirect
app.get('/', (req, res) => {
  if (req.session && req.session.user) {
    res.redirect('/dashboard.html');
  } else {
    res.redirect('/login.html');
  }
});

// 404 handler for API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({ success: false, error: 'Endpoint not found.' });
});

// Centralized error handler
app.use(errorHandler);

// Start server if not running in test runner
if (require.main === module) {
  const PORT = config.port;
  app.listen(PORT, () => {
    let userCount = 0;
    try {
      const row = db.prepare('SELECT COUNT(*) as count FROM users').get();
      userCount = row ? row.count : 0;
    } catch (e) {
      userCount = 'Error checking';
    }

    console.log(`=============================================`);
    console.log(`  ${config.brand.name} Server running on http://localhost:${PORT}`);
    console.log(`  Environment: ${config.env}`);
    console.log(`  Database: ${config.dbPath}`);
    console.log(`  [Startup Diagnostic] Registered Users in DB: ${userCount}`);
    console.log(`=============================================`);
  });
}

module.exports = app;
