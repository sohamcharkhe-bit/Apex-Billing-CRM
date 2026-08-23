/**
 * Apex Billing — Invoice Trash & Restore Management
 */

let trashedInvoices = [];

document.addEventListener('DOMContentLoaded', async () => {
  await initUserSession();
  loadTrash();
  setupTrashEvents();
});

async function loadTrash() {
  const tbody = document.getElementById('trash-tbody');
  const emptyTrashBtn = document.getElementById('btn-empty-trash');

  try {
    const res = await apiFetch('/api/invoices/trash');
    if (res && res.invoices) {
      trashedInvoices = res.invoices;
      renderTrashTable(trashedInvoices);

      if (emptyTrashBtn) {
        if (currentUser && currentUser.role === 'admin' && trashedInvoices.length > 0) {
          emptyTrashBtn.style.display = 'inline-flex';
        } else {
          emptyTrashBtn.style.display = 'none';
        }
      }
    }
  } catch (err) {
    showToast(err.message || 'Failed to load Trash.', 'error');
  }
}

function renderTrashTable(invoices) {
  const tbody = document.getElementById('trash-tbody');
  if (!tbody) return;

  if (invoices.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="empty-state">Trash is empty. No deleted invoices.</td></tr>`;
    return;
  }

  tbody.innerHTML = invoices.map(inv => `
    <tr>
      <td style="font-family: var(--font-mono); font-weight: 600;">${escapeHtml(inv.invoice_number)}</td>
      <td>
        <div style="font-weight: 600;">${escapeHtml(inv.customer_name)}</div>
        ${inv.company ? `<div style="font-size: 11px; color: var(--text-dim);">${escapeHtml(inv.company)}</div>` : ''}
      </td>
      <td>${formatDate(inv.issue_date)}</td>
      <td>${formatDate(inv.deleted_at ? inv.deleted_at.slice(0, 10) : '')}</td>
      <td style="font-weight: 700;">${formatRupee(inv.grand_total)}</td>
      <td>${renderStatusBadge(inv.status)}</td>
      <td style="text-align: right;">
        <button class="btn btn-primary btn-sm btn-restore-invoice" data-id="${inv.id}" data-num="${escapeHtml(inv.invoice_number)}">Restore</button>
      </td>
    </tr>
  `).join('');
}

function setupTrashEvents() {
  // Restore Button Handler
  const tbody = document.getElementById('trash-tbody');
  if (tbody) {
    tbody.addEventListener('click', async (e) => {
      const restoreBtn = e.target.closest('.btn-restore-invoice');
      if (restoreBtn) {
        const id = restoreBtn.getAttribute('data-id');
        const num = restoreBtn.getAttribute('data-num');
        restoreBtn.disabled = true;
        try {
          await apiFetch(`/api/invoices/${id}/restore`, { method: 'POST' });
          showToast(`Invoice ${num} restored successfully.`, 'success');
          loadTrash();
        } catch (err) {
          showToast(err.message || 'Failed to restore invoice.', 'error');
          restoreBtn.disabled = false;
        }
      }
    });
  }

  // Empty Trash Modal Trigger
  const emptyBtn = document.getElementById('btn-empty-trash');
  if (emptyBtn) {
    emptyBtn.addEventListener('click', () => {
      document.getElementById('empty-trash-count').textContent = trashedInvoices.length;
      openModal('empty-trash-modal');
    });
  }

  // Confirm Empty Trash (Admin Only)
  const confirmEmptyBtn = document.getElementById('btn-confirm-empty-trash');
  if (confirmEmptyBtn) {
    confirmEmptyBtn.addEventListener('click', async () => {
      confirmEmptyBtn.disabled = true;
      try {
        const res = await apiFetch('/api/invoices/trash/empty', { method: 'POST' });
        showToast(res.message || 'Trash emptied permanently.', 'success');
        closeModal('empty-trash-modal');
        loadTrash();
      } catch (err) {
        showToast(err.message || 'Failed to empty Trash.', 'error');
      } finally {
        confirmEmptyBtn.disabled = false;
      }
    });
  }
}
