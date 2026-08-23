const db = require('../db/database');
const ProductModel = require('./productModel');
const { calculateInvoiceTotals, round2 } = require('../utils/money');
const { getNextInvoiceNumber } = require('../utils/invoiceNumber');
const { getTodayString } = require('../utils/validators');

const InvoiceModel = {
  /**
   * Retrieves active (non-trashed) invoices with filtering and pagination.
   */
  getAll({ search = '', status = '', page = 1, limit = 50 } = {}) {
    const todayStr = getTodayString();
    let sql = `
      SELECT 
        i.*,
        u.name as created_by_name,
        COALESCE(SUM(p.amount), 0) as paid_amount,
        (i.grand_total - COALESCE(SUM(p.amount), 0)) as remaining_balance
      FROM invoices i
      LEFT JOIN users u ON i.created_by = u.id
      LEFT JOIN payments p ON i.id = p.invoice_id
      WHERE i.deleted_at IS NULL
    `;
    const params = [];

    if (search && String(search).trim()) {
      const q = `%${String(search).trim()}%`;
      sql += ` AND (i.invoice_number LIKE ? OR i.customer_name LIKE ? OR i.company LIKE ? OR i.customer_phone LIKE ?)`;
      params.push(q, q, q, q);
    }

    if (status && status !== 'all') {
      if (status === 'overdue') {
        sql += ` AND (i.status = 'overdue' OR (i.status NOT IN ('paid', 'cancelled') AND i.due_date < ?))`;
        params.push(todayStr);
      } else {
        sql += ` AND i.status = ?`;
        params.push(status);
      }
    }

    sql += ` GROUP BY i.id ORDER BY i.id DESC LIMIT ? OFFSET ?`;
    params.push(Number(limit), (Number(page) - 1) * Number(limit));

    const rows = db.prepare(sql).all(...params);

    // Apply live dynamic overdue detection
    return rows.map(inv => {
      const paid = round2(inv.paid_amount || 0);
      const balance = Math.max(0, round2(inv.grand_total - paid));
      let currentStatus = inv.status;

      if (currentStatus !== 'paid' && currentStatus !== 'cancelled') {
        if (paid > 0 && balance > 0) {
          currentStatus = 'partial';
        }
        if (inv.due_date < todayStr && balance > 0) {
          currentStatus = 'overdue';
        }
      }

      return {
        ...inv,
        paid_amount: paid,
        remaining_balance: balance,
        status: currentStatus
      };
    });
  },

  /**
   * Retrieves single invoice by ID with items and payments.
   */
  getById(id) {
    const todayStr = getTodayString();
    const invoiceStmt = db.prepare(`
      SELECT 
        i.*,
        u.name as created_by_name,
        COALESCE(SUM(p.amount), 0) as paid_amount,
        (i.grand_total - COALESCE(SUM(p.amount), 0)) as remaining_balance
      FROM invoices i
      LEFT JOIN users u ON i.created_by = u.id
      LEFT JOIN payments p ON i.id = p.invoice_id
      WHERE i.id = ?
      GROUP BY i.id
    `);
    const invoice = invoiceStmt.get(Number(id));
    if (!invoice) return null;

    const itemsStmt = db.prepare(`
      SELECT ii.*, ps.name as product_name, ps.type as product_type 
      FROM invoice_items ii
      LEFT JOIN products_services ps ON ii.product_id = ps.id
      WHERE ii.invoice_id = ?
      ORDER BY ii.id ASC
    `);
    const items = itemsStmt.all(Number(id));

    const paymentsStmt = db.prepare(`
      SELECT p.*, u.name as recorded_by_name
      FROM payments p
      LEFT JOIN users u ON p.recorded_by = u.id
      WHERE p.invoice_id = ?
      ORDER BY p.payment_date DESC, p.id DESC
    `);
    const payments = paymentsStmt.all(Number(id));

    const paid = round2(invoice.paid_amount || 0);
    const balance = Math.max(0, round2(invoice.grand_total - paid));
    let currentStatus = invoice.status;

    if (invoice.deleted_at === null && currentStatus !== 'paid' && currentStatus !== 'cancelled') {
      if (paid > 0 && balance > 0) {
        currentStatus = 'partial';
      }
      if (invoice.due_date < todayStr && balance > 0) {
        currentStatus = 'overdue';
      }
    }

    return {
      ...invoice,
      paid_amount: paid,
      remaining_balance: balance,
      status: currentStatus,
      items,
      payments
    };
  },

  /**
   * Creates an invoice with items in a single transaction.
   * Authoritatively snapshots product name & description into invoice_items (§Fix 6).
   */
  create(payload, userId) {
    const tx = db.transaction(() => {
      // 1. Authoritative product lookup & snapshotting
      const authoritativeItems = payload.items.map((item, idx) => {
        if (!item.product_id) {
          throw new Error(`Item #${idx + 1}: A valid product or service is required.`);
        }

        const prod = ProductModel.getById(item.product_id);
        if (!prod) {
          throw new Error(`Item #${idx + 1}: Selected product/service was not found in catalog.`);
        }

        // Snapshot description from product catalog
        const snapshotDescription = prod.description 
          ? `${prod.name} — ${prod.description}` 
          : prod.name;

        let unitPrice = item.unit_price !== undefined && item.unit_price !== null && item.unit_price !== ''
          ? Number(item.unit_price)
          : prod.unit_price;

        let taxRate = item.tax_rate !== undefined && item.tax_rate !== null && item.tax_rate !== ''
          ? Number(item.tax_rate)
          : prod.tax_rate;

        return {
          product_id: prod.id,
          description: snapshotDescription,
          quantity: item.quantity,
          unit_price: unitPrice,
          tax_rate: taxRate
        };
      });

      const { items, subtotal, tax_total, discount_total, grand_total } = calculateInvoiceTotals(
        authoritativeItems,
        payload.discount_total || 0
      );

      // 2. Sequential Invoice Number
      const invoiceNumber = payload.invoice_number && String(payload.invoice_number).trim() 
        ? String(payload.invoice_number).trim() 
        : getNextInvoiceNumber(db);

      // 3. Insert Invoice Header
      const insertInvoiceStmt = db.prepare(`
        INSERT INTO invoices (
          invoice_number, customer_name, company, customer_email, customer_phone, billing_address,
          issue_date, due_date, status, payment_terms,
          subtotal, tax_total, discount_total, grand_total,
          notes, created_by, created_at
        ) VALUES (
          ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, CURRENT_TIMESTAMP
        )
      `);

      const initialStatus = payload.status || (payload.payment_terms === 'full' ? 'draft' : 'sent');
      const paymentTerms = payload.payment_terms === 'full' ? 'full' : 'credit';

      const res = insertInvoiceStmt.run(
        invoiceNumber,
        String(payload.customer_name).trim(),
        payload.company ? String(payload.company).trim() : null,
        payload.customer_email ? String(payload.customer_email).trim() : null,
        payload.customer_phone ? String(payload.customer_phone).trim() : null,
        payload.billing_address ? String(payload.billing_address).trim() : null,
        payload.issue_date,
        payload.due_date,
        initialStatus,
        paymentTerms,
        subtotal,
        tax_total,
        discount_total,
        grand_total,
        payload.notes ? String(payload.notes).trim() : null,
        userId || null
      );

      const invoiceId = res.lastInsertRowid;

      // 4. Insert Invoice Line Items with snapshot description & required product_id
      const insertItemStmt = db.prepare(`
        INSERT INTO invoice_items (
          invoice_id, product_id, description, quantity, unit_price, tax_rate, line_total
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      for (const item of items) {
        insertItemStmt.run(
          invoiceId,
          item.product_id,
          item.description,
          item.quantity,
          item.unit_price,
          item.tax_rate,
          item.line_total
        );
      }

      return invoiceId;
    });

    const newId = tx();
    return this.getById(newId);
  },

  /**
   * Updates an invoice and replaces line items in a single transaction.
   */
  update(id, payload) {
    const existing = this.getById(id);
    if (!existing || existing.deleted_at !== null) {
      throw new Error('Invoice not found or is in Trash.');
    }

    const tx = db.transaction(() => {
      const authoritativeItems = payload.items.map((item, idx) => {
        if (!item.product_id) {
          throw new Error(`Item #${idx + 1}: A valid product or service is required.`);
        }

        const prod = ProductModel.getById(item.product_id);
        if (!prod) {
          throw new Error(`Item #${idx + 1}: Selected product/service was not found in catalog.`);
        }

        const snapshotDescription = prod.description 
          ? `${prod.name} — ${prod.description}` 
          : prod.name;

        let unitPrice = item.unit_price !== undefined && item.unit_price !== null && item.unit_price !== ''
          ? Number(item.unit_price)
          : prod.unit_price;

        let taxRate = item.tax_rate !== undefined && item.tax_rate !== null && item.tax_rate !== ''
          ? Number(item.tax_rate)
          : prod.tax_rate;

        return {
          product_id: prod.id,
          description: snapshotDescription,
          quantity: item.quantity,
          unit_price: unitPrice,
          tax_rate: taxRate
        };
      });

      const { items, subtotal, tax_total, discount_total, grand_total } = calculateInvoiceTotals(
        authoritativeItems,
        payload.discount_total || 0
      );

      const updateInvoiceStmt = db.prepare(`
        UPDATE invoices SET
          customer_name = ?, company = ?, customer_email = ?, customer_phone = ?, billing_address = ?,
          issue_date = ?, due_date = ?, payment_terms = ?,
          subtotal = ?, tax_total = ?, discount_total = ?, grand_total = ?,
          notes = ?
        WHERE id = ?
      `);

      const paymentTerms = payload.payment_terms === 'full' ? 'full' : 'credit';

      updateInvoiceStmt.run(
        String(payload.customer_name).trim(),
        payload.company ? String(payload.company).trim() : null,
        payload.customer_email ? String(payload.customer_email).trim() : null,
        payload.customer_phone ? String(payload.customer_phone).trim() : null,
        payload.billing_address ? String(payload.billing_address).trim() : null,
        payload.issue_date,
        payload.due_date,
        paymentTerms,
        subtotal,
        tax_total,
        discount_total,
        grand_total,
        payload.notes ? String(payload.notes).trim() : null,
        Number(id)
      );

      // Recreate invoice items
      db.prepare('DELETE FROM invoice_items WHERE invoice_id = ?').run(Number(id));
      const insertItemStmt = db.prepare(`
        INSERT INTO invoice_items (
          invoice_id, product_id, description, quantity, unit_price, tax_rate, line_total
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      for (const item of items) {
        insertItemStmt.run(
          Number(id),
          item.product_id,
          item.description,
          item.quantity,
          item.unit_price,
          item.tax_rate,
          item.line_total
        );
      }

      this.syncInvoiceStatus(id);
    });

    tx();
    return this.getById(id);
  },

  syncInvoiceStatus(invoiceId) {
    const inv = db.prepare('SELECT * FROM invoices WHERE id = ?').get(Number(invoiceId));
    if (!inv || inv.status === 'cancelled') return;

    const paidRow = db.prepare('SELECT COALESCE(SUM(amount), 0) as total_paid FROM payments WHERE invoice_id = ?').get(Number(invoiceId));
    const totalPaid = round2(paidRow.total_paid || 0);
    const grandTotal = round2(inv.grand_total || 0);
    const balance = Math.max(0, round2(grandTotal - totalPaid));
    const todayStr = getTodayString();

    let newStatus = inv.status;
    if (balance === 0 && grandTotal > 0) {
      newStatus = 'paid';
    } else if (totalPaid > 0 && balance > 0) {
      newStatus = 'partial';
    } else if (inv.due_date < todayStr && balance > 0) {
      newStatus = 'overdue';
    } else if (inv.status === 'draft') {
      newStatus = 'draft';
    } else {
      newStatus = 'sent';
    }

    db.prepare('UPDATE invoices SET status = ? WHERE id = ?').run(newStatus, Number(invoiceId));
  },

  softDelete(id) {
    const stmt = db.prepare(`
      UPDATE invoices 
      SET deleted_at = CURRENT_TIMESTAMP 
      WHERE id = ? AND deleted_at IS NULL
    `);
    const res = stmt.run(Number(id));
    return res.changes > 0;
  },

  getTrashList() {
    const stmt = db.prepare(`
      SELECT 
        i.*,
        u.name as created_by_name,
        COALESCE(SUM(p.amount), 0) as paid_amount
      FROM invoices i
      LEFT JOIN users u ON i.created_by = u.id
      LEFT JOIN payments p ON i.id = p.invoice_id
      WHERE i.deleted_at IS NOT NULL
      GROUP BY i.id
      ORDER BY i.deleted_at DESC
    `);
    return stmt.all();
  },

  restore(id) {
    const stmt = db.prepare(`
      UPDATE invoices 
      SET deleted_at = NULL 
      WHERE id = ? AND deleted_at IS NOT NULL
    `);
    const res = stmt.run(Number(id));
    if (res.changes > 0) {
      this.syncInvoiceStatus(id);
      return true;
    }
    return false;
  },

  emptyTrash() {
    const tx = db.transaction(() => {
      const trashed = db.prepare('SELECT id FROM invoices WHERE deleted_at IS NOT NULL').all();
      if (trashed.length === 0) return 0;

      const trashedIds = trashed.map(r => r.id);
      const placeholders = trashedIds.map(() => '?').join(',');

      db.prepare(`DELETE FROM payments WHERE invoice_id IN (${placeholders})`).run(...trashedIds);
      db.prepare(`DELETE FROM invoice_items WHERE invoice_id IN (${placeholders})`).run(...trashedIds);
      const res = db.prepare(`DELETE FROM invoices WHERE id IN (${placeholders})`).run(...trashedIds);

      return res.changes;
    });

    return tx();
  }
};

module.exports = InvoiceModel;
