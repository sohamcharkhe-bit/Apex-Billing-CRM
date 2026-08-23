const express = require('express');
const requireLogin = require('../middleware/requireLogin');
const PaymentModel = require('../models/paymentModel');
const { getTodayString } = require('../utils/validators');

const router = express.Router();
router.use(requireLogin);

// POST /api/payments
router.post('/', (req, res) => {
  const { invoice_id, amount, payment_date, payment_method, reference_note } = req.body;

  if (!invoice_id) {
    return res.status(400).json({ success: false, error: 'Invoice ID is required.' });
  }

  const pDate = payment_date || getTodayString();
  const pMethod = payment_method || 'bank_transfer';

  try {
    const result = PaymentModel.recordPayment({
      invoice_id,
      amount,
      payment_date: pDate,
      payment_method: pMethod,
      reference_note,
      recorded_by: req.session.user?.id
    });

    res.status(201).json({
      success: true,
      message: `Payment of ₹${result.amount} recorded successfully.`,
      result
    });
  } catch (err) {
    return res.status(400).json({
      success: false,
      error: err.message || 'Failed to record payment.'
    });
  }
});

// GET /api/payments/recent
router.get('/recent', (req, res) => {
  const limit = parseInt(req.query.limit || '10', 10);
  const payments = PaymentModel.getRecent(limit);
  res.json({ success: true, payments });
});

// GET /api/payments/invoice/:id
router.get('/invoice/:id', (req, res) => {
  const payments = PaymentModel.getByInvoiceId(req.params.id);
  res.json({ success: true, payments });
});

module.exports = router;
