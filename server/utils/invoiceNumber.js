/**
 * Safe sequential invoice numbering utility.
 * Generates numbers formatted as INV-0001, INV-0002, etc.
 */

function getNextInvoiceNumber(db) {
  // Query existing invoice numbers to find highest sequence
  const row = db.prepare(`
    SELECT invoice_number 
    FROM invoices 
    WHERE invoice_number LIKE 'INV-%' 
    ORDER BY id DESC 
    LIMIT 50
  `).all();

  let maxSeq = 0;
  for (const r of row) {
    const match = String(r.invoice_number).match(/^INV-(\d+)$/i);
    if (match) {
      const seq = parseInt(match[1], 10);
      if (seq > maxSeq) {
        maxSeq = seq;
      }
    }
  }

  const nextSeq = maxSeq + 1;
  return `INV-${String(nextSeq).padStart(4, '0')}`;
}

module.exports = {
  getNextInvoiceNumber
};
