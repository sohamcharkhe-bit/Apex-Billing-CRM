/**
 * Apex Billing — Invoice Detail & Payment Recording Controller
 */

let currentInvoice = null;

document.addEventListener('DOMContentLoaded', async () => {
  await initUserSession();
  const urlParams = new URLSearchParams(window.location.search);
  const id = urlParams.get('id');

  if (!id) {
    showToast('No invoice specified.', 'error');
    window.location.href = '/invoices.html';
    return;
  }

  await loadInvoiceDetail(id);
  setupInvoiceViewEvents();
});

async function loadInvoiceDetail(id) {
  try {
    const res = await apiFetch(`/api/invoices/${id}`);
    if (!res || !res.invoice) {
      showToast('Invoice not found.', 'error');
      window.location.href = '/invoices.html';
      return;
    }

    currentInvoice = res.invoice;
    renderInvoice(currentInvoice);
  } catch (err) {
    showToast(err.message || 'Error loading invoice.', 'error');
  }
}

function renderInvoice(inv) {
  // Page Title & Badges
  document.getElementById('view-invoice-number').textContent = inv.invoice_number;
  document.getElementById('view-invoice-status-badge').innerHTML = renderStatusBadge(inv.status);
  
  const termsLabel = inv.payment_terms === 'full' ? 'Full Payment' : 'Due / Credit';
  document.getElementById('view-payment-terms').textContent = termsLabel;

  // Customer Information
  document.getElementById('cust-name').textContent = inv.customer_name;
  document.getElementById('cust-company').textContent = inv.company || '-';
  document.getElementById('cust-email').textContent = inv.customer_email || '-';
  document.getElementById('cust-phone').textContent = normalizeIndianPhone(inv.customer_phone);
  document.getElementById('cust-address').textContent = inv.billing_address || '-';

  // Invoice Dates
  document.getElementById('view-issue-date').textContent = formatDate(inv.issue_date);
  document.getElementById('view-due-date').textContent = formatDate(inv.due_date);

  // Line Items
  const itemsTbody = document.getElementById('view-items-tbody');
  itemsTbody.innerHTML = inv.items.map((item, idx) => `
    <tr>
      <td>${idx + 1}</td>
      <td>
        <div style="font-weight: 600;">${escapeHtml(item.description)}</div>
      </td>
      <td>${formatNumber(item.quantity)}</td>
      <td>${formatRupee(item.unit_price)}</td>
      <td>${formatNumber(item.tax_rate, true)}</td>
      <td style="font-weight: 700; text-align: right;">${formatRupee(item.line_total)}</td>
    </tr>
  `).join('');

  // Financial Breakdown
  document.getElementById('view-subtotal').textContent = formatRupee(inv.subtotal);
  document.getElementById('view-tax-total').textContent = formatRupee(inv.tax_total);
  
  const discRow = document.getElementById('view-discount-row');
  if (Number(inv.discount_total) > 0) {
    discRow.style.display = 'flex';
    document.getElementById('view-discount-total').textContent = `- ${formatRupee(inv.discount_total)}`;
  } else {
    discRow.style.display = 'none';
  }

  document.getElementById('view-grand-total').textContent = formatRupee(inv.grand_total);
  document.getElementById('view-paid-amount').textContent = formatRupee(inv.paid_amount);
  document.getElementById('view-balance-due').textContent = formatRupee(inv.remaining_balance);

  // Notes
  const notesContainer = document.getElementById('view-notes-container');
  if (inv.notes) {
    notesContainer.style.display = 'block';
    document.getElementById('view-notes').textContent = inv.notes;
  } else {
    notesContainer.style.display = 'none';
  }

  // Payment History
  renderPaymentHistory(inv.payments || []);

  // Action Buttons
  const btnRecordPay = document.getElementById('btn-open-payment-modal');
  if (btnRecordPay) {
    if (inv.remaining_balance <= 0 || inv.status === 'paid' || inv.status === 'cancelled') {
      btnRecordPay.style.display = 'none';
    } else {
      btnRecordPay.style.display = 'inline-flex';
    }
  }

  // Action URLs
  document.getElementById('btn-print-invoice').href = `/invoice-print.html?id=${inv.id}`;
  document.getElementById('btn-download-pdf').href = `/api/invoices/${inv.id}/pdf`;
  document.getElementById('btn-edit-invoice').href = `/invoice-edit.html?id=${inv.id}`;
}

function renderPaymentHistory(payments) {
  const tbody = document.getElementById('view-payments-tbody');
  if (!tbody) return;

  if (payments.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="empty-state">No payments have been recorded for this invoice.</td></tr>`;
    return;
  }

  tbody.innerHTML = payments.map(p => `
    <tr>
      <td>${formatDate(p.payment_date)}</td>
      <td><span class="badge" style="background: var(--surface-elevated); color: var(--text-muted);">${escapeHtml(p.payment_method.toUpperCase())}</span></td>
      <td>${escapeHtml(p.reference_note || '-')}</td>
      <td>${escapeHtml(p.recorded_by_name || 'Staff')}</td>
      <td style="font-weight: 700; color: var(--success); text-align: right;">+ ${formatRupee(p.amount)}</td>
    </tr>
  `).join('');
}

function setupInvoiceViewEvents() {
  // Open Payment Modal
  const btnRecord = document.getElementById('btn-open-payment-modal');
  if (btnRecord) {
    btnRecord.addEventListener('click', () => {
      if (!currentInvoice) return;
      document.getElementById('pay-balance-display').textContent = formatRupee(currentInvoice.remaining_balance);
      document.getElementById('pay-amount').value = currentInvoice.remaining_balance;
      document.getElementById('pay-amount').max = currentInvoice.remaining_balance;
      
      const now = new Date();
      const y = now.getFullYear();
      const m = String(now.getMonth() + 1).padStart(2, '0');
      const d = String(now.getDate()).padStart(2, '0');
      const todayStr = `${y}-${m}-${d}`;

      const maxDate = new Date();
      maxDate.setDate(maxDate.getDate() + 365);
      const my = maxDate.getFullYear();
      const mm = String(maxDate.getMonth() + 1).padStart(2, '0');
      const md = String(maxDate.getDate()).padStart(2, '0');
      const maxDateStr = `${my}-${mm}-${md}`;

      const payDateInput = document.getElementById('pay-date');
      payDateInput.min = todayStr;
      payDateInput.max = maxDateStr;
      payDateInput.value = todayStr;
      
      openModal('payment-modal');
    });
  }

  // Submit Payment
  const payForm = document.getElementById('payment-form');
  if (payForm) {
    payForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!currentInvoice) return;

      const amount = parseFloat(document.getElementById('pay-amount').value);
      const payment_date = document.getElementById('pay-date').value;
      const payment_method = document.getElementById('pay-method').value;
      const reference_note = document.getElementById('pay-reference').value.trim();

      if (isNaN(amount) || amount <= 0) {
        showToast('Please enter a valid payment amount.', 'warning');
        return;
      }

      if (amount > currentInvoice.remaining_balance + 0.001) {
        showToast(`Payment amount (${formatRupee(amount)}) exceeds remaining balance (${formatRupee(currentInvoice.remaining_balance)}).`, 'error');
        return;
      }

      const submitBtn = document.getElementById('btn-save-payment');
      submitBtn.disabled = true;

      try {
        await apiFetch('/api/payments', {
          method: 'POST',
          body: JSON.stringify({
            invoice_id: currentInvoice.id,
            amount,
            payment_date,
            payment_method,
            reference_note
          })
        });

        showToast(`Payment of ${formatRupee(amount)} recorded successfully.`, 'success');
        closeModal('payment-modal');
        await loadInvoiceDetail(currentInvoice.id);
      } catch (err) {
        showToast(err.message || 'Failed to record payment.', 'error');
      } finally {
        submitBtn.disabled = false;
      }
    });
  }

  // Move to Trash
  const btnTrash = document.getElementById('btn-trash-view-invoice');
  if (btnTrash) {
    btnTrash.addEventListener('click', () => {
      if (!currentInvoice) return;
      document.getElementById('trash-invoice-num-modal').textContent = currentInvoice.invoice_number;
      openModal('trash-modal');
    });
  }

  const btnConfirmTrash = document.getElementById('btn-confirm-view-trash');
  if (btnConfirmTrash) {
    btnConfirmTrash.addEventListener('click', async () => {
      if (!currentInvoice) return;
      btnConfirmTrash.disabled = true;
      try {
        await apiFetch(`/api/invoices/${currentInvoice.id}`, { method: 'DELETE' });
        showToast(`Invoice ${currentInvoice.invoice_number} moved to Trash.`, 'success');
        window.location.href = '/invoices.html';
      } catch (err) {
        showToast(err.message || 'Failed to move invoice to Trash.', 'error');
        btnConfirmTrash.disabled = false;
      }
    });
  }
}
