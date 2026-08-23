/**
 * Apex Billing — User & Staff Management Controller (Admin Only)
 */

let usersList = [];

document.addEventListener('DOMContentLoaded', async () => {
  const user = await initUserSession();
  if (!user || user.role !== 'admin') {
    showToast('Access denied. Administrator privileges required.', 'error');
    window.location.href = '/dashboard.html';
    return;
  }

  loadUsers();
  setupUserEvents();
});

async function loadUsers() {
  const tbody = document.getElementById('users-tbody');
  try {
    const res = await apiFetch('/api/users');
    if (res && res.users) {
      usersList = res.users;
      renderUsersTable(usersList);
    }
  } catch (err) {
    showToast(err.message || 'Failed to load user accounts.', 'error');
  }
}

function renderUsersTable(users) {
  const tbody = document.getElementById('users-tbody');
  if (!tbody) return;

  if (users.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty-state">No users found.</td></tr>`;
    return;
  }

  tbody.innerHTML = users.map(u => {
    const isSelf = currentUser && currentUser.id === u.id;
    const isInactive = u.status === 'inactive';

    return `
      <tr>
        <td>
          <div style="font-weight: 600;">${escapeHtml(u.name)} ${isSelf ? '<span style="font-size: 11px; color: var(--primary);">(You)</span>' : ''}</div>
          <div style="font-size: 12px; color: var(--text-dim);">${escapeHtml(u.email)}</div>
        </td>
        <td>
          <span class="user-role-badge role-${u.role}">${escapeHtml(u.role)}</span>
        </td>
        <td>
          <span class="badge ${isInactive ? 'badge-cancelled' : 'badge-paid'}">
            ${isInactive ? 'Inactive' : 'Active'}
          </span>
        </td>
        <td>${formatDate(u.created_at ? u.created_at.slice(0, 10) : '')}</td>
        <td style="text-align: right;">
          <div style="display: inline-flex; gap: 6px;">
            <button class="btn btn-secondary btn-sm btn-edit-user" data-id="${u.id}">Edit</button>
            ${!isSelf ? `
              <button class="btn ${isInactive ? 'btn-success' : 'btn-danger'} btn-sm btn-toggle-status" data-id="${u.id}" data-status="${u.status}">
                ${isInactive ? 'Activate' : 'Deactivate'}
              </button>
            ` : ''}
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function setupUserEvents() {
  // Add User Button
  const addBtn = document.getElementById('btn-add-user');
  if (addBtn) {
    addBtn.addEventListener('click', () => {
      document.getElementById('user-form').reset();
      document.getElementById('user-id').value = '';
      document.getElementById('user-password').required = true;
      document.getElementById('user-password-hint').style.display = 'none';
      document.getElementById('user-modal-title').textContent = 'Add New Staff Account';
      openModal('user-modal');
    });
  }

  // Table Action Click Delegation
  const tbody = document.getElementById('users-tbody');
  if (tbody) {
    tbody.addEventListener('click', async (e) => {
      const editBtn = e.target.closest('.btn-edit-user');
      if (editBtn) {
        const id = editBtn.getAttribute('data-id');
        const u = usersList.find(item => String(item.id) === String(id));
        if (u) {
          document.getElementById('user-id').value = u.id;
          document.getElementById('user-name').value = u.name;
          document.getElementById('user-email').value = u.email;
          document.getElementById('user-email').disabled = true; // Email immutable on edit
          document.getElementById('user-role').value = u.role;
          document.getElementById('user-status').value = u.status;
          document.getElementById('user-password').required = false;
          document.getElementById('user-password').value = '';
          document.getElementById('user-password-hint').style.display = 'block';
          document.getElementById('user-modal-title').textContent = 'Edit Staff Account';
          openModal('user-modal');
        }
      }

      const toggleBtn = e.target.closest('.btn-toggle-status');
      if (toggleBtn) {
        const id = toggleBtn.getAttribute('data-id');
        toggleBtn.disabled = true;
        try {
          const res = await apiFetch(`/api/users/${id}/toggle-status`, { method: 'POST' });
          showToast(res.message || 'Status updated.', 'success');
          loadUsers();
        } catch (err) {
          showToast(err.message || 'Failed to update user status.', 'error');
          toggleBtn.disabled = false;
        }
      }
    });
  }

  // FIX 1: Blur validation for user name
  const nameInput = document.getElementById('user-name');
  const nameError = document.getElementById('user-name-error');
  const personRegex = /^[A-Za-z\s.'-]+$/;

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

  // Save User Form
  const form = document.getElementById('user-form');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = document.getElementById('user-id').value;
      const name = document.getElementById('user-name').value.trim();
      const email = document.getElementById('user-email').value.trim();
      const role = document.getElementById('user-role').value;
      const status = document.getElementById('user-status').value;
      const password = document.getElementById('user-password').value;

      if (!personRegex.test(name)) {
        showToast('Full Name cannot contain numbers (letters, spaces, ., -, \' only).', 'error');
        if (nameError) nameError.style.display = 'block';
        return;
      }

      const submitBtn = document.getElementById('btn-save-user');
      submitBtn.disabled = true;

      try {
        if (id) {
          await apiFetch(`/api/users/${id}`, {
            method: 'PUT',
            body: JSON.stringify({ name, role, status, password: password || undefined })
          });
          showToast('User account updated successfully.', 'success');
        } else {
          await apiFetch('/api/users', {
            method: 'POST',
            body: JSON.stringify({ name, email, role, status, password })
          });
          showToast('New user account created successfully.', 'success');
        }
        closeModal('user-modal');
        loadUsers();
      } catch (err) {
        showToast(err.message || 'Failed to save user.', 'error');
      } finally {
        submitBtn.disabled = false;
      }
    });
  }
}
