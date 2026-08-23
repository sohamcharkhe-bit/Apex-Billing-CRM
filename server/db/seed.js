const db = require('./database');
const UserModel = require('../models/userModel');
const ProductModel = require('../models/productModel');
const InvoiceModel = require('../models/invoiceModel');
const PaymentModel = require('../models/paymentModel');
const { getTodayString, getDateStringOffset } = require('../utils/validators');

console.log('Seeding Apex Billing database with realistic demonstration data...');

const fs = require('fs');
const path = require('path');

// 1. Drop existing tables and recreate schema cleanly
db.exec(`
  DROP TABLE IF EXISTS payments;
  DROP TABLE IF EXISTS invoice_items;
  DROP TABLE IF EXISTS invoices;
  DROP TABLE IF EXISTS products_services;
  DROP TABLE IF EXISTS users;
`);

const schemaSql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
db.exec(schemaSql);

// 2. Seed Users
console.log('Creating Admin and Staff accounts...');
const admin = UserModel.createUser({
  name: 'Vikramaditya Sharma',
  email: 'admin@apexbilling.com',
  password: 'Admin@123',
  role: 'admin',
  status: 'active'
});

const staff = UserModel.createUser({
  name: 'Pooja Iyer',
  email: 'staff@apexbilling.com',
  password: 'Staff@123',
  role: 'staff',
  status: 'active'
});

// 3. Seed Products & Services (FIX 4 & FIX 5)
console.log('Creating Product & Service catalog with types and stock quantities...');
const s1 = ProductModel.create({
  name: 'Full-Stack Web Application Development',
  description: 'Custom React & Node.js scalable web app development milestone',
  type: 'service',
  quantity: null,
  unit_price: 45000,
  tax_rate: 18
});

const s2 = ProductModel.create({
  name: 'Cloud Infrastructure & DevOps Setup',
  description: 'AWS/GCP production container orchestration & CI/CD pipeline setup',
  type: 'service',
  quantity: null,
  unit_price: 28000,
  tax_rate: 18
});

const s3 = ProductModel.create({
  name: 'UI/UX Interface Design & Prototyping',
  description: 'High-fidelity Figma system, component library, and responsive design',
  type: 'service',
  quantity: null,
  unit_price: 22000,
  tax_rate: 18
});

const s4 = ProductModel.create({
  name: 'Annual Software Maintenance (AMC)',
  description: 'Yearly system health monitoring, bug fixes, and security patches',
  type: 'service',
  quantity: null,
  unit_price: 36000,
  tax_rate: 18
});

const p1 = ProductModel.create({
  name: 'Enterprise VPN Router Gateway',
  description: 'Gigabit dual-band managed VPN hardware router for branch offices',
  type: 'product',
  quantity: 24,
  unit_price: 16500,
  tax_rate: 18
});

const p2 = ProductModel.create({
  name: 'Hardware Security Key USB-C',
  description: 'FIDO2 WebAuthn cryptographic two-factor physical authentication token',
  type: 'product',
  quantity: 85,
  unit_price: 4500,
  tax_rate: 18
});

// 4. Seed Invoices
console.log('Creating sample invoices and payments...');
const todayStr = getTodayString();
const issueToday = todayStr;
const dueIn15Days = getDateStringOffset(15);
const dueIn30Days = getDateStringOffset(30);

// Invoice 1: Paid (Full Payment terms)
const inv1 = InvoiceModel.create({
  invoice_number: 'INV-0001',
  customer_name: 'Ananya Deshmukh',
  company: 'Deshmukh FinTech Solutions',
  customer_email: 'ananya@deshmukhfintech.in',
  customer_phone: '9820123456',
  billing_address: 'Level 4, Bandra Kurla Complex, Bandra East, Mumbai 400051',
  issue_date: issueToday,
  due_date: dueIn15Days,
  payment_terms: 'full',
  status: 'paid',
  discount_total: 2000,
  notes: 'Thank you for your business. Full payment received on invoice generation.',
  items: [
    { product_id: s1.id, quantity: 1, unit_price: s1.unit_price, tax_rate: s1.tax_rate },
    { product_id: p2.id, quantity: 2, unit_price: p2.unit_price, tax_rate: p2.tax_rate }
  ]
}, admin.id);

PaymentModel.recordPayment({
  invoice_id: inv1.id,
  amount: inv1.grand_total,
  payment_date: issueToday,
  payment_method: 'bank_transfer',
  reference_note: 'NEFT-AXIS98234123 - Immediate settlement',
  recorded_by: admin.id
});

// Invoice 2: Partially Paid (Due / Credit terms)
const inv2 = InvoiceModel.create({
  invoice_number: 'INV-0002',
  customer_name: 'Rohan Mehra',
  company: 'Mehra Logistics Pvt. Ltd.',
  customer_email: 'rohan.mehra@mehralogistics.com',
  customer_phone: '9811223344',
  billing_address: 'Suite 201, Cyber Park, Sector 62, Noida, Uttar Pradesh 201309',
  issue_date: issueToday,
  due_date: dueIn30Days,
  payment_terms: 'credit',
  status: 'partial',
  discount_total: 0,
  notes: 'Payment terms: 50% advance upon project kickoff, balance within 30 days.',
  items: [
    { product_id: s2.id, quantity: 1, unit_price: s2.unit_price, tax_rate: s2.tax_rate },
    { product_id: p1.id, quantity: 1, unit_price: p1.unit_price, tax_rate: p1.tax_rate }
  ]
}, staff.id);

PaymentModel.recordPayment({
  invoice_id: inv2.id,
  amount: 25000,
  payment_date: issueToday,
  payment_method: 'bank_transfer',
  reference_note: 'IMPS Ref #893240192 - Part Advance',
  recorded_by: staff.id
});

// Invoice 3: Sent / Unpaid (Due / Credit terms)
const inv3 = InvoiceModel.create({
  invoice_number: 'INV-0003',
  customer_name: 'Kavita Menon',
  company: 'Menon Healthcare Systems',
  customer_email: 'kavita@menonhealth.org',
  customer_phone: '9447112233',
  billing_address: 'Infopark Phase 2, Kakkanad, Kochi, Kerala 682042',
  issue_date: issueToday,
  due_date: dueIn15Days,
  payment_terms: 'credit',
  status: 'sent',
  discount_total: 1500,
  notes: 'Standard net-15 payment terms. Please transfer to HDFC A/C.',
  items: [
    { product_id: s3.id, quantity: 1, unit_price: s3.unit_price, tax_rate: s3.tax_rate }
  ]
}, admin.id);

// Invoice 4: Draft
const inv4 = InvoiceModel.create({
  invoice_number: 'INV-0004',
  customer_name: 'Siddharth Roy',
  company: 'Bengal Analytics Labs',
  customer_email: 'siddharth@bengalanalytics.com',
  customer_phone: '9830112233',
  billing_address: 'Salt Lake Sector V, Bidhannagar, Kolkata, West Bengal 700091',
  issue_date: issueToday,
  due_date: dueIn30Days,
  payment_terms: 'credit',
  status: 'draft',
  discount_total: 0,
  notes: 'Draft estimate pending final approval on scope of work.',
  items: [
    { product_id: s4.id, quantity: 1, unit_price: s4.unit_price, tax_rate: s4.tax_rate }
  ]
}, staff.id);

// Invoice 5: Soft-deleted to test Trash
const inv5 = InvoiceModel.create({
  invoice_number: 'INV-0005',
  customer_name: 'Deepak Verma',
  company: 'Verma Traders',
  customer_email: 'deepak@vermatraders.in',
  customer_phone: '9711223344',
  billing_address: 'Chandni Chowk Commercial Complex, Delhi 110006',
  issue_date: issueToday,
  due_date: dueIn15Days,
  payment_terms: 'credit',
  status: 'draft',
  discount_total: 0,
  notes: 'Duplicate test invoice created by mistake.',
  items: [
    { product_id: p2.id, quantity: 1, unit_price: p2.unit_price, tax_rate: p2.tax_rate }
  ]
}, admin.id);

InvoiceModel.softDelete(inv5.id);

console.log('Database seeded successfully with typed products and services!');
console.log('Default credentials:');
console.log('  Admin: admin@apexbilling.com / Admin@123');
console.log('  Staff: staff@apexbilling.com / Staff@123');
