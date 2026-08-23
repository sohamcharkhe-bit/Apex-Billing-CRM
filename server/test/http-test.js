const assert = require('assert');
const path = require('path');
const fs = require('fs');

process.env.NODE_ENV = 'test';
process.env.DB_PATH = path.join(__dirname, 'test_http_apex_billing.sqlite');
process.env.PORT = '3099';

if (fs.existsSync(process.env.DB_PATH)) {
  fs.unlinkSync(process.env.DB_PATH);
}

const app = require('../server');
const UserModel = require('../models/userModel');
const ProductModel = require('../models/productModel');
const { getTodayString, getDateStringOffset } = require('../utils/validators');

async function testHttpEndpoints() {
  console.log('--- Running HTTP, CSRF & Fixes Integration Tests ---');
  
  const admin = UserModel.createUser({
    name: 'Admin HTTP',
    email: 'admin.http@apexbilling.com',
    password: 'AdminPassword123',
    role: 'admin',
    status: 'active'
  });

  const staff = UserModel.createUser({
    name: 'Staff HTTP',
    email: 'staff.http@apexbilling.com',
    password: 'StaffPassword123',
    role: 'staff',
    status: 'active'
  });

  const server = app.listen(3099);
  const todayStr = getTodayString();

  try {
    // 1. Test Login & Session Cookie & CSRF Token
    const loginRes = await fetch('http://localhost:3099/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin.http@apexbilling.com', password: 'AdminPassword123' })
    });

    assert.strictEqual(loginRes.status, 200);
    const loginData = await loginRes.json();
    assert.strictEqual(loginData.success, true);
    assert.ok(loginData.csrfToken);

    const cookie = loginRes.headers.get('set-cookie');
    assert.ok(cookie);

    // 2. FIX 1: Test creating user with number in name via HTTP (Must fail with 400)
    const badUserRes = await fetch('http://localhost:3099/api/users', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookie,
        'X-CSRF-Token': loginData.csrfToken
      },
      body: JSON.stringify({
        name: 'Staff1',
        email: 'staff1@apexbilling.com',
        password: 'Password123',
        role: 'staff'
      })
    });
    assert.strictEqual(badUserRes.status, 400);
    console.log('  ✓ PASS: FIX 1: User name containing numbers is rejected with 400');

    // 3. FIX 1 (Products): Reject product name containing digits via HTTP
    const badProductNameRes = await fetch('http://localhost:3099/api/products', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookie,
        'X-CSRF-Token': loginData.csrfToken
      },
      body: JSON.stringify({
        name: 'Firewall Model 500',   // Contains digits — must be rejected
        description: 'NextGen firewall appliance',
        type: 'product',
        quantity: 15,
        unit_price: 35000,
        tax_rate: 18
      })
    });
    assert.strictEqual(badProductNameRes.status, 400);
    console.log('  ✓ PASS: FIX 1 (Products): Product name with digits rejected with 400');

    // 3b. FIX 4 & FIX 5: Create Product with digit-free name and Quantity via HTTP
    const productRes = await fetch('http://localhost:3099/api/products', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookie,
        'X-CSRF-Token': loginData.csrfToken
      },
      body: JSON.stringify({
        name: 'Enterprise Firewall Appliance',
        description: 'NextGen firewall appliance',
        type: 'product',
        quantity: 15,
        unit_price: 35000,
        tax_rate: 18
      })
    });
    assert.strictEqual(productRes.status, 201);
    const productData = await productRes.json();
    assert.strictEqual(productData.product.type, 'product');
    assert.strictEqual(productData.product.quantity, 15);
    console.log('  ✓ PASS: FIX 4 & FIX 5: Product created with digit-free name and stock quantity via HTTP');

    // 4. FIX 1 & FIX 6: Create Invoice (rejecting number in customer name)
    const badInvoiceRes = await fetch('http://localhost:3099/api/invoices', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookie,
        'X-CSRF-Token': loginData.csrfToken
      },
      body: JSON.stringify({
        customer_name: 'John3',
        issue_date: todayStr,
        due_date: getDateStringOffset(15),
        payment_terms: 'credit',
        items: [{ product_id: productData.product.id, quantity: 1, unit_price: 35000, tax_rate: 18 }]
      })
    });
    assert.strictEqual(badInvoiceRes.status, 400);
    console.log('  ✓ PASS: FIX 1: Invoice customer name with numbers is rejected with 400');

    // Valid Invoice
    const validInvoiceRes = await fetch('http://localhost:3099/api/invoices', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookie,
        'X-CSRF-Token': loginData.csrfToken
      },
      body: JSON.stringify({
        customer_name: 'Harish Mehta',
        company: 'Mehta & Sons',
        issue_date: todayStr,
        due_date: getDateStringOffset(15),
        payment_terms: 'credit',
        items: [{ product_id: productData.product.id, quantity: 1, unit_price: 35000, tax_rate: 18 }]
      })
    });
    assert.strictEqual(validInvoiceRes.status, 201);
    console.log('  ✓ PASS: FIX 1 & FIX 6: Valid invoice created with catalog product reference');

    // 5. FIX 3: Reports invalid date range
    const badReportRes = await fetch(`http://localhost:3099/api/reports/revenue?startDate=${todayStr}&endDate=${getDateStringOffset(-10)}`, {
      headers: { 'Cookie': cookie }
    });
    assert.strictEqual(badReportRes.status, 400);
    console.log('  ✓ PASS: FIX 3: Report with To Date earlier than From Date is rejected with 400');

    console.log('All HTTP & Fixes integration tests completed successfully!\n');
  } finally {
    server.close();
  }
}

testHttpEndpoints().catch(err => {
  console.error('HTTP test error:', err);
  process.exit(1);
});
