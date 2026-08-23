/**
 * Financial calculation and currency formatting utilities for Apex Billing.
 * Currency is Indian Rupee (₹).
 */

function round2(num) {
  return Math.round((Number(num) || 0) * 100) / 100;
}

/**
 * Formats a numeric value as an Indian Rupee string.
 * Avoids unnecessary decimals: 1500 -> '₹1,500', 1500.50 -> '₹1,500.50', 1 -> '1'.
 */
function formatRupee(amount) {
  const num = Number(amount) || 0;
  const isFractional = (num % 1) !== 0;
  
  const formatted = num.toLocaleString('en-IN', {
    minimumFractionDigits: isFractional ? 2 : 0,
    maximumFractionDigits: 2
  });
  
  return `₹${formatted}`;
}

/**
 * Formats a plain number without the currency symbol (for quantities, taxes).
 * e.g., 1 -> '1', 18 -> '18%', 1.5 -> '1.5'
 */
function formatNumber(num, isPercent = false) {
  const val = Number(num) || 0;
  const isFractional = (val % 1) !== 0;
  const str = val.toLocaleString('en-IN', {
    minimumFractionDigits: isFractional ? 2 : 0,
    maximumFractionDigits: 2
  });
  return isPercent ? `${str}%` : str;
}

/**
 * Authoritative server-side calculation for invoice items and totals.
 * @param {Array<{ quantity: number, unit_price: number, tax_rate: number }>} items
 * @param {number} discount
 */
function calculateInvoiceTotals(items, discount = 0) {
  let subtotal = 0;
  let taxTotal = 0;

  const processedItems = items.map(item => {
    const qty = round2(Math.max(0, Number(item.quantity) || 0));
    const price = round2(Math.max(0, Number(item.unit_price) || 0));
    const taxRate = round2(Math.max(0, Number(item.tax_rate) || 0));

    const lineSubtotal = round2(qty * price);
    const lineTax = round2(lineSubtotal * (taxRate / 100));
    const lineTotal = round2(lineSubtotal + lineTax);

    subtotal = round2(subtotal + lineSubtotal);
    taxTotal = round2(taxTotal + lineTax);

    return {
      product_id: item.product_id ? parseInt(item.product_id, 10) : null,
      description: String(item.description || '').trim(),
      quantity: qty,
      unit_price: price,
      tax_rate: taxRate,
      line_total: lineTotal
    };
  });

  const discountTotal = round2(Math.max(0, Number(discount) || 0));
  const rawGrand = subtotal + taxTotal - discountTotal;
  const grandTotal = round2(Math.max(0, rawGrand));

  return {
    items: processedItems,
    subtotal,
    tax_total: taxTotal,
    discount_total: discountTotal,
    grand_total: grandTotal
  };
}

module.exports = {
  round2,
  formatRupee,
  formatNumber,
  calculateInvoiceTotals
};
