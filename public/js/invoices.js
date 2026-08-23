/**
 * Apex Billing — Invoices List Management
 */

let activeInvoices = [];
let deleteTargetInvoiceId = null;
let deleteTargetInvoiceNum = '';

document.addEventListener('DOMContentLoaded', async () => {
  await initUserSession();
  loadInvoices();
  setupInvoiceEventListeners();
});

async function loadInvoices() {
  const tbody = document.getElementById('invoices-tbody');
  const search = document.getElementById('invoice-search')?.value.trim() || '';
  const status = document.getElementById('invoice-status-filter')?.value || 'all';

  try {
    const res = await apiFetch(`/api/invoices?search=${encodeURIComponent(search)}&status=${encodeURIComponent(status)}`);
    if (res && res.invoices) {
      activeInvoices = res.invoices;
      renderInvoicesTable(activeInvoices);
    }
  } catch (err) {
    showToast(err.message || 'Failed to load invoices.', 'error');
  }
}

function renderInvoicesTable(invoices) {
  const tbody = document.getElementById('invoices-tbody');
  if (!tbody) return;

  if (invoices.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="empty-state">No invoices found. Click "Create Invoice" to issue one.</td></tr>`;
    return;
  }

  tbody.innerHTML = invoices.map(inv => {
    const rowClass = inv.status === 'paid' ? 'row-paid' : (inv.status === 'overdue' ? 'row-overdue' : '');
    const termsLabel = inv.payment_terms === 'full' ? 'Full Payment' : 'Due / Credit';
    const isOverdue = inv.status === 'overdue';

    return `
      <tr class="${rowClass}">
        <td>
          <a href="/invoice-view.html?id=${inv.id}" style="font-family: var(--font-mono); font-weight: 700; color: var(--primary);">
            ${escapeHtml(inv.invoice_number)}
          </a>
        </td>
        <td>
          <div style="font-weight: 600;">${escapeHtml(inv.customer_name)}</div>
          ${inv.company ? `<div style="font-size: 11px; color: var(--text-dim);">${escapeHtml(inv.company)}</div>` : ''}
        </td>
        <td>${formatDate(inv.issue_date)}</td>
        <td style="${isOverdue ? 'color: var(--warning); font-weight: 600;' : ''}">${formatDate(inv.due_date)}</td>
        <td>
          <span style="font-size: 11px; color: var(--text-muted);">${termsLabel}</span>
        </td>
        <td style="font-weight: 700;">${formatRupee(inv.grand_total)}</td>
        <td>${renderStatusBadge(inv.status)}</td>
        <td style="text-align: right;">
          <div style="display: inline-flex; gap: 6px;">
            <a href="/invoice-view.html?id=${inv.id}" class="btn btn-secondary btn-sm" title="View details">View</a>
            <a href="/invoice-edit.html?id=${inv.id}" class="btn btn-secondary btn-sm" title="Edit invoice">Edit</a>
            <a href="/invoice-print.html?id=${inv.id}" target="_blank" class="btn btn-secondary btn-sm" title="Print invoice">Print</a>
            <button class="btn btn-danger btn-sm btn-trash-invoice" data-id="${inv.id}" data-num="${escapeHtml(inv.invoice_number)}" title="Move to Trash">Trash</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function setupInvoiceEventListeners() {
  const searchInput = document.getElementById('invoice-search');
  const statusSelect = document.getElementById('invoice-status-filter');

  let debounceTimer = null;
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => loadInvoices(), 250);
    });
  }

  if (statusSelect) {
    statusSelect.addEventListener('change', () => loadInvoices());
  }

  const tbody = document.getElementById('invoices-tbody');
  if (tbody) {
    tbody.addEventListener('click', (e) => {
      const trashBtn = e.target.closest('.btn-trash-invoice');
      if (trashBtn) {
        deleteTargetInvoiceId = trashBtn.getAttribute('data-id');
        deleteTargetInvoiceNum = trashBtn.getAttribute('data-num');
        document.getElementById('trash-invoice-number').textContent = deleteTargetInvoiceNum;
        openModal('trash-confirm-modal');
      }
    });
  }

  const confirmTrashBtn = document.getElementById('btn-confirm-trash');
  if (confirmTrashBtn) {
    confirmTrashBtn.addEventListener('click', async () => {
      if (!deleteTargetInvoiceId) return;
      confirmTrashBtn.disabled = true;
      try {
        await apiFetch(`/api/invoices/${deleteTargetInvoiceId}`, { method: 'DELETE' });
        showToast(`Invoice ${deleteTargetInvoiceNum} moved to Trash.`, 'success');
        closeModal('trash-confirm-modal');
        loadInvoices();
      } catch (err) {
        showToast(err.message || 'Failed to move invoice to Trash.', 'error');
      } finally {
        confirmTrashBtn.disabled = false;
        deleteTargetInvoiceId = null;
      }
    });
  }
}
