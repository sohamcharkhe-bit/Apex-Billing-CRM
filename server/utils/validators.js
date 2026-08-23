const { validateIndianPhone } = require('./phone');

/**
 * Returns today's date in YYYY-MM-DD format (local time).
 */
function getTodayString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Returns date string YYYY-MM-DD for N days offset from today (positive for future, negative for past).
 */
function getDateStringOffset(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function isValidEmail(email) {
  if (!email) return false;
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(String(email).trim());
}

/**
 * FIX 1: Validates personal name (Customer Name, User Name).
 * Only letters, spaces, apostrophes, hyphens, periods. No digits.
 */
function validatePersonName(name) {
  if (!name || typeof name !== 'string') return false;
  const trimmed = name.trim();
  if (!trimmed) return false;
  const regex = /^[A-Za-z\s.'-]+$/;
  return regex.test(trimmed);
}

/**
 * FIX 1: Validates company name.
 * Allows letters, spaces, apostrophes, hyphens, periods, &, ,. No digits.
 */
function validateCompanyName(company) {
  if (!company) return true; // Optional field
  const trimmed = String(company).trim();
  if (!trimmed) return true;
  const regex = /^[A-Za-z\s.'&,-]+$/;
  return regex.test(trimmed);
}

/**
 * FIX 2: Validates forward-looking date bounds [today, today + 365 days].
 */
function validateForwardDate(dateStr, fieldName = 'Date') {
  const todayStr = getTodayString();
  const maxDateStr = getDateStringOffset(365);
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

  if (!dateStr || !dateRegex.test(dateStr)) {
    return { valid: false, error: `${fieldName} must be a valid date in YYYY-MM-DD format.` };
  }
  if (dateStr < todayStr) {
    return { valid: false, error: `${fieldName} cannot be in the past (earliest allowed is today, ${todayStr}).` };
  }
  if (dateStr > maxDateStr) {
    return { valid: false, error: `${fieldName} cannot be more than 1 year in the future (max allowed is ${maxDateStr}).` };
  }
  return { valid: true };
}

/**
 * Validates invoice dates per Section 25 & Fix 2 constraints:
 * 1. No past dates (>= today)
 * 2. Maximum one year out (<= today + 365 days)
 * 3. Due Date must not precede Issue Date (due_date >= issue_date)
 */
function validateInvoiceDates(issueDate, dueDate) {
  const errors = [];
  const issueCheck = validateForwardDate(issueDate, 'Issue date');
  if (!issueCheck.valid) errors.push(issueCheck.error);

  const dueCheck = validateForwardDate(dueDate, 'Due date');
  if (!dueCheck.valid) errors.push(dueCheck.error);

  if (errors.length > 0) return { valid: false, errors };

  if (dueDate < issueDate) {
    errors.push('Due date cannot precede the Issue date.');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * FIX 3: Validates reporting date range over past activity [today - 365 days, today].
 */
function validateReportDateRange(startDate, endDate) {
  const errors = [];
  const todayStr = getTodayString();
  const minDateStr = getDateStringOffset(-365);
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

  if (startDate) {
    if (!dateRegex.test(startDate)) {
      errors.push('From Date must be a valid date in YYYY-MM-DD format.');
    } else {
      if (startDate < minDateStr) {
        errors.push(`From Date cannot be older than 1 year in the past (earliest allowed is ${minDateStr}).`);
      }
      if (startDate > todayStr) {
        errors.push(`From Date cannot be in the future (latest allowed is today, ${todayStr}).`);
      }
    }
  }

  if (endDate) {
    if (!dateRegex.test(endDate)) {
      errors.push('To Date must be a valid date in YYYY-MM-DD format.');
    } else {
      if (endDate < minDateStr) {
        errors.push(`To Date cannot be older than 1 year in the past (earliest allowed is ${minDateStr}).`);
      }
      if (endDate > todayStr) {
        errors.push(`To Date cannot be in the future (latest allowed is today, ${todayStr}).`);
      }
    }
  }

  if (startDate && endDate && dateRegex.test(startDate) && dateRegex.test(endDate)) {
    if (endDate < startDate) {
      errors.push('To Date cannot be earlier than From Date.');
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Validates invoice creation payload.
 */
function validateInvoicePayload(data) {
  const errors = [];

  if (!data.customer_name || !String(data.customer_name).trim()) {
    errors.push('Customer name is required.');
  } else if (!validatePersonName(data.customer_name)) {
    errors.push('Customer name can only contain letters, spaces, apostrophes, hyphens, and periods (no numbers).');
  }

  if (data.company && !validateCompanyName(data.company)) {
    errors.push('Company name can only contain letters, spaces, apostrophes, hyphens, periods, &, and , (no numbers).');
  }

  if (data.customer_email && !isValidEmail(data.customer_email)) {
    errors.push('Customer email is invalid.');
  }

  if (data.customer_phone && !validateIndianPhone(data.customer_phone)) {
    errors.push('Customer phone must be a valid Indian mobile number.');
  }

  const dateCheck = validateInvoiceDates(data.issue_date, data.due_date);
  if (!dateCheck.valid) {
    errors.push(...dateCheck.errors);
  }

  if (data.payment_terms && !['full', 'credit'].includes(data.payment_terms)) {
    errors.push("Payment terms must be either 'full' or 'credit'.");
  }

  if (data.status && !['draft', 'sent', 'paid', 'partial', 'overdue', 'cancelled'].includes(data.status)) {
    errors.push('Invalid invoice status.');
  }

  if (!Array.isArray(data.items) || data.items.length === 0) {
    errors.push('Invoice must contain at least one line item.');
  } else {
    data.items.forEach((item, idx) => {
      // FIX 6: product_id is required for every line item
      if (!item.product_id || isNaN(parseInt(item.product_id, 10))) {
        errors.push(`Item #${idx + 1}: A valid Product or Service must be selected from the catalog.`);
      }

      const qty = Number(item.quantity);
      if (isNaN(qty) || qty <= 0) {
        errors.push(`Item #${idx + 1}: Quantity must be greater than 0.`);
      }
      const price = Number(item.unit_price);
      if (isNaN(price) || price < 0) {
        errors.push(`Item #${idx + 1}: Unit price cannot be negative.`);
      }
      const tax = Number(item.tax_rate);
      if (isNaN(tax) || tax < 0 || tax > 100) {
        errors.push(`Item #${idx + 1}: Tax rate must be between 0% and 100%.`);
      }
    });
  }

  const discount = Number(data.discount_total || 0);
  if (isNaN(discount) || discount < 0) {
    errors.push('Discount cannot be negative.');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

module.exports = {
  getTodayString,
  getDateStringOffset,
  isValidEmail,
  validatePersonName,
  validateCompanyName,
  validateForwardDate,
  validateInvoiceDates,
  validateReportDateRange,
  validateInvoicePayload
};
