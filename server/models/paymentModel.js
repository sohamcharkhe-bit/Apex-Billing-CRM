const db = require('../db/database');
const { round2 } = require('../utils/money');
const { validateForwardDate } = require('../utils/validators');

const PaymentModel = {
  /**
   * Records a payment against an invoice inside a transaction.
   * Strictly enforces overpayment guard (amount <= remaining_balance) and forward date bounds (§Fix 2).
   */
  recordPayment({ invoice_id, amount, payment_date, payment_method, reference_note = '', recorded_by }) {
    const paymentAmount = round2(amount);
    if (isNaN(paymentAmount) || paymentAmount <= 0) {
      throw new Error('Payment amount must be greater than ₹0.');
    }

    // FIX 2: Validate Payment Date bounds
    const dateCheck = validateForwardDate(payment_date, 'Payment date');
    if (!dateCheck.valid) {
      throw new Error(dateCheck.error);
    }

    const validMethods = ['cash', 'bank_transfer', 'card', 'cheque', 'other'];
    if (!validMethods.includes(payment_method)) {
      throw new Error(`Invalid payment method. Allowed: ${validMethods.join(', ')}`);
    }

    const tx = db.transaction(() => {
      // 1. Fetch active invoice
      const invoice = db.prepare(`
        SELECT * FROM invoices 
        WHERE id = ? AND deleted_at IS NULL
      `).get(Number(invoice_id));

      if (!invoice) {
        throw new Error('Active invoice not found or is in Trash.');
      }

      if (invoice.status === 'cancelled') {
        throw new Error('Cannot record payment for a cancelled invoice.');
      }

      // 2. Fetch current total paid
      const paidRow = db.prepare(`
        SELECT COALESCE(SUM(amount), 0) as total_paid 
        FROM payments 
        WHERE invoice_id = ?
      `).get(Number(invoice_id));

      const currentPaid = round2(paidRow.total_paid || 0);
      const grandTotal = round2(invoice.grand_total || 0);
      const remainingBalance = Math.max(0, round2(grandTotal - currentPaid));

      // 3. Overpayment check
      if (paymentAmount > remainingBalance + 0.001) {
        throw new Error(`Payment amount (₹${paymentAmount}) exceeds the remaining balance (₹${remainingBalance}).`);
      }

      // 4. Insert payment
      const insertStmt = db.prepare(`
        INSERT INTO payments (
          invoice_id, amount, payment_date, payment_method, reference_note, recorded_by, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `);

      const res = insertStmt.run(
        Number(invoice_id),
        paymentAmount,
        payment_date,
        payment_method,
        reference_note ? String(reference_note).trim() : null,
        recorded_by || null
      );

      // 5. Update invoice status
      const newTotalPaid = round2(currentPaid + paymentAmount);
      const newRemaining = Math.max(0, round2(grandTotal - newTotalPaid));
      const newStatus = newRemaining === 0 ? 'paid' : 'partial';

      db.prepare(`
        UPDATE invoices 
        SET status = ? 
        WHERE id = ?
      `).run(newStatus, Number(invoice_id));

      return {
        paymentId: res.lastInsertRowid,
        invoiceId: Number(invoice_id),
        amount: paymentAmount,
        newStatus,
        remainingBalance: newRemaining
      };
    });

    return tx();
  },

  getByInvoiceId(invoiceId) {
    const stmt = db.prepare(`
      SELECT p.*, u.name as recorded_by_name
      FROM payments p
      LEFT JOIN users u ON p.recorded_by = u.id
      WHERE p.invoice_id = ?
      ORDER BY p.payment_date DESC, p.id DESC
    `);
    return stmt.all(Number(invoiceId));
  },

  getRecent(limit = 10) {
    const stmt = db.prepare(`
      SELECT 
        p.*,
        i.invoice_number,
        i.customer_name,
        i.company,
        u.name as recorded_by_name
      FROM payments p
      INNER JOIN invoices i ON p.invoice_id = i.id
      LEFT JOIN users u ON p.recorded_by = u.id
      WHERE i.deleted_at IS NULL
      ORDER BY p.payment_date DESC, p.id DESC
      LIMIT ?
    `);
    return stmt.all(Number(limit));
  }
};

module.exports = PaymentModel;
