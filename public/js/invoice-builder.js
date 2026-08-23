/**
 * Apex Billing — Invoice Builder & Editor Controller
 * Handles grouped catalog selection (Fix 6), name regex validation (Fix 1), and forward date bounds (Fix 2).
 */

let productCatalog = [];
let isEditMode = false;
let editingInvoiceId = null;
let selectedPaymentTerms = 'credit'; // Default: 'credit'

document.addEventListener('DOMContentLoaded', async () => {
  await initUserSession();
  setupDateConstraints();
  setupRegexValidationListeners();
  await loadProductCatalog();

  const urlParams = new URLSearchParams(window.location.search);
  editingInvoiceId = urlParams.get('id');
  if (editingInvoiceId) {
    isEditMode = true;
    document.getElementById('builder-page-title').textContent = 'Edit Invoice';
    await loadExistingInvoice(editingInvoiceId);
  } else {
    // Add default first item row
    addLineItem();
  }

  setupBuilderEvents();
});

/**
 * FIX 1: Attach blur validation listeners to Customer Name and Company.
 */
function setupRegexValidationListeners() {
  const nameInput = document.getElementById('customer_name');
  const nameError = document.getElementById('customer_name_error');
  const companyInput = document.getElementById('company');
  const companyError = document.getElementById('company_error');

  const personRegex = /^[A-Za-z\s.'-]+$/;
  const companyRegex = /^[A-Za-z\s.'&,-]+$/;

  if (nameInput && nameError) {
    nameInput.addEventListener('blur', () => {
      const val = nameInput.value.trim();
      if (val && !personRegex.test(val)) {
        nameError.style.display = 'block';
      } else {
        nameError.style.display = 'none';
      }
    });
  }

  if (companyInput && companyError) {
    companyInput.addEventListener('blur', () => {
      const val = companyInput.value.trim();
      if (val && !companyRegex.test(val)) {
        companyError.style.display = 'block';
      } else {
        companyError.style.display = 'none';
      }
    });
  }
}

/**
 * FIX 2 & Section 25 Date Constraints on the frontend.
 */
function setupDateConstraints() {
  const issueInput = document.getElementById('issue_date');
  const dueInput = document.getElementById('due_date');

  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const todayStr = `${year}-${month}-${day}`;

  const maxDate = new Date();
  maxDate.setDate(maxDate.getDate() + 365);
  const maxYear = maxDate.getFullYear();
  const maxMonth = String(maxDate.getMonth() + 1).padStart(2, '0');
  const maxDay = String(maxDate.getDate()).padStart(2, '0');
  const maxDateStr = `${maxYear}-${maxMonth}-${maxDay}`;

  if (issueInput) {
    issueInput.min = todayStr;
    issueInput.max = maxDateStr;
    if (!issueInput.value) issueInput.value = todayStr;
  }

  if (dueInput) {
    dueInput.min = todayStr;
    dueInput.max = maxDateStr;
    if (!dueInput.value) {
      const due15 = new Date();
      due15.setDate(due15.getDate() + 15);
      const dy = due15.getFullYear();
      const dm = String(due15.getMonth() + 1).padStart(2, '0');
      const dd = String(due15.getDate()).padStart(2, '0');
      dueInput.value = `${dy}-${dm}-${dd}`;
    }
  }

  if (issueInput && dueInput) {
    issueInput.addEventListener('change', () => {
      dueInput.min = issueInput.value;
      if (dueInput.value < issueInput.value) {
        dueInput.value = issueInput.value;
      }
    });
  }
}

async function loadProductCatalog() {
  try {
    const res = await apiFetch('/api/products');
    if (res && res.products) {
      productCatalog = res.products;
    }
  } catch (err) {
    console.error('Failed to load product catalog', err);
  }
}

async function loadExistingInvoice(id) {
  try {
    const res = await apiFetch(`/api/invoices/${id}`);
    if (!res || !res.invoice) {
      showToast('Invoice not found.', 'error');
      window.location.href = '/invoices.html';
      return;
    }

    const inv = res.invoice;
    document.getElementById('customer_name').value = inv.customer_name || '';
    document.getElementById('company').value = inv.company || '';
    document.getElementById('customer_email').value = inv.customer_email || '';
    document.getElementById('customer_phone').value = inv.customer_phone || '';
    document.getElementById('billing_address').value = inv.billing_address || '';
    document.getElementById('issue_date').value = inv.issue_date;
    document.getElementById('due_date').value = inv.due_date;
    document.getElementById('discount_total').value = inv.discount_total || 0;
    document.getElementById('notes').value = inv.notes || '';

    setPaymentTerms(inv.payment_terms || 'credit');

    // Populate items
    const container = document.getElementById('line-items-container');
    container.innerHTML = '';
    if (inv.items && inv.items.length > 0) {
      inv.items.forEach(item => addLineItem(item));
    } else {
      addLineItem();
    }

    recalculateTotals();
  } catch (err) {
    showToast(err.message || 'Error loading invoice.', 'error');
  }
}

function setPaymentTerms(term) {
  selectedPaymentTerms = term;
  const fullBtn = document.getElementById('term-btn-full');
  const creditBtn = document.getElementById('term-btn-credit');

  if (term === 'full') {
    if (fullBtn) fullBtn.classList.add('active', 'btn-term-full');
    if (creditBtn) creditBtn.classList.remove('active', 'btn-term-credit');
  } else {
    if (creditBtn) creditBtn.classList.add('active', 'btn-term-credit');
    if (fullBtn) fullBtn.classList.remove('active', 'btn-term-full');
  }
}

/**
 * FIX 6: Builds grouped optgroups (Products vs Services) for the catalog dropdown.
 */
function buildCatalogOptions(selectedId = null) {
  const products = productCatalog.filter(p => p.type === 'product');
  const services = productCatalog.filter(p => p.type === 'service');

  let html = '<option value="">-- Choose Product or Service --</option>';

  if (products.length > 0) {
    html += '<optgroup label="Products (Physical Stock)">';
    products.forEach(p => {
      const isSel = selectedId && String(selectedId) === String(p.id) ? 'selected' : '';
      const stockInfo = p.quantity !== null ? ` [${p.quantity} in stock]` : '';
      html += `<option value="${p.id}" ${isSel}>${escapeHtml(p.name)}${stockInfo} — ${formatRupee(p.unit_price)}</option>`;
    });
    html += '</optgroup>';
  }

  if (services.length > 0) {
    html += '<optgroup label="Services (Professional)">';
    services.forEach(s => {
      const isSel = selectedId && String(selectedId) === String(s.id) ? 'selected' : '';
      html += `<option value="${s.id}" ${isSel}>${escapeHtml(s.name)} — ${formatRupee(s.unit_price)}</option>`;
    });
    html += '</optgroup>';
  }

  return html;
}

/**
 * FIX 6: Adds line item row without free-text description box, with description preview.
 */
function addLineItem(data = null) {
  const container = document.getElementById('line-items-container');
  if (!container) return;

  const row = document.createElement('div');
  row.className = 'item-row';

  const selectedProdId = data ? data.product_id : null;
  const initialOptions = buildCatalogOptions(selectedProdId);

  let initialDesc = '';
  if (data) {
    initialDesc = data.description || '';
  }

  row.innerHTML = `
    <div>
      <select class="item-product-select" required>
        ${initialOptions}
      </select>
      <div class="item-desc-preview">${escapeHtml(initialDesc || 'Select an item to view catalog details')}</div>
    </div>
    <div>
      <input type="number" class="item-qty" placeholder="Qty" min="0.01" step="any" value="${data ? data.quantity : 1}" required />
    </div>
    <div>
      <input type="number" class="item-price" placeholder="Price" min="0" step="any" value="${data ? data.unit_price : 0}" required />
    </div>
    <div>
      <input type="number" class="item-tax" placeholder="Tax %" min="0" max="100" step="any" value="${data ? data.tax_rate : 18}" />
    </div>
    <div>
      <input type="text" class="item-total" readonly value="${data ? formatRupee(data.line_total) : '₹0'}" style="background: var(--surface); border-color: transparent; font-weight: 600; text-align: right;" />
    </div>
    <div>
      <button type="button" class="btn btn-danger btn-icon btn-remove-item" title="Remove row">
        <svg viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12"></path></svg>
      </button>
    </div>
  `;

  // Attach product select change handler
  const select = row.querySelector('.item-product-select');
  const preview = row.querySelector('.item-desc-preview');

  select.addEventListener('change', (e) => {
    const prodId = e.target.value;
    if (prodId) {
      const item = productCatalog.find(p => String(p.id) === String(prodId));
      if (item) {
        preview.textContent = item.description ? `${item.name} — ${item.description}` : item.name;
        row.querySelector('.item-price').value = item.unit_price;
        row.querySelector('.item-tax').value = item.tax_rate;
        recalculateTotals();
      }
    } else {
      preview.textContent = 'Select an item to view catalog details';
      row.querySelector('.item-price').value = 0;
      recalculateTotals();
    }
  });

  // Attach input listeners for live totals
  row.querySelectorAll('input').forEach(inp => {
    inp.addEventListener('input', recalculateTotals);
  });

  // Remove row handler
  row.querySelector('.btn-remove-item').addEventListener('click', () => {
    if (container.querySelectorAll('.item-row').length > 1) {
      row.remove();
      recalculateTotals();
    } else {
      showToast('Invoice must have at least one line item.', 'warning');
    }
  });

  container.appendChild(row);
  recalculateTotals();
}

function recalculateTotals() {
  let subtotal = 0;
  let taxTotal = 0;

  const rows = document.querySelectorAll('.item-row');
  rows.forEach(row => {
    const qty = Math.max(0, parseFloat(row.querySelector('.item-qty').value) || 0);
    const price = Math.max(0, parseFloat(row.querySelector('.item-price').value) || 0);
    const taxRate = Math.max(0, parseFloat(row.querySelector('.item-tax').value) || 0);

    const lineSubtotal = qty * price;
    const lineTax = lineSubtotal * (taxRate / 100);
    const lineTotal = lineSubtotal + lineTax;

    subtotal += lineSubtotal;
    taxTotal += lineTax;

    row.querySelector('.item-total').value = formatRupee(lineTotal);
  });

  const discount = Math.max(0, parseFloat(document.getElementById('discount_total')?.value) || 0);
  const grandTotal = Math.max(0, subtotal + taxTotal - discount);

  const subEl = document.getElementById('calc-subtotal');
  const taxEl = document.getElementById('calc-tax-total');
  const grandEl = document.getElementById('calc-grand-total');

  if (subEl) subEl.textContent = formatRupee(subtotal);
  if (taxEl) taxEl.textContent = formatRupee(taxTotal);
  if (grandEl) grandEl.textContent = formatRupee(grandTotal);

  return grandTotal;
}

function setupBuilderEvents() {
  const addRowBtn = document.getElementById('btn-add-item-row');
  if (addRowBtn) {
    addRowBtn.addEventListener('click', () => addLineItem());
  }

  const discountInput = document.getElementById('discount_total');
  if (discountInput) {
    discountInput.addEventListener('input', recalculateTotals);
  }

  const fullBtn = document.getElementById('term-btn-full');
  const creditBtn = document.getElementById('term-btn-credit');

  if (fullBtn) {
    fullBtn.addEventListener('click', () => setPaymentTerms('full'));
  }
  if (creditBtn) {
    creditBtn.addEventListener('click', () => setPaymentTerms('credit'));
  }

  const form = document.getElementById('invoice-builder-form');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      await submitInvoice();
    });
  }
}

async function submitInvoice() {
  const customer_name = document.getElementById('customer_name').value.trim();
  const company = document.getElementById('company').value.trim();
  const customer_email = document.getElementById('customer_email').value.trim();
  const customer_phone = document.getElementById('customer_phone').value.trim();
  const billing_address = document.getElementById('billing_address').value.trim();
  const issue_date = document.getElementById('issue_date').value;
  const due_date = document.getElementById('due_date').value;
  const discount_total = parseFloat(document.getElementById('discount_total').value || '0');
  const notes = document.getElementById('notes').value.trim();

  // FIX 1: Frontend regex check
  const personRegex = /^[A-Za-z\s.'-]+$/;
  if (!personRegex.test(customer_name)) {
    showToast('Customer Name cannot contain numbers or special characters (letters, spaces, ., -, \' only).', 'error');
    document.getElementById('customer_name_error').style.display = 'block';
    return;
  }

  const companyRegex = /^[A-Za-z\s.'&,-]+$/;
  if (company && !companyRegex.test(company)) {
    showToast('Company Name cannot contain numbers.', 'error');
    document.getElementById('company_error').style.display = 'block';
    return;
  }

  // Gather line items
  const items = [];
  const rows = document.querySelectorAll('.item-row');
  let missingSelection = false;

  rows.forEach((row, idx) => {
    const prodSelect = row.querySelector('.item-product-select');
    const prodId = prodSelect && prodSelect.value ? parseInt(prodSelect.value, 10) : null;
    const qty = parseFloat(row.querySelector('.item-qty').value);
    const price = parseFloat(row.querySelector('.item-price').value);
    const tax = parseFloat(row.querySelector('.item-tax').value || '0');

    if (!prodId) {
      missingSelection = true;
    }

    items.push({
      product_id: prodId,
      quantity: qty,
      unit_price: price,
      tax_rate: tax
    });
  });

  if (missingSelection || items.length === 0) {
    showToast('Please select a valid Product or Service for every line item.', 'error');
    return;
  }

  const payload = {
    customer_name,
    company,
    customer_email,
    customer_phone,
    billing_address,
    issue_date,
    due_date,
    payment_terms: selectedPaymentTerms,
    discount_total,
    notes,
    items
  };

  const submitBtn = document.getElementById('btn-save-invoice');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Saving Invoice...';

  try {
    let savedInvoice = null;

    if (isEditMode && editingInvoiceId) {
      const res = await apiFetch(`/api/invoices/${editingInvoiceId}`, {
        method: 'PUT',
        body: JSON.stringify(payload)
      });
      savedInvoice = res.invoice;
      showToast('Invoice updated successfully.', 'success');
      window.location.href = `/invoice-view.html?id=${savedInvoice.id}`;
    } else {
      const res = await apiFetch('/api/invoices', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      savedInvoice = res.invoice;

      if (selectedPaymentTerms === 'full' && savedInvoice) {
        showToast('Invoice created. Processing Full Payment...', 'info');
        try {
          await apiFetch('/api/payments', {
            method: 'POST',
            body: JSON.stringify({
              invoice_id: savedInvoice.id,
              amount: savedInvoice.grand_total,
              payment_date: savedInvoice.issue_date,
              payment_method: 'bank_transfer',
              reference_note: 'Full payment received at invoice finalization'
            })
          });
          showToast(`Full payment of ${formatRupee(savedInvoice.grand_total)} recorded. Status: Paid.`, 'success');
        } catch (payErr) {
          showToast(`Invoice created, but payment note: ${payErr.message}`, 'warning');
        }
      } else {
        showToast(`Invoice ${savedInvoice.invoice_number} finalized with Due/Credit terms.`, 'success');
      }

      window.location.href = `/invoice-view.html?id=${savedInvoice.id}`;
    }
  } catch (err) {
    showToast(err.message || 'Failed to save invoice.', 'error');
    submitBtn.disabled = false;
    submitBtn.textContent = isEditMode ? 'Update Invoice' : 'Finalize & Save Invoice';
  }
}
