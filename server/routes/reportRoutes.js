const express = require('express');
const requireLogin = require('../middleware/requireLogin');
const ReportModel = require('../models/reportModel');
const { validateReportDateRange } = require('../utils/validators');

const router = express.Router();
router.use(requireLogin);

function escapeCsvCell(val) {
  if (val === null || val === undefined) return '""';
  const str = String(val).replace(/"/g, '""');
  return `"${str}"`;
}

// GET /api/reports/revenue (FIX 3: Enforce reporting date range validation)
router.get('/revenue', (req, res) => {
  const { startDate, endDate } = req.query;
  const dateCheck = validateReportDateRange(startDate, endDate);
  if (!dateCheck.valid) {
    return res.status(400).json({ success: false, errors: dateCheck.errors, error: dateCheck.errors.join(' ') });
  }

  const data = ReportModel.getRevenueReport({ startDate, endDate });
  res.json({ success: true, data });
});

// GET /api/reports/revenue/csv (FIX 3: Enforce reporting date range validation)
router.get('/revenue/csv', (req, res) => {
  const { startDate, endDate } = req.query;
  const dateCheck = validateReportDateRange(startDate, endDate);
  if (!dateCheck.valid) {
    return res.status(400).json({ success: false, errors: dateCheck.errors, error: dateCheck.errors.join(' ') });
  }

  const data = ReportModel.getRevenueReport({ startDate, endDate });

  const headers = ['Payment Date', 'Invoice Number', 'Customer Name', 'Company', 'Payment Method', 'Amount (INR)', 'Reference Note', 'Recorded By'];
  const rows = data.payments.map(p => [
    escapeCsvCell(p.payment_date),
    escapeCsvCell(p.invoice_number),
    escapeCsvCell(p.customer_name),
    escapeCsvCell(p.company || ''),
    escapeCsvCell(p.payment_method),
    escapeCsvCell(p.amount),
    escapeCsvCell(p.reference_note || ''),
    escapeCsvCell(p.recorded_by_name || '')
  ].join(','));

  const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="ApexBilling-Revenue-Report.csv"');
  res.send(csvContent);
});

// GET /api/reports/outstanding
router.get('/outstanding', (req, res) => {
  const data = ReportModel.getOutstandingReport();
  res.json({ success: true, data });
});

// GET /api/reports/outstanding/csv
router.get('/outstanding/csv', (req, res) => {
  const data = ReportModel.getOutstandingReport();

  const headers = ['Invoice Number', 'Customer Name', 'Company', 'Issue Date', 'Due Date', 'Status', 'Grand Total (INR)', 'Paid Amount (INR)', 'Remaining Balance (INR)', 'Phone'];
  const rows = data.invoices.map(inv => [
    escapeCsvCell(inv.invoice_number),
    escapeCsvCell(inv.customer_name),
    escapeCsvCell(inv.company || ''),
    escapeCsvCell(inv.issue_date),
    escapeCsvCell(inv.due_date),
    escapeCsvCell(inv.status),
    escapeCsvCell(inv.grand_total),
    escapeCsvCell(inv.paid_amount),
    escapeCsvCell(inv.remaining_balance),
    escapeCsvCell(inv.customer_phone || '')
  ].join(','));

  const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="ApexBilling-Outstanding-Report.csv"');
  res.send(csvContent);
});

module.exports = router;
