/**
 * Apex Billing — Dashboard Controller
 */

let revenueChartInstance = null;

document.addEventListener('DOMContentLoaded', async () => {
  await initUserSession();
  loadDashboardData();
});

async function loadDashboardData() {
  try {
    // 1. Fetch KPI stats
    const statsData = await apiFetch('/api/dashboard/stats');
    if (statsData && statsData.stats) {
      renderKPIs(statsData.stats);
    }

    // 2. Fetch Revenue Trend for Chart.js
    const trendData = await apiFetch('/api/dashboard/trend?months=6');
    if (trendData && trendData.trend) {
      renderRevenueChart(trendData.trend);
    }

    // 3. Fetch Recent Activity
    const recentData = await apiFetch('/api/dashboard/recent');
    if (recentData) {
      renderRecentInvoices(recentData.recentInvoices || []);
      renderRecentPayments(recentData.recentPayments || []);
    }
  } catch (err) {
    showToast(err.message || 'Failed to load dashboard data.', 'error');
  }
}

function renderKPIs(stats) {
  const revEl = document.getElementById('kpi-revenue-month');
  const outEl = document.getElementById('kpi-outstanding');
  const ovdEl = document.getElementById('kpi-overdue-count');
  const paidEl = document.getElementById('kpi-paid-count');

  if (revEl) revEl.textContent = formatRupee(stats.monthRevenue);
  if (outEl) outEl.textContent = formatRupee(stats.totalOutstanding);
  if (ovdEl) ovdEl.textContent = stats.overdueCount;
  if (paidEl) paidEl.textContent = stats.paidCount;
}

function renderRevenueChart(trend) {
  const canvas = document.getElementById('revenue-trend-chart');
  if (!canvas || typeof Chart === 'undefined') return;

  const labels = trend.map(t => t.month);
  const data = trend.map(t => t.revenue);

  if (revenueChartInstance) {
    revenueChartInstance.destroy();
  }

  const ctx = canvas.getContext('2d');
  
  // Create gradient
  const gradient = ctx.createLinearGradient(0, 0, 0, 300);
  gradient.addColorStop(0, 'rgba(108, 124, 255, 0.35)');
  gradient.addColorStop(1, 'rgba(108, 124, 255, 0.00)');

  revenueChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Revenue (₹)',
        data,
        borderColor: '#6C7CFF',
        borderWidth: 3,
        backgroundColor: gradient,
        fill: true,
        tension: 0.35,
        pointBackgroundColor: '#6C7CFF',
        pointBorderColor: '#0B0C0F',
        pointBorderWidth: 2,
        pointRadius: 5,
        pointHoverRadius: 7
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#1C1F26',
          titleColor: '#F0F1F5',
          bodyColor: '#2DD4A8',
          borderColor: 'rgba(255, 255, 255, 0.1)',
          borderWidth: 1,
          padding: 12,
          displayColors: false,
          callbacks: {
            label: (ctx) => `Revenue: ${formatRupee(ctx.parsed.y)}`
          }
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(255, 255, 255, 0.04)' },
          ticks: { color: '#8B92A8', font: { size: 12 } }
        },
        y: {
          grid: { color: 'rgba(255, 255, 255, 0.04)' },
          ticks: {
            color: '#8B92A8',
            font: { size: 12 },
            callback: (val) => formatRupee(val)
          },
          beginAtZero: true
        }
      }
    }
  });
}

function renderRecentInvoices(invoices) {
  const tbody = document.getElementById('recent-invoices-tbody');
  if (!tbody) return;

  if (invoices.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty-state">No recent invoices recorded.</td></tr>`;
    return;
  }

  tbody.innerHTML = invoices.map(inv => {
    const rowClass = inv.status === 'paid' ? 'row-paid' : (inv.status === 'overdue' ? 'row-overdue' : '');
    return `
      <tr class="${rowClass}">
        <td><a href="/invoice-view.html?id=${inv.id}" style="font-family: var(--font-mono); font-weight: 600;">${escapeHtml(inv.invoice_number)}</a></td>
        <td>
          <div style="font-weight: 600;">${escapeHtml(inv.customer_name)}</div>
          ${inv.company ? `<div style="font-size: 11px; color: var(--text-dim);">${escapeHtml(inv.company)}</div>` : ''}
        </td>
        <td>${formatDate(inv.issue_date)}</td>
        <td><strong>${formatRupee(inv.grand_total)}</strong></td>
        <td>${renderStatusBadge(inv.status)}</td>
        <td style="text-align: right;">
          <a href="/invoice-view.html?id=${inv.id}" class="btn btn-secondary btn-sm">View</a>
        </td>
      </tr>
    `;
  }).join('');
}

function renderRecentPayments(payments) {
  const tbody = document.getElementById('recent-payments-tbody');
  if (!tbody) return;

  if (payments.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="empty-state">No payments recorded yet.</td></tr>`;
    return;
  }

  tbody.innerHTML = payments.map(p => `
    <tr>
      <td>${formatDate(p.payment_date)}</td>
      <td><a href="/invoice-view.html?id=${p.invoice_id}" style="font-family: var(--font-mono);">${escapeHtml(p.invoice_number)}</a></td>
      <td>${escapeHtml(p.customer_name)}</td>
      <td><span class="badge" style="background: var(--surface-elevated); color: var(--text-muted);">${escapeHtml(p.payment_method.toUpperCase())}</span></td>
      <td style="color: var(--success); font-weight: 700; text-align: right;">+ ${formatRupee(p.amount)}</td>
    </tr>
  `).join('');
}
