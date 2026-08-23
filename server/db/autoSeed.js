/**
 * Apex Billing — Automatic Initializer
 * Automatically seeds default Admin & Staff accounts and catalog items
 * if the database has 0 users on server startup.
 */

function autoSeedIfEmpty(db) {
  if (process.env.NODE_ENV === 'test') return;

  try {
    const userRow = db.prepare('SELECT COUNT(*) as count FROM users').get();
    if (userRow && userRow.count === 0) {
      console.log('--- Initializing default Apex Billing admin & demo data ---');
      const UserModel = require('../models/userModel');
      const ProductModel = require('../models/productModel');
      const InvoiceModel = require('../models/invoiceModel');
      const PaymentModel = require('../models/paymentModel');
      const { getTodayString, getDateStringOffset } = require('../utils/validators');

      // 1. Seed Users
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

      // 2. Seed Products & Services
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
        name: 'Annual Software Maintenance',
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

      // 3. Seed Sample Invoices
      const todayStr = getTodayString();
      const dueIn15Days = getDateStringOffset(15);
      const dueIn30Days = getDateStringOffset(30);

      const inv1 = InvoiceModel.create({
        invoice_number: 'INV-0001',
        customer_name: 'Ananya Deshmukh',
        company: 'Deshmukh FinTech Solutions',
        customer_email: 'ananya@deshmukhfintech.in',
        customer_phone: '9820123456',
        billing_address: 'Level 4, Bandra Kurla Complex, Bandra East, Mumbai 400051',
        issue_date: todayStr,
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
        payment_date: todayStr,
        payment_method: 'bank_transfer',
        reference_note: 'NEFT-AXIS98234123 - Immediate settlement',
        recorded_by: admin.id
      });

      const inv2 = InvoiceModel.create({
        invoice_number: 'INV-0002',
        customer_name: 'Rohan Mehra',
        company: 'Mehra Logistics Pvt. Ltd.',
        customer_email: 'rohan.mehra@mehralogistics.com',
        customer_phone: '9811223344',
        billing_address: 'Suite 201, Cyber Park, Sector 62, Noida, Uttar Pradesh 201309',
        issue_date: todayStr,
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
        payment_date: todayStr,
        payment_method: 'bank_transfer',
        reference_note: 'IMPS Ref #893240192 - Part Advance',
        recorded_by: staff.id
      });

      console.log('✓ Default Admin account initialized: admin@apexbilling.com / Admin@123');
      console.log('✓ Default Staff account initialized: staff@apexbilling.com / Staff@123');
    }
  } catch (err) {
    console.error('AutoSeed check notice:', err.message);
  }
}

module.exports = autoSeedIfEmpty;
