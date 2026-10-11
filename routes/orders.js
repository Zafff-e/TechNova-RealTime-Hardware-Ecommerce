const express  = require('express');
const router   = express.Router();
const mongoose = require('mongoose');
const { requireAuth }  = require('../middleware/auth');
const Order   = require('../models/Order');
const Product = require('../models/Product');
const { sendOrderOtpEmail, sendDeliveryEmail } = require('../utils/email');
const { generateOrderQR } = require('../utils/qrcode');

function generateOTP() {
  return '123456';
}

function addBusinessDays(date, days) {
  let count = 0;
  const d = new Date(date);
  while (count < days) {
    d.setDate(d.getDate() + 1);
    const day = d.getDay();
    if (day !== 0 && day !== 6) count++;
  }
  return d;
}

// Checkout Page
router.get('/checkout', requireAuth, (req, res) => {
  const cart = req.session.cart || [];
  if (cart.length === 0) return res.redirect('/cart');

  const subtotal    = cart.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const deliveryFee = 80;

  res.render('checkout', {
    cart, subtotal, deliveryFee,
    total: subtotal + deliveryFee,
    user:  req.session.user,
    error: null,
    step:  'form',
  });
});

// Place Order
router.post('/checkout', requireAuth, async (req, res) => {
  try {
    const { deliveryAddress, phone } = req.body;
    const cart = req.session.cart || [];
    if (cart.length === 0) return res.redirect('/cart');

    const subtotal    = cart.reduce((sum, i) => sum + i.price * i.quantity, 0);
    const deliveryFee = 80;
    const totalAmount = subtotal + deliveryFee;

    const otp               = generateOTP();
    const estimatedDelivery = addBusinessDays(new Date(), 5);
    const orderId           = 'ORD-' + Date.now();

    // Build items — keep productId as ObjectId where possible
    const orderItems = cart.map(i => ({
      productId:  mongoose.Types.ObjectId.isValid(i.productId) ? i.productId : null,
      name:       i.name,
      price:      i.price,
      quantity:   i.quantity,
      imagePath:  i.imagePath,
      isPreOrder: i.isPreOrder || false,
    }));

    const order = await Order.create({
      orderId,
      customerId:       req.session.user.id,
      customerName:     req.session.user.name,
      customerEmail:    req.session.user.email,
      customerPhone:    phone || req.session.user.phone || '',
      deliveryAddress,
      items:            orderItems,
      subtotal,
      deliveryFee,
      totalAmount,
      estimatedDelivery,
      status:           'Order Placed',
      statusHistory:    [{ status: 'Order Placed', timestamp: new Date(), note: 'Order placed via website' }],
      orderOtp:         otp,
      orderOtpExpiry:   new Date(Date.now() + 15 * 60 * 1000),
      isOtpVerified:    false,
      placedAt:         new Date(),
    });

    // Update stock and salesCount for each product
    for (const item of cart) {
      if (mongoose.Types.ObjectId.isValid(item.productId)) {
        await Product.findByIdAndUpdate(item.productId, {
          $inc: { salesCount: item.quantity, stock: -item.quantity },
        });
      }
    }

    await sendOrderOtpEmail(req.session.user.email, req.session.user.name, otp, orderId);

    req.session.pendingOrderId = order._id.toString();

    if (req.app.locals.broadcastRefresh)   req.app.locals.broadcastRefresh();
    if (req.app.locals.broadcastNewOrder)  req.app.locals.broadcastNewOrder(order);

    res.redirect('/verify-order');
  } catch (err) {
    console.error('', err);
    const cart     = req.session.cart || [];
    const subtotal = cart.reduce((sum, i) => sum + i.price * i.quantity, 0);
    res.render('checkout', {
      cart, subtotal, deliveryFee: 80, total: subtotal + 80,
      user: req.session.user, error: 'Something went wrong. Please try again.', step: 'form',
    });
  }
});

// Verify Order Page
router.get('/verify-order', requireAuth, (req, res) => {
  if (!req.session.pendingOrderId) return res.redirect('/my-orders');
  res.render('verify-order', { error: null, success: null });
});

// Verify Order OTP Action
router.post('/verify-order', requireAuth, async (req, res) => {
  try {
    const { otp }   = req.body;
    const orderId   = req.session.pendingOrderId;
    if (!orderId) return res.redirect('/my-orders');

    const order = await Order.findById(orderId);
    if (!order)  return res.redirect('/my-orders');

    if (order.orderOtp !== otp || new Date() > new Date(order.orderOtpExpiry)) {
      return res.render('verify-order', { error: 'Invalid or expired code. Please check your email.', success: null });
    }

    order.isOtpVerified  = true;
    order.orderOtp       = null;
    order.orderOtpExpiry = null;
    await order.save();

    delete req.session.pendingOrderId;
    req.session.cart = [];
    res.redirect('/order-confirm/' + order._id.toString());
  } catch (err) {
    console.error('', err);
    res.render('verify-order', { error: 'Verification failed. Please try again.', success: null });
  }
});

// Order Confirmation Page
router.get('/order-confirm/:id', requireAuth, async (req, res) => {
  try {
    const order = await Order.findOne({
      _id:        req.params.id,
      customerId: req.session.user.id,
    }).lean();
    if (!order) return res.redirect('/my-orders');

    let qrCodeDataUrl = null;
    try {
      const { dataUrl } = await generateOrderQR(order);
      qrCodeDataUrl = dataUrl;
    } catch (qrErr) {
      console.error('', qrErr);
    }

    res.render('order-confirm', { order, qrCodeDataUrl });
  } catch (err) {
    console.error('', err);
    res.redirect('/my-orders');
  }
});

// My Orders
router.get('/my-orders', requireAuth, async (req, res) => {
  try {
    const orders = await Order.find({ customerId: req.session.user.id })
      .sort({ placedAt: -1 })
      .lean();
    res.render('my-orders', { orders });
  } catch (err) {
    console.error('', err);
    res.render('my-orders', { orders: [] });
  }
});

// Confirm Receipt
router.post('/order/confirm-receipt/:id', requireAuth, async (req, res) => {
  try {
    const order = await Order.findOne({
      _id:        req.params.id,
      customerId: req.session.user.id,
    });

    if (!order || order.status !== 'Delivered') return res.redirect('/my-orders');

    order.receiptConfirmed   = true;
    order.receiptConfirmedAt = new Date();
    await order.save();

    res.redirect('/my-orders');
  } catch (err) {
    console.error('', err);
    res.redirect('/my-orders');
  }
});

module.exports = router;
