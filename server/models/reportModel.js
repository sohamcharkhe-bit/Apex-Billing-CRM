const db = require('../db/database');
const { round2 } = require('../utils/money');
const { getTodayString } = require('../utils/validators');

const ReportModel = {
  /**
   * Calculates dashboard KPI stats.
   */
  getDashboardStats() {
    const todayStr = getTodayString();
    const currentMonthPrefix = todayStr.slice(0, 7); // 'YYYY-MM'

    // 1. Revenue this month
    const revRow = db.prepare(`
      SELECT COALESCE(SUM(p.amount), 0) as month_revenue
      FROM payments p
      INNER JOIN invoices i ON p.invoice_id = i.id
      WHERE i.deleted_at IS NULL AND p.payment_date LIKE ?
    `).get(`${currentMonthPrefix}%`);

    const monthRevenue = round2(revRow.month_revenue || 0);

    // 2. Outstanding Balance and Overdue Count across active invoices
    const activeInvoices = db.prepare(`
      SELECT 
        i.id,
        i.grand_total,
        i.due_date,
        i.status,
        COALESCE(SUM(p.amount), 0) as total_paid
      FROM invoices i
      LEFT JOIN payments p ON i.id = p.invoice_id
      WHERE i.deleted_at IS NULL AND i.status != 'cancelled'
      GROUP BY i.id
    `).all();

    let totalOutstanding = 0;
    let overdueCount = 0;
    let paidCount = 0;
    let totalInvoicesCount = activeInvoices.length;

    for (const inv of activeInvoices) {
      const paid = round2(inv.total_paid || 0);
      const balance = Math.max(0, round2(inv.grand_total - paid));

      if (balance > 0) {
        totalOutstanding = round2(totalOutstanding + balance);
        if (inv.due_date < todayStr) {
          overdueCount += 1;
        }
      } else if (inv.grand_total > 0 && balance === 0) {
        paidCount += 1;
      }
    }

    return {
      monthRevenue,
      totalOutstanding,
      overdueCount,
      paidCount,
      totalInvoicesCount
    };
  },

  /**
   * Calculates monthly revenue trends for the last 6 months for Chart.js.
   */
  getRevenueTrend(monthsCount = 6) {
    const months = [];
    const now = new Date();

    for (let i = monthsCount - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const label = d.toLocaleString('en-US', { month: 'short', year: 'numeric' });
      months.push({ prefix: `${year}-${month}`, label });
    }

    const data = months.map(m => {
      const row = db.prepare(`
        SELECT COALESCE(SUM(p.amount), 0) as total
        FROM payments p
        INNER JOIN invoices i ON p.invoice_id = i.id
        WHERE i.deleted_at IS NULL AND p.payment_date LIKE ?
      `).get(`${m.prefix}%`);

      return {
        month: m.label,
        revenue: round2(row.total || 0)
      };
    });

    return data;
  },

  /**
   * Retrieves Revenue Report filtered by date range.
   */
  getRevenueReport({ startDate, endDate } = {}) {
    let sql = `
      SELECT 
        p.id,
        p.payment_date,
        p.amount,
        p.payment_method,
        p.reference_note,
        i.invoice_number,
        i.customer_name,
        i.company,
        u.name as recorded_by_name
      FROM payments p
      INNER JOIN invoices i ON p.invoice_id = i.id
      LEFT JOIN users u ON p.recorded_by = u.id
      WHERE i.deleted_at IS NULL
    `;
    const params = [];

    if (startDate && String(startDate).trim()) {
      sql += ` AND p.payment_date >= ?`;
      params.push(String(startDate).trim());
    }

    if (endDate && String(endDate).trim()) {
      sql += ` AND p.payment_date <= ?`;
      params.push(String(endDate).trim());
    }

    sql += ` ORDER BY p.payment_date DESC, p.id DESC`;

    const payments = db.prepare(sql).all(...params);
    const totalRevenue = round2(payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0));

    return {
      totalRevenue,
      count: payments.length,
      payments
    };
  },

  /**
   * Retrieves Outstanding Balances Report for all active invoices with balance > 0.
   */
  getOutstandingReport() {
    const todayStr = getTodayString();
    const rows = db.prepare(`
      SELECT 
        i.id,
        i.invoice_number,
        i.customer_name,
        i.company,
        i.customer_phone,
        i.customer_email,
        i.issue_date,
        i.due_date,
        i.payment_terms,
        i.status,
        i.grand_total,
        COALESCE(SUM(p.amount), 0) as paid_amount,
        (i.grand_total - COALESCE(SUM(p.amount), 0)) as remaining_balance
      FROM invoices i
      LEFT JOIN payments p ON i.id = p.invoice_id
      WHERE i.deleted_at IS NULL AND i.status != 'cancelled'
      GROUP BY i.id
      HAVING remaining_balance > 0.001
      ORDER BY i.due_date ASC, i.id ASC
    `).all();

    const formatted = rows.map(inv => {
      const paid = round2(inv.paid_amount || 0);
      const balance = Math.max(0, round2(inv.grand_total - paid));
      let currentStatus = inv.status;

      if (paid > 0 && balance > 0) currentStatus = 'partial';
      if (inv.due_date < todayStr && balance > 0) currentStatus = 'overdue';

      return {
        ...inv,
        paid_amount: paid,
        remaining_balance: balance,
        status: currentStatus
      };
    });

    const totalOutstanding = round2(formatted.reduce((sum, r) => sum + r.remaining_balance, 0));

    return {
      totalOutstanding,
      count: formatted.length,
      invoices: formatted
    };
  }
};

module.exports = ReportModel;
