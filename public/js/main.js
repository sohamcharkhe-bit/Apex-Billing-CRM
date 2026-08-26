/**
 * Apex Billing — Core Frontend Framework
 * Provides CSRF-aware fetch wrapper, formatters, session management, and UI helpers.
 */

let currentUser = null;
let currentCsrfToken = '';

/**
 * Escapes unsafe characters for safe DOM insertion (§36).
 */
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Formats a number into Indian Rupee currency string (§12, §13).
 * e.g. 1500 -> '₹1,500', 1500.50 -> '₹1,500.50', 0 -> '₹0'
 */
function formatRupee(amount) {
  const num = Number(amount) || 0;
  const isFractional = (num % 1) !== 0;
  return '₹' + num.toLocaleString('en-IN', {
    minimumFractionDigits: isFractional ? 2 : 0,
    maximumFractionDigits: 2
  });
}

/**
 * Formats numbers/tax percentages cleanly without unnecessary decimals.
 */
function formatNumber(num, isPercent = false) {
  const val = Number(num) || 0;
  const isFractional = (val % 1) !== 0;
  const formatted = val.toLocaleString('en-IN', {
    minimumFractionDigits: isFractional ? 2 : 0,
    maximumFractionDigits: 2
  });
  return isPercent ? `${formatted}%` : formatted;
}

/**
 * Normalizes Indian phone numbers (§14) into display format '+91 98765 43210'.
 */
function normalizeIndianPhone(phone) {
  if (!phone) return '-';
  const clean = String(phone).replace(/[\s\-()]/g, '');
  const match = clean.match(/(?:(?:\+91|91|0))?([6-9]\d{9})$/);
  if (match && match[1]) {
    const digits = match[1];
    return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
  }
  return escapeHtml(phone);
}

/**
 * Formats date string YYYY-MM-DD into readable date 'DD Mon YYYY'.
 */
function formatDate(dateStr) {
  if (!dateStr) return '-';
  const parts = String(dateStr).split('-');
  if (parts.length !== 3) return dateStr;
  const date = new Date(parts[0], parts[1] - 1, parts[2]);
  if (isNaN(date.getTime())) return dateStr;
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

/**
 * Renders status badge with appropriate styling and text label (§47).
 */
function renderStatusBadge(status) {
  const st = (status || 'draft').toLowerCase();
  const labels = {
    draft: 'Draft',
    sent: 'Sent',
    partial: 'Partially Paid',
    paid: 'Paid',
    overdue: 'Overdue',
    cancelled: 'Cancelled'
  };
  const label = labels[st] || st.toUpperCase();
  return `<span class="badge badge-${st}">${escapeHtml(label)}</span>`;
}

/**
 * Global CSRF-aware fetch wrapper.
 */
async function apiFetch(url, options = {}) {
  const opts = {
    credentials: 'include',
    ...options,
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  };

  // Inject CSRF token for mutating requests
  const isMutating = ['POST', 'PUT', 'PATCH', 'DELETE'].includes((opts.method || 'GET').toUpperCase());
  if (isMutating && currentCsrfToken) {
    opts.headers['X-CSRF-Token'] = currentCsrfToken;
  }

  try {
    const response = await fetch(url, opts);
    
    // Check for redirect to login
    if (response.status === 401 && !url.includes('/api/auth/')) {
      window.location.href = '/login.html?expired=1';
      return null;
    }

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const errMsg = data.error || (data.errors ? data.errors.join('\n') : `Request failed with status ${response.status}`);
      throw new Error(errMsg);
    }

    return data;
  } catch (err) {
    throw err;
  }
}

/**
 * Toast Notification System.
 */
function showToast(message, type = 'info') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    toast.style.transition = 'all 0.25s ease';
    setTimeout(() => toast.remove(), 250);
  }, 4000);
}

/**
 * Modal dialog helpers.
 */
function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.add('active');
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.remove('active');
}

/**
 * Initializes authenticated user session, header, role badge, and navigation.
 */
async function initUserSession() {
  try {
    const data = await apiFetch('/api/auth/me');
    if (!data || !data.success || !data.user) {
      window.location.href = '/login.html';
      return;
    }

    currentUser = data.user;
    currentCsrfToken = data.csrfToken;

    // Update Topbar Profile Details
    const userNameEl = document.getElementById('topbar-user-name');
    const userRoleEl = document.getElementById('topbar-user-role');
    const userAvatarEl = document.getElementById('topbar-user-avatar');

    if (userNameEl) userNameEl.textContent = currentUser.name;
    if (userRoleEl) {
      userRoleEl.textContent = currentUser.role;
      userRoleEl.className = `user-role-badge role-${currentUser.role}`;
    }
    if (userAvatarEl) {
      userAvatarEl.textContent = currentUser.name.charAt(0).toUpperCase();
    }

    // Toggle Admin-only Navigation Elements (§4, §33)
    const adminNavLinks = document.querySelectorAll('.nav-admin-only');
    adminNavLinks.forEach(el => {
      if (currentUser.role === 'admin') {
        el.style.display = 'flex';
      } else {
        el.style.display = 'none';
      }
    });

    // Attach Logout button handler
    const logoutBtn = document.getElementById('btn-logout');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        try {
          await apiFetch('/api/auth/logout', { method: 'POST' });
          window.location.href = '/login.html';
        } catch (err) {
          window.location.href = '/login.html';
        }
      });
    }

    // Mobile sidebar toggle
    const mobileBtn = document.getElementById('btn-mobile-menu');
    const sidebar = document.querySelector('.sidebar');
    if (mobileBtn && sidebar) {
      mobileBtn.addEventListener('click', () => {
        sidebar.classList.toggle('mobile-open');
      });
    }

    return currentUser;
  } catch (err) {
    window.location.href = '/login.html';
  }
}

// Global modal backdrop close handlers
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal-backdrop')) {
    e.target.classList.remove('active');
  }
  if (e.target.closest('[data-modal-close]')) {
    const modal = e.target.closest('.modal-backdrop');
    if (modal) modal.classList.remove('active');
  }
});
