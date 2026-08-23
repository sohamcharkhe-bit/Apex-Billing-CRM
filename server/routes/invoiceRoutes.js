const express = require('express');
const requireLogin = require('../middleware/requireLogin');
const requireRole = require('../middleware/requireRole');
const InvoiceModel = require('../models/invoiceModel');
const { validateInvoicePayload } = require('../utils/validators');
const { generateInvoicePDF } = require('../utils/pdf');

const router = express.Router();
router.use(requireLogin);

// GET /api/invoices/trash
router.get('/trash', (req, res) => {
  const trashed = InvoiceModel.getTrashList();
  res.json({ success: true, count: trashed.length, invoices: trashed });
});

// POST /api/invoices/trash/empty (Admin only)
router.post('/trash/empty', requireRole('admin'), (req, res) => {
  const deletedCount = InvoiceModel.emptyTrash();
  res.json({
    success: true,
    message: `Trash emptied successfully. ${deletedCount} invoice(s) permanently removed.`,
    deletedCount
  });
});

// GET /api/invoices
router.get('/', (req, res) => {
  const { search, status, page, limit } = req.query;
  const invoices = InvoiceModel.getAll({
    search,
    status,
    page: parseInt(page || '1', 10),
    limit: parseInt(limit || '50', 10)
  });
  res.json({ success: true, count: invoices.length, invoices });
});

// GET /api/invoices/:id
router.get('/:id', (req, res) => {
  const invoice = InvoiceModel.getById(req.params.id);
  if (!invoice) {
    return res.status(404).json({ success: false, error: 'Invoice not found.' });
  }
  res.json({ success: true, invoice });
});

// GET /api/invoices/:id/pdf
router.get('/:id/pdf', async (req, res, next) => {
  try {
    const invoice = InvoiceModel.getById(req.params.id);
    if (!invoice) {
      return res.status(404).json({ success: false, error: 'Invoice not found.' });
    }

    const pdfBuffer = await generateInvoicePDF(invoice, invoice.items, invoice.payments);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${invoice.invoice_number}.pdf"`);
    res.send(pdfBuffer);
  } catch (err) {
    next(err);
  }
});

// POST /api/invoices
router.post('/', (req, res) => {
  const validation = validateInvoicePayload(req.body);
  if (!validation.valid) {
    return res.status(400).json({ success: false, errors: validation.errors });
  }

  try {
    const newInvoice = InvoiceModel.create(req.body, req.session.user?.id);
    res.status(201).json({
      success: true,
      invoice: newInvoice,
      message: `Invoice ${newInvoice.invoice_number} created successfully.`
    });
  } catch (err) {
    if (err.message && err.message.includes('UNIQUE constraint failed: invoices.invoice_number')) {
      return res.status(400).json({ success: false, error: 'An invoice with this invoice number already exists.' });
    }
    throw err;
  }
});

// PUT /api/invoices/:id
router.put('/:id', (req, res) => {
  const existing = InvoiceModel.getById(req.params.id);
  if (!existing) {
    return res.status(404).json({ success: false, error: 'Invoice not found.' });
  }

  const validation = validateInvoicePayload(req.body);
  if (!validation.valid) {
    return res.status(400).json({ success: false, errors: validation.errors });
  }

  const updatedInvoice = InvoiceModel.update(req.params.id, req.body);
  res.json({
    success: true,
    invoice: updatedInvoice,
    message: `Invoice ${updatedInvoice.invoice_number} updated successfully.`
  });
});

// DELETE /api/invoices/:id (Soft delete to Trash)
router.delete('/:id', (req, res) => {
  const existing = InvoiceModel.getById(req.params.id);
  if (!existing) {
    return res.status(404).json({ success: false, error: 'Invoice not found.' });
  }

  InvoiceModel.softDelete(req.params.id);
  res.json({
    success: true,
    message: `Invoice ${existing.invoice_number} moved to Trash.`
  });
});

// POST /api/invoices/:id/restore
router.post('/:id/restore', (req, res) => {
  const success = InvoiceModel.restore(req.params.id);
  if (!success) {
    return res.status(404).json({ success: false, error: 'Invoice not found in Trash or already active.' });
  }

  res.json({
    success: true,
    message: 'Invoice restored successfully.'
  });
});

module.exports = router;
