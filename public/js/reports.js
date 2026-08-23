/**
 * Apex Billing — Financial Reports & CSV Export Controller
 * Enforces historical date range bounds [today - 365 days, today] and dynamic To Date sync (Fix 3).
 */

let activeTab = 'revenue';

document.addEventListener('DOMContentLoaded', async () => {
  await initUserSession();
  setupReportDates();
  setupReportEvents();
  loadRevenueReport();
});

function setupReportDates() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const todayDay = String(now.getDate()).padStart(2, '0');
  const todayStr = `${year}-${month}-${todayDay}`;

  const pastYear = new Date();
  pastYear.setDate(pastYear.getDate() - 365);
  const pyYear = pastYear.getFullYear();
  const pyMonth = String(pastYear.getMonth() + 1).padStart(2, '0');
  const pyDay = String(pastYear.getDate()).padStart(2, '0');
  const pastYearStr = `${pyYear}-${pyMonth}-${pyDay}`;

  const startInp = document.getElementById('report-start-date');
  const endInp = document.getElementById('report-end-date');

  // Bound to [today - 365 days, today]
  if (startInp) {
    startInp.min = pastYearStr;
    startInp.max = todayStr;
    const firstDayCurrentMonth = `${year}-${month}-01`;
    startInp.value = firstDayCurrentMonth >= pastYearStr ? firstDayCurrentMonth : pastYearStr;
  }

  if (endInp) {
    endInp.min = startInp ? startInp.value : pastYearStr;
    endInp.max = todayStr;
    endInp.value = todayStr;
  }

  // FIX 3: When From Date changes, dynamically update min on To Date
  if (startInp && endInp) {
    startInp.addEventListener('change', () => {
      endInp.min = startInp.value;
      if (endInp.value < startInp.value) {
        endInp.value = startInp.value;
      }
    });
  }
}

async function loadRevenueReport() {
  const startDate = document.getElementById('report-start-date')?.value || '';
  const endDate = document.getElementById('report-end-date')?.value || '';

  if (startDate && endDate && endDate < startDate) {
    showToast('To Date cannot be earlier than From Date.', 'error');
    return;
  }

  try {
    const res = await apiFetch(`/api/reports/revenue?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`);
    if (res && res.data) {
      document.getElementById('revenue-report-total').textContent = formatRupee(res.data.totalRevenue);
      document.getElementById('revenue-report-count').textContent = `${res.data.count} Payments Recorded`;

      const tbody = document.getElementById('revenue-report-tbody');
      if (res.data.payments.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="empty-state">No payment records found for the selected date range.</td></tr>`;
      } else {
        tbody.innerHTML = res.data.payments.map(p => `
          <tr>
            <td>${formatDate(p.payment_date)}</td>
            <td><a href="/invoice-view.html?id=${p.id}" style="font-family: var(--font-mono); font-weight: 600;">${escapeHtml(p.invoice_number)}</a></td>
            <td>
              <div style="font-weight: 600;">${escapeHtml(p.customer_name)}</div>
              ${p.company ? `<div style="font-size: 11px; color: var(--text-dim);">${escapeHtml(p.company)}</div>` : ''}
            </td>
            <td><span class="badge" style="background: var(--surface-elevated); color: var(--text-muted);">${escapeHtml(p.payment_method.toUpperCase())}</span></td>
            <td>${escapeHtml(p.reference_note || '-')}</td>
            <td>${escapeHtml(p.recorded_by_name || 'Staff')}</td>
            <td style="font-weight: 700; color: var(--success); text-align: right;">+ ${formatRupee(p.amount)}</td>
          </tr>
        `).join('');
      }
    }
  } catch (err) {
    showToast(err.message || 'Failed to load revenue report.', 'error');
  }
}

async function loadOutstandingReport() {
  try {
    const res = await apiFetch('/api/reports/outstanding');
    if (res && res.data) {
      document.getElementById('outstanding-report-total').textContent = formatRupee(res.data.totalOutstanding);
      document.getElementById('outstanding-report-count').textContent = `${res.data.count} Unpaid / Partially Paid Invoices`;

      const tbody = document.getElementById('outstanding-report-tbody');
      if (res.data.invoices.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="empty-state">No outstanding invoices! All balances are fully cleared.</td></tr>`;
      } else {
        tbody.innerHTML = res.data.invoices.map(inv => {
          const isOverdue = inv.status === 'overdue';
          return `
            <tr class="${isOverdue ? 'row-overdue' : ''}">
              <td><a href="/invoice-view.html?id=${inv.id}" style="font-family: var(--font-mono); font-weight: 600;">${escapeHtml(inv.invoice_number)}</a></td>
              <td>
                <div style="font-weight: 600;">${escapeHtml(inv.customer_name)}</div>
                ${inv.company ? `<div style="font-size: 11px; color: var(--text-dim);">${escapeHtml(inv.company)}</div>` : ''}
              </td>
              <td>${formatDate(inv.issue_date)}</td>
              <td style="${isOverdue ? 'color: var(--warning); font-weight: 700;' : ''}">${formatDate(inv.due_date)}</td>
              <td>${formatRupee(inv.grand_total)}</td>
              <td style="color: var(--success);">${formatRupee(inv.paid_amount)}</td>
              <td style="font-weight: 700; color: var(--warning);">${formatRupee(inv.remaining_balance)}</td>
              <td>${renderStatusBadge(inv.status)}</td>
            </tr>
          `;
        }).join('');
      }
    }
  } catch (err) {
    showToast(err.message || 'Failed to load outstanding report.', 'error');
  }
}

function setupReportEvents() {
  const tabRev = document.getElementById('tab-revenue');
  const tabOut = document.getElementById('tab-outstanding');
  const paneRev = document.getElementById('pane-revenue');
  const paneOut = document.getElementById('pane-outstanding');

  if (tabRev && tabOut) {
    tabRev.addEventListener('click', () => {
      activeTab = 'revenue';
      tabRev.classList.add('active');
      tabOut.classList.remove('active');
      paneRev.style.display = 'block';
      paneOut.style.display = 'none';
      loadRevenueReport();
    });

    tabOut.addEventListener('click', () => {
      activeTab = 'outstanding';
      tabOut.classList.add('active');
      tabRev.classList.remove('active');
      paneOut.style.display = 'block';
      paneRev.style.display = 'none';
      loadOutstandingReport();
    });
  }

  const filterBtn = document.getElementById('btn-filter-revenue');
  if (filterBtn) {
    filterBtn.addEventListener('click', () => loadRevenueReport());
  }

  const exportRevBtn = document.getElementById('btn-export-revenue-csv');
  if (exportRevBtn) {
    exportRevBtn.addEventListener('click', () => {
      const start = document.getElementById('report-start-date')?.value || '';
      const end = document.getElementById('report-end-date')?.value || '';
      if (start && end && end < start) {
        showToast('To Date cannot be earlier than From Date.', 'error');
        return;
      }
      window.location.href = `/api/reports/revenue/csv?startDate=${encodeURIComponent(start)}&endDate=${encodeURIComponent(end)}`;
    });
  }

  const exportOutBtn = document.getElementById('btn-export-outstanding-csv');
  if (exportOutBtn) {
    exportOutBtn.addEventListener('click', () => {
      window.location.href = '/api/reports/outstanding/csv';
    });
  }
}
