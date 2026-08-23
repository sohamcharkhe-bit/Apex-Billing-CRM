/**
 * Indian phone number validation and normalization utility.
 * Accepts: 9876543210, 09876543210, +919876543210, +91 98765 43210, etc.
 * Normalizes to: +91 98765 43210
 */

function validateIndianPhone(phone) {
  if (!phone) return true; // Optional field
  const clean = String(phone).replace(/[\s\-()]/g, '');
  // Matches: 10 digits starting with 6-9, or 0 followed by 10 digits, or +91/91 followed by 10 digits
  const regex = /^(?:\+91|91|0)?[6-9]\d{9}$/;
  return regex.test(clean);
}

function normalizeIndianPhone(phone) {
  if (!phone) return '';
  const clean = String(phone).replace(/[\s\-()]/g, '');
  const match = clean.match(/(?:(?:\+91|91|0))?([6-9]\d{9})$/);
  if (match && match[1]) {
    const digits = match[1];
    return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
  }
  return String(phone).trim();
}

module.exports = {
  validateIndianPhone,
  normalizeIndianPhone
};
