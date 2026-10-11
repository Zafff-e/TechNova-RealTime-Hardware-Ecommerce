const express = require('express');
const router = express.Router();
const Product = require('../models/Product');

// View Cart
router.get('/cart', (req, res) => {
  const cart        = req.session.cart || [];
  const subtotal    = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const deliveryFee = cart.length > 0 ? 80 : 0;
  res.render('cart', { cart, subtotal, deliveryFee, total: subtotal + deliveryFee });
});

// Add to Cart
router.post('/cart/add', async (req, res) => {
  try {
    const { productId, quantity = 1 } = req.body;
    const product = await Product.findById(productId).lean();

    if (!product) {
      const isAjax = req.xhr || req.headers.accept?.includes('json');
      return isAjax
        ? res.json({ success: false, error: 'Product not found' })
        : res.redirect('/shop');
    }

    if (!req.session.cart) req.session.cart = [];

    const existing = req.session.cart.find(i => i.productId === productId);
    const qty      = parseInt(quantity) || 1;

    if (existing) {
      existing.quantity = Math.min(existing.quantity + qty, product.stock || 99);
    } else {
      req.session.cart.push({
        productId:     product._id.toString(),
        name:          product.name,
        price:         product.price,
        originalPrice: product.originalPrice,
        imagePath:     product.imagePath,
        quantity:      qty,
        isPreOrder:    product.isPreOrder,
        stock:         product.stock,
      });
    }

    const isAjax = req.xhr
      || req.headers.accept?.includes('json')
      || req.headers['x-requested-with'] === 'XMLHttpRequest';

    if (isAjax) {
      const cartCount = req.session.cart.reduce((sum, i) => sum + i.quantity, 0);
      return res.json({ success: true, cartCount });
    }

    res.redirect(req.headers.referer || '/cart');
  } catch (err) {
    console.error('', err);
    const isAjax = req.xhr || req.headers.accept?.includes('json');
    return isAjax
      ? res.json({ success: false, error: 'Server error' })
      : res.redirect('/shop');
  }
});

// Remove One Quantity
router.post('/cart/remove', (req, res) => {
  const { productId } = req.body;
  if (!req.session.cart) req.session.cart = [];

  const idx = req.session.cart.findIndex(i => i.productId === productId);
  if (idx !== -1) {
    if (req.session.cart[idx].quantity > 1) {
      req.session.cart[idx].quantity -= 1;
    } else {
      req.session.cart.splice(idx, 1);
    }
  }

  if (req.xhr || req.headers.accept?.includes('json')) {
    const cart      = req.session.cart;
    const cartCount = cart.reduce((s, i) => s + i.quantity, 0);
    const subtotal  = cart.reduce((s, i) => s + i.price * i.quantity, 0);
    return res.json({ success: true, cartCount, cart, subtotal });
  }
  res.redirect('/cart');
});

// Remove Entire Item
router.post('/cart/remove-all', (req, res) => {
  const { productId } = req.body;
  if (req.session.cart) {
    req.session.cart = req.session.cart.filter(i => i.productId !== productId);
  }

  if (req.xhr || req.headers.accept?.includes('json')) {
    const cart      = req.session.cart || [];
    const cartCount = cart.reduce((s, i) => s + i.quantity, 0);
    const subtotal  = cart.reduce((s, i) => s + i.price * i.quantity, 0);
    return res.json({ success: true, cartCount, cart, subtotal });
  }
  res.redirect('/cart');
});

// Update Quantity
router.post('/cart/update', (req, res) => {
  const { productId, quantity } = req.body;
  const qty = parseInt(quantity);
  if (!req.session.cart) req.session.cart = [];

  const item = req.session.cart.find(i => i.productId === productId);
  if (item) {
    if (qty <= 0) {
      req.session.cart = req.session.cart.filter(i => i.productId !== productId);
    } else {
      item.quantity = qty;
    }
  }
  res.redirect('/cart');
});

// Cart Count API
router.get('/cart/count', (req, res) => {
  const cart  = req.session.cart || [];
  const count = cart.reduce((sum, i) => sum + i.quantity, 0);
  res.json({ count });
});

// Cart Items API
router.get('/cart/items', (req, res) => {
  const cart     = req.session.cart || [];
  const subtotal = cart.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const count    = cart.reduce((sum, i) => sum + i.quantity, 0);
  res.json({ cart, subtotal, count });
});

module.exports = router;
