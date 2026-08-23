/**
 * Apex Billing — Products & Services Management
 * Implements separate Product / Service creation (Fix 4), stock quantity (Fix 5), and usage protection (Fix 6).
 */

let productsList = [];
let deleteTargetId = null;

document.addEventListener('DOMContentLoaded', async () => {
  await initUserSession();
  loadProducts();
  setupEventListeners();
});

async function loadProducts() {
  const tbody = document.getElementById('products-tbody');
  const typeFilter = document.getElementById('product-type-filter')?.value || 'all';

  try {
    const url = typeFilter !== 'all' ? `/api/products?type=${typeFilter}` : '/api/products';
    const res = await apiFetch(url);
    if (res && res.products) {
      productsList = res.products;
      applyFilters();
    }
  } catch (err) {
    showToast(err.message || 'Failed to load catalog.', 'error');
  }
}

function applyFilters() {
  const q = document.getElementById('product-search')?.value.toLowerCase().trim() || '';
  const typeFilter = document.getElementById('product-type-filter')?.value || 'all';

  const filtered = productsList.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(q) || (p.description && p.description.toLowerCase().includes(q));
    const matchesType = typeFilter === 'all' || p.type === typeFilter;
    return matchesSearch && matchesType;
  });

  renderProductsTable(filtered);
}

function renderProductsTable(products) {
  const tbody = document.getElementById('products-tbody');
  if (!tbody) return;

  if (products.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="empty-state">No matching items found. Click "Add Product" or "Add Service" to create one.</td></tr>`;
    return;
  }

  tbody.innerHTML = products.map(p => {
    const isService = p.type === 'service';
    const typeBadge = isService
      ? `<span class="badge" style="background: rgba(108, 124, 255, 0.15); color: #A5B4FC;">SERVICE</span>`
      : `<span class="badge" style="background: rgba(45, 212, 168, 0.15); color: #2DD4A8;">PRODUCT</span>`;

    const stockDisplay = isService
      ? `<span style="color: var(--text-dim);">— (Service)</span>`
      : `<strong style="color: ${p.quantity > 0 ? 'var(--text-primary)' : 'var(--danger)'};">${p.quantity ?? 0} units</strong>`;

    return `
      <tr>
        <td>${typeBadge}</td>
        <td>
          <div style="font-weight: 600; color: var(--text-primary);">${escapeHtml(p.name)}</div>
          ${p.description ? `<div style="font-size: 12px; color: var(--text-dim); margin-top: 2px;">${escapeHtml(p.description)}</div>` : ''}
        </td>
        <td>${stockDisplay}</td>
        <td style="font-weight: 700; color: var(--primary);">${formatRupee(p.unit_price)}</td>
        <td><span class="badge" style="background: var(--surface-elevated); color: var(--text-muted);">${formatNumber(p.tax_rate, true)}</span></td>
        <td>${formatDate(p.created_at.slice(0, 10))}</td>
        <td style="text-align: right;">
          <div style="display: inline-flex; gap: 8px;">
            <button class="btn btn-secondary btn-sm btn-edit" data-id="${p.id}">Edit</button>
            <button class="btn btn-danger btn-sm btn-delete" data-id="${p.id}" data-name="${escapeHtml(p.name)}">Delete</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function openItemModal(type = 'product', existingItem = null) {
  const form = document.getElementById('product-form');
  form.reset();

  const isService = type === 'service';
  document.getElementById('product-id').value = existingItem ? existingItem.id : '';
  document.getElementById('product-type').value = type;

  const qtyGroup = document.getElementById('product-quantity-group');
  const qtyInput = document.getElementById('product-quantity');

  if (isService) {
    qtyGroup.style.display = 'none';
    qtyInput.required = false;
  } else {
    qtyGroup.style.display = 'block';
    qtyInput.required = true;
  }

  if (existingItem) {
    document.getElementById('product-modal-title').textContent = isService ? 'Edit Service' : 'Edit Product';
    document.getElementById('product-name').value = existingItem.name;
    document.getElementById('product-description').value = existingItem.description || '';
    document.getElementById('product-price').value = existingItem.unit_price;
    document.getElementById('product-tax').value = existingItem.tax_rate;
    if (!isService) {
      qtyInput.value = existingItem.quantity !== null ? existingItem.quantity : 0;
    }
  } else {
    document.getElementById('product-modal-title').textContent = isService ? 'Add New Service' : 'Add New Product';
    document.getElementById('product-tax').value = 18;
    if (!isService) {
      qtyInput.value = 0;
    }
  }

  openModal('product-modal');

  // FIX 1: Attach blur validation for name (catches paste, autocomplete, etc.)
  const nameInput = document.getElementById('product-name');
  const nameError = document.getElementById('product-name-error');
  const nameRegex = /^[A-Za-z\s.'-]+$/;

  // Remove any previously-attached listener by replacing the element clone trick
  const freshName = nameInput.cloneNode(true);
  nameInput.parentNode.replaceChild(freshName, nameInput);

  freshName.addEventListener('blur', () => {
    const val = freshName.value.trim();
    if (val && !nameRegex.test(val)) {
      nameError.style.display = 'block';
    } else {
      nameError.style.display = 'none';
    }
  });
}

function setupEventListeners() {
  // Search & Type filters
  const searchInput = document.getElementById('product-search');
  if (searchInput) {
    searchInput.addEventListener('input', applyFilters);
  }

  const typeFilter = document.getElementById('product-type-filter');
  if (typeFilter) {
    typeFilter.addEventListener('change', () => loadProducts());
  }

  // FIX 4: Separate Add Product & Add Service handlers
  const addProductBtn = document.getElementById('btn-add-product');
  if (addProductBtn) {
    addProductBtn.addEventListener('click', () => openItemModal('product'));
  }

  const addServiceBtn = document.getElementById('btn-add-service');
  if (addServiceBtn) {
    addServiceBtn.addEventListener('click', () => openItemModal('service'));
  }

  // Edit / Delete table click delegation
  const tbody = document.getElementById('products-tbody');
  if (tbody) {
    tbody.addEventListener('click', (e) => {
      const editBtn = e.target.closest('.btn-edit');
      if (editBtn) {
        const id = editBtn.getAttribute('data-id');
        const item = productsList.find(p => String(p.id) === String(id));
        if (item) {
          openItemModal(item.type || 'product', item);
        }
      }

      const deleteBtn = e.target.closest('.btn-delete');
      if (deleteBtn) {
        deleteTargetId = deleteBtn.getAttribute('data-id');
        const name = deleteBtn.getAttribute('data-name');
        document.getElementById('delete-product-name').textContent = name;
        openModal('delete-modal');
      }
    });
  }

  // Save Form Submission
  const form = document.getElementById('product-form');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = document.getElementById('product-id').value;
      const type = document.getElementById('product-type').value;
      const name = document.getElementById('product-name').value.trim();
      const description = document.getElementById('product-description').value.trim();
      const unit_price = parseFloat(document.getElementById('product-price').value);
      const tax_rate = parseFloat(document.getElementById('product-tax').value || '0');
      const quantityVal = document.getElementById('product-quantity').value;

      // FIX 1: Reject digits in name before hitting the server
      const nameRegex = /^[A-Za-z\s.'-]+$/;
      const nameError = document.getElementById('product-name-error');
      if (!name || !nameRegex.test(name)) {
        if (nameError) nameError.style.display = 'block';
        showToast('Name cannot contain numbers or unsupported characters.', 'error');
        return;
      }
      if (nameError) nameError.style.display = 'none';

      let quantity = null;
      if (type === 'product') {
        quantity = quantityVal !== '' ? parseInt(quantityVal, 10) : 0;
      }

      const submitBtn = document.getElementById('btn-save-product');
      submitBtn.disabled = true;

      try {
        if (id) {
          await apiFetch(`/api/products/${id}`, {
            method: 'PUT',
            body: JSON.stringify({ name, description, type, quantity, unit_price, tax_rate })
          });
          showToast(`${type === 'service' ? 'Service' : 'Product'} updated successfully.`, 'success');
        } else {
          await apiFetch('/api/products', {
            method: 'POST',
            body: JSON.stringify({ name, description, type, quantity, unit_price, tax_rate })
          });
          showToast(`${type === 'service' ? 'Service' : 'Product'} created successfully.`, 'success');
        }
        closeModal('product-modal');
        loadProducts();
      } catch (err) {
        showToast(err.message || 'Failed to save item.', 'error');
      } finally {
        submitBtn.disabled = false;
      }
    });
  }

  // Confirm Delete
  const confirmDeleteBtn = document.getElementById('btn-confirm-delete');
  if (confirmDeleteBtn) {
    confirmDeleteBtn.addEventListener('click', async () => {
      if (!deleteTargetId) return;
      confirmDeleteBtn.disabled = true;
      try {
        await apiFetch(`/api/products/${deleteTargetId}`, { method: 'DELETE' });
        showToast('Item deleted successfully.', 'success');
        closeModal('delete-modal');
        loadProducts();
      } catch (err) {
        showToast(err.message || 'Failed to delete item.', 'error');
      } finally {
        confirmDeleteBtn.disabled = false;
        deleteTargetId = null;
      }
    });
  }
}
