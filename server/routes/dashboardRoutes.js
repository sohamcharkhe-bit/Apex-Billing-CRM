const express = require('express');
const requireLogin = require('../middleware/requireLogin');
const ReportModel = require('../models/reportModel');
const InvoiceModel = require('../models/invoiceModel');
const PaymentModel = require('../models/paymentModel');

const router = express.Router();
router.use(requireLogin);

// GET /api/dashboard/stats
router.get('/stats', (req, res) => {
  const stats = ReportModel.getDashboardStats();
  res.json({ success: true, stats });
});

// GET /api/dashboard/trend
router.get('/trend', (req, res) => {
  const months = parseInt(req.query.months || '6', 10);
  const trend = ReportModel.getRevenueTrend(months);
  res.json({ success: true, trend });
});

// GET /api/dashboard/recent
router.get('/recent', (req, res) => {
  const recentInvoices = InvoiceModel.getAll({ page: 1, limit: 5 });
  const recentPayments = PaymentModel.getRecent(5);
  res.json({
    success: true,
    recentInvoices,
    recentPayments
  });
});

module.exports = router;
