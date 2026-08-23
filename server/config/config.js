const path = require('path');
require('dotenv').config();

module.exports = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  sessionSecret: process.env.SESSION_SECRET || 'apex_billing_fallback_secret_change_me',
  dbPath: process.env.DB_PATH || path.join(__dirname, '../db/apex_billing.sqlite'),
  brand: {
    name: 'Apex Billing',
    tagline: 'Billing & Invoice Management System',
    currencySymbol: '₹',
    defaultTaxRate: 18,
    company: {
      name: 'Apex Billing Solutions Ltd.',
      address: 'Plot 42, Cyber City, Sector 29, Gurugram, Haryana 122002',
      phone: '+91 98765 43210',
      email: 'billing@apexbilling.com',
      gstin: '06AAAAA0000A1Z5'
    }
  },
  sessionTimeoutMinutes: 60 // 1 hour inactivity timeout
};
