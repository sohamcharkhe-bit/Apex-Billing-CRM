const db = require('../db/database');
const { round2 } = require('../utils/money');

const ProductModel = {
  getAll(type = null) {
    if (type && ['product', 'service'].includes(type)) {
      const stmt = db.prepare('SELECT * FROM products_services WHERE type = ? ORDER BY name ASC');
      return stmt.all(type);
    }
    const stmt = db.prepare('SELECT * FROM products_services ORDER BY name ASC');
    return stmt.all();
  },

  getById(id) {
    const stmt = db.prepare('SELECT * FROM products_services WHERE id = ?');
    return stmt.get(Number(id));
  },

  create({ name, description = '', type = 'product', quantity = null, unit_price, tax_rate = 0 }) {
    const itemType = type === 'service' ? 'service' : 'product';
    const stockQty = itemType === 'product' && quantity !== null && quantity !== undefined && quantity !== '' 
      ? Math.max(0, parseInt(quantity, 10)) 
      : null;

    const stmt = db.prepare(`
      INSERT INTO products_services (name, description, type, quantity, unit_price, tax_rate, created_at)
      VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `);
    const res = stmt.run(
      String(name).trim(),
      description ? String(description).trim() : '',
      itemType,
      stockQty,
      round2(unit_price),
      round2(tax_rate)
    );
    return this.getById(res.lastInsertRowid);
  },

  update(id, { name, description = '', type = 'product', quantity = null, unit_price, tax_rate = 0 }) {
    const itemType = type === 'service' ? 'service' : 'product';
    const stockQty = itemType === 'product' && quantity !== null && quantity !== undefined && quantity !== '' 
      ? Math.max(0, parseInt(quantity, 10)) 
      : null;

    const stmt = db.prepare(`
      UPDATE products_services 
      SET name = ?, description = ?, type = ?, quantity = ?, unit_price = ?, tax_rate = ?
      WHERE id = ?
    `);
    stmt.run(
      String(name).trim(),
      description ? String(description).trim() : '',
      itemType,
      stockQty,
      round2(unit_price),
      round2(tax_rate),
      Number(id)
    );
    return this.getById(id);
  },

  /**
   * FIX 6: Checks invoice usage before deletion.
   */
  getUsageCount(id) {
    const row = db.prepare('SELECT COUNT(DISTINCT invoice_id) as count FROM invoice_items WHERE product_id = ?').get(Number(id));
    return row ? row.count : 0;
  },

  delete(id) {
    const usageCount = this.getUsageCount(id);
    if (usageCount > 0) {
      const err = new Error(`Cannot delete product/service — it is used in ${usageCount} invoice(s).`);
      err.code = 'PRODUCT_IN_USE';
      err.usageCount = usageCount;
      throw err;
    }

    const stmt = db.prepare('DELETE FROM products_services WHERE id = ?');
    const res = stmt.run(Number(id));
    return res.changes > 0;
  }
};

module.exports = ProductModel;
