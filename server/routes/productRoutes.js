const express = require('express');
const requireLogin = require('../middleware/requireLogin');
const ProductModel = require('../models/productModel');

const router = express.Router();
router.use(requireLogin);

// GET /api/products (supports ?type=product | service)
router.get('/', (req, res) => {
  const { type } = req.query;
  const products = ProductModel.getAll(type);
  res.json({ success: true, products });
});

// GET /api/products/:id/price (Section 51)
router.get('/:id/price', (req, res) => {
  const product = ProductModel.getById(req.params.id);
  if (!product) {
    return res.status(404).json({ success: false, error: 'Product or Service not found.' });
  }
  res.json({
    success: true,
    unit_price: product.unit_price,
    tax_rate: product.tax_rate,
    description: product.description,
    name: product.name,
    type: product.type,
    quantity: product.quantity
  });
});

// GET /api/products/:id
router.get('/:id', (req, res) => {
  const product = ProductModel.getById(req.params.id);
  if (!product) {
    return res.status(404).json({ success: false, error: 'Product or Service not found.' });
  }
  res.json({ success: true, product });
});

// POST /api/products
router.post('/', (req, res) => {
  const { name, description, type, quantity, unit_price, tax_rate } = req.body;

  if (!name || !String(name).trim()) {
    return res.status(400).json({ success: false, error: 'Name is required.' });
  }

  // FIX 1: Reject digits/special chars in product/service name
  const nameRegex = /^[A-Za-z\s.'-]+$/;
  if (!nameRegex.test(String(name).trim())) {
    return res.status(400).json({
      success: false,
      error: 'Name can only contain letters, spaces, apostrophes, hyphens, and periods — no numbers allowed.'
    });
  }

  // FIX 2/4: Validate type
  if (type && !['product', 'service'].includes(type)) {
    return res.status(400).json({ success: false, error: "Type must be 'product' or 'service'." });
  }
  const itemType = type === 'service' ? 'service' : 'product';

  // FIX 5: Validate quantity for products
  let stockQty = null;
  if (itemType === 'product') {
    if (quantity !== undefined && quantity !== null && quantity !== '') {
      const q = Number(quantity);
      if (isNaN(q) || !Number.isInteger(q) || q < 0) {
        return res.status(400).json({ success: false, error: 'Product stock quantity must be a non-negative integer (0 or more).' });
      }
      stockQty = q;
    } else {
      stockQty = 0; // Default 0 for products
    }
  }

  const price = Number(unit_price);
  if (isNaN(price) || price < 0) {
    return res.status(400).json({ success: false, error: 'Unit price must be a valid positive number.' });
  }

  const tax = Number(tax_rate || 0);
  if (isNaN(tax) || tax < 0 || tax > 100) {
    return res.status(400).json({ success: false, error: 'Tax rate must be between 0% and 100%.' });
  }

  const newProduct = ProductModel.create({
    name,
    description,
    type: itemType,
    quantity: stockQty,
    unit_price: price,
    tax_rate: tax
  });

  const label = itemType === 'service' ? 'Service' : 'Product';
  res.status(201).json({ success: true, product: newProduct, message: `${label} created successfully.` });
});

// PUT /api/products/:id
router.put('/:id', (req, res) => {
  const product = ProductModel.getById(req.params.id);
  if (!product) {
    return res.status(404).json({ success: false, error: 'Product or Service not found.' });
  }

  const { name, description, type, quantity, unit_price, tax_rate } = req.body;

  if (!name || !String(name).trim()) {
    return res.status(400).json({ success: false, error: 'Name is required.' });
  }

  // FIX 1: Reject digits/special chars in product/service name
  const nameRegex = /^[A-Za-z\s.'-]+$/;
  if (!nameRegex.test(String(name).trim())) {
    return res.status(400).json({
      success: false,
      error: 'Name can only contain letters, spaces, apostrophes, hyphens, and periods — no numbers allowed.'
    });
  }

  // FIX 2/4: Validate type
  const itemType = type === 'service' ? 'service' : 'product';

  // FIX 5: Validate quantity for products
  let stockQty = null;
  if (itemType === 'product') {
    if (quantity !== undefined && quantity !== null && quantity !== '') {
      const q = Number(quantity);
      if (isNaN(q) || !Number.isInteger(q) || q < 0) {
        return res.status(400).json({ success: false, error: 'Product stock quantity must be a non-negative integer (0 or more).' });
      }
      stockQty = q;
    } else {
      stockQty = 0;
    }
  }

  const price = Number(unit_price);
  if (isNaN(price) || price < 0) {
    return res.status(400).json({ success: false, error: 'Unit price must be a valid positive number.' });
  }

  const tax = Number(tax_rate || 0);
  if (isNaN(tax) || tax < 0 || tax > 100) {
    return res.status(400).json({ success: false, error: 'Tax rate must be between 0% and 100%.' });
  }

  const updated = ProductModel.update(req.params.id, {
    name,
    description,
    type: itemType,
    quantity: stockQty,
    unit_price: price,
    tax_rate: tax
  });

  const label = itemType === 'service' ? 'Service' : 'Product';
  res.json({ success: true, product: updated, message: `${label} updated successfully.` });
});

// DELETE /api/products/:id (FIX 6: Clear error message when used in invoices)
router.delete('/:id', (req, res) => {
  const product = ProductModel.getById(req.params.id);
  if (!product) {
    return res.status(404).json({ success: false, error: 'Product or Service not found.' });
  }

  try {
    ProductModel.delete(req.params.id);
    res.json({ success: true, message: 'Product / Service deleted successfully.' });
  } catch (err) {
    if (err.code === 'PRODUCT_IN_USE' || (err.message && err.message.includes('FOREIGN KEY constraint failed'))) {
      return res.status(400).json({
        success: false,
        error: err.message || 'Cannot delete product/service — it is used in one or more invoices.'
      });
    }
    throw err;
  }
});

module.exports = router;
