/**
 * Apex Billing — Authentication Script
 */

document.addEventListener('DOMContentLoaded', async () => {
  const loginForm = document.getElementById('login-form');
  const alertEl = document.getElementById('auth-alert');
  const submitBtn = document.getElementById('btn-submit-login');

  // Check URL params for expired session notification
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('expired') === '1') {
    showAlert('Your session has expired. Please log in again.', 'info');
  }

  // Check if already logged in
  try {
    const meRes = await fetch('/api/auth/me', { credentials: 'same-origin' });
    const meData = await meRes.json().catch(() => ({}));
    if (meRes.ok && meData.user) {
      window.location.href = '/dashboard.html';
      return;
    }
  } catch (err) {
    // Not logged in, proceed to show login form
  }

  function showAlert(msg, type = 'error') {
    if (!alertEl) return;
    alertEl.textContent = msg;
    alertEl.className = `auth-alert auth-alert-${type}`;
    alertEl.style.display = 'block';
  }

  function hideAlert() {
    if (!alertEl) return;
    alertEl.style.display = 'none';
  }

  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      hideAlert();

      const email = document.getElementById('email').value.trim();
      const password = document.getElementById('password').value;

      if (!email || !password) {
        showAlert('Please enter both email and password.');
        return;
      }

      submitBtn.disabled = true;
      submitBtn.textContent = 'Authenticating...';

      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({ email, password })
        });

        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          showAlert(data.error || 'Authentication failed. Please check your credentials.');
          submitBtn.disabled = false;
          submitBtn.textContent = 'Sign In';
          return;
        }

        // Login successful
        window.location.href = '/dashboard.html';
      } catch (err) {
        showAlert('Network or connection error. Please try again.');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Sign In';
      }
    });
  }
});
