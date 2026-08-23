# Apex Billing — Billing & Invoice Management System

Apex Billing is a modern, finance-grade Billing & Invoice Management System built with **Node.js**, **Express**, **SQLite**, and **Vanilla HTML5/CSS3/JavaScript** using the **Orbital Dark** design theme.

---

## Key Features

1. **Orbital Dark UI & Command Center**: Restrained dark theme (`#0B0C0F`, `#14161B`, `#6C7CFF`, `#2DD4A8`, `#F59E0B`, `#F43F5E`) with responsive layout, ambient glow accents, and table indicators.
2. **Product & Service Management**: Full CRUD for products and services with pre-configured unit prices and GST tax rates.
3. **Invoice Creation & Authoritative Calculation**:
   - Customer billing details stored directly on invoices (no separate client module per specification).
   - Multi-line invoice items with dynamic add/remove, quantity, unit price, and tax calculation.
   - **Server-Side Truth**: Totals, taxes, and discounts are independently calculated and verified in Node.js before database persistence.
4. **Payment Terms (§21)**:
   - **Full Payment**: Instant automated settlement flow pre-filled with the grand total, updating status immediately to `paid`.
   - **Due / Credit**: Credit terms with automatic due date tracking and live overdue status evaluation.
5. **Datepicker Constraints (§25)**:
   - No past dates allowed (earliest selectable is today).
   - Maximum 1-year forward limit.
   - Due Date must be greater than or equal to Issue Date (enforced client- and server-side).
6. **Payment System & Overpayment Protection (§19, §22)**:
   - Record partial or full payments.
   - Database transactions strictly prevent payments exceeding remaining balances (`amount <= remaining_balance`).
   - Append-only payment audit trail.
7. **Invoice Trash, Recovery & Permanent Purge (§26-§30)**:
   - Soft deletion (`deleted_at = CURRENT_TIMESTAMP`) excluding trashed records from revenue and outstanding reports.
   - Authorized users can restore invoices from Trash.
   - **Admin Only**: Permanently empty trash, cascading removal of invoices, line items, and payments inside a transaction.
8. **Financial Reports & CSV Export (§40, §41)**:
   - Revenue Report with custom date range filtering and UTF-8 CSV export.
   - Outstanding Receivables Report with live overdue tracking and CSV export.
9. **Staff & User Management (§4, §33)**:
   - Role-based authorization (`admin` vs `staff`) enforced via Express middleware.
   - Admin control panel to add staff, modify roles, and toggle account activation.
10. **Printable Invoices & PDF Generation (§42, §43)**:
    - Dedicated paper-friendly printable invoice view (`invoice-print.html` + `invoice-print.css`).
    - Server-side branded PDF generator using PDFKit.

---

## Security Architecture

- **Authentication**: Passwords hashed with `bcryptjs` (salt rounds: 10).
- **Session Security**: Session fixation protection (`req.session.regenerate()`), inactivity timeout (60 minutes), HttpOnly and Lax cookies.
- **CSRF Defense**: Cryptographically random CSRF tokens generated per session, verified on all mutating routes (`POST`, `PUT`, `DELETE`) via `X-CSRF-Token` headers.
- **SQL Injection Prevention**: 100% parameterized SQLite statements (`db.prepare()`).
- **XSS Escaping**: Safe DOM text insertion and HTML escaping helpers (`escapeHtml`).
- **Data Integrity**: Database transactions (`db.transaction()`) wrapping all multi-step financial and lifecycle actions.

---

## Demo Credentials

| Role | Email | Password | Access Level |
|---|---|---|---|
| **Admin** | `admin@apexbilling.com` | `Admin@123` | Full administrative access, User management, Empty Trash |
| **Staff** | `staff@apexbilling.com` | `Staff@123` | Standard billing, Products, Invoices, Payments, Reports, Restore |

---

## Quick Start

### 1. Installation
```bash
npm install
```

### 2. Seed Database
Populates the SQLite database with sample users, product catalog, invoices, and payments:
```bash
npm run seed
```

### 3. Start Application
```bash
npm start
```
Visit `http://localhost:3000` in your web browser.

### 4. Run Automated Test Suite
```bash
npm test
```

---

## Deployment (Render)

Apex Billing is architected as a **single Node.js/Express service** serving both the static frontend (`/public`) and the `/api/...` JSON REST endpoints from the same origin:

1. Create a Web Service on [Render](https://render.com).
2. Set Environment: `Node`.
3. Build Command: `npm install && npm run seed`
4. Start Command: `npm start`
5. Attach a **Persistent Disk** (e.g. mount path `/data`) and set `DB_PATH=/data/apex_billing.sqlite` in Render Environment Variables.
6. Set `SESSION_SECRET` to a strong random key and `NODE_ENV=production`.
