const express = require('express');
const router  = express.Router();
const multer  = require('multer');
const path    = require('path');
const { requireAdmin }  = require('../middleware/auth');
const Product = require('../models/Product');
const Order   = require('../models/Order');
const User    = require('../models/User');
const { generateOrderQR } = require('../utils/qrcode');
const { sendDeliveryEmail } = require('../utils/email');

// Multer Config
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename:    (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname)),
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

router.use(requireAdmin);

// Admin Dashboard
router.get('/', async (req, res) => {
  try {
    const [totalProducts, totalOrders, totalUsers, revenueResult, recentOrdersDocs, popularProducts, statusCounts] =
      await Promise.all([
        Product.countDocuments(),
        Order.countDocuments(),
        User.countDocuments({ role: 'customer' }),
        Order.aggregate([
          { $match: { status: { $ne: 'Cancelled' }, isOtpVerified: true } },
          { $group: { _id: null, total: { $sum: '$totalAmount' } } },
        ]),
        Order.find()
          .sort({ placedAt: -1 })
          .limit(5)
          .populate('customerId', 'name email')
          .lean(),
        Product.find().sort({ salesCount: -1 }).limit(5).lean(),
        Order.aggregate([
          { $group: { _id: '$status', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
        ]),
      ]);

    const totalRevenue = revenueResult[0]?.total || 0;

    // Shape recentOrders to match existing view expectations
    const recentOrders = recentOrdersDocs.map(o => ({
      ...o,
      user: o.customerId ? { name: o.customerId.name, email: o.customerId.email } : null,
    }));

    res.render('admin/dashboard', {
      totalProducts, totalOrders, totalUsers, totalRevenue,
      recentOrders, popularProducts, statusCounts,
    });
  } catch (err) {
    console.error('', err);
    res.render('admin/dashboard', {
      totalProducts: 0, totalOrders: 0, totalUsers: 0, totalRevenue: 0,
      recentOrders: [], popularProducts: [], statusCounts: [],
    });
  }
});

// List Products
router.get('/products', async (req, res) => {
  try {
    const products = await Product.find().sort({ createdAt: -1 }).lean();
    res.render('admin/products', { products, error: null, success: null });
  } catch (err) {
    console.error('', err);
    res.render('admin/products', { products: [], error: 'Failed to load products.', success: null });
  }
});

// Create Product
router.post('/products/create', upload.single('image'), async (req, res) => {
  try {
    const {
      name, description, price, originalPrice,
      category, brand, stock,
      isPreOrder, preOrderETA, isFeatured, tags,
    } = req.body;

    await Product.create({
      name:          name.trim(),
      description:   description || '',
      price:         parseFloat(price),
      originalPrice: originalPrice ? parseFloat(originalPrice) : null,
      category:      category || 'Other',
      brand:         brand || '',
      stock:         parseInt(stock) || 0,
      isPreOrder:    isPreOrder === 'on',
      preOrderETA:   preOrderETA || '',
      isFeatured:    isFeatured === 'on',
      tags:          tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : [],
      imagePath:     req.file ? `/uploads/${req.file.filename}` : '/images/placeholder.png',
    });

    if (req.app.locals.broadcastRefresh) req.app.locals.broadcastRefresh();
    res.redirect('/admin/products');
  } catch (err) {
    console.error('', err);
    const products = await Product.find().sort({ createdAt: -1 }).lean();
    res.render('admin/products', { products, error: 'Failed to create product.', success: null });
  }
});

// Update Product
router.post('/products/update', upload.single('image'), async (req, res) => {
  try {
    const {
      productId, name, description, price, originalPrice,
      category, brand, stock,
      isPreOrder, preOrderETA, isFeatured, tags,
    } = req.body;

    const updateData = {
      name:          name.trim(),
      description:   description || '',
      price:         parseFloat(price),
      originalPrice: originalPrice ? parseFloat(originalPrice) : null,
      category,
      brand:         brand || '',
      stock:         parseInt(stock) || 0,
      isPreOrder:    isPreOrder === 'on',
      preOrderETA:   preOrderETA || '',
      isFeatured:    isFeatured === 'on',
      tags:          tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : [],
    };

    if (req.file) updateData.imagePath = `/uploads/${req.file.filename}`;

    await Product.findByIdAndUpdate(productId, updateData);
    if (req.app.locals.broadcastRefresh) req.app.locals.broadcastRefresh();
    res.redirect('/admin/products');
  } catch (err) {
    console.error('', err);
    res.redirect('/admin/products');
  }
});

// Delete Product
router.post('/products/delete', async (req, res) => {
  try {
    await Product.findByIdAndDelete(req.body.productId);
    if (req.app.locals.broadcastRefresh) req.app.locals.broadcastRefresh();
    res.redirect('/admin/products');
  } catch (err) {
    console.error('', err);
    res.redirect('/admin/products');
  }
});

// List Orders
router.get('/orders', async (req, res) => {
  try {
    const { status, page = 1 } = req.query;
    const limit = 15;
    const skip  = (parseInt(page) - 1) * limit;

    const query = {};
    if (status && status !== 'All') query.status = status;

    const [total, orders] = await Promise.all([
      Order.countDocuments(query),
      Order.find(query)
        .sort({ placedAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('customerId', 'name email')
        .lean(),
    ]);

    const statusOptions = ['All', 'Order Placed', 'Packaging', 'Dispatched', 'Out for Delivery', 'Delivered', 'Cancelled'];

    // Shape for view compatibility
    const shapedOrders = orders.map(o => ({
      ...o,
      user: o.customerId ? { name: o.customerId.name, email: o.customerId.email } : null,
    }));

    res.render('admin/orders', {
      orders:        shapedOrders,
      statusOptions,
      currentStatus: status || 'All',
      total,
      currentPage:   parseInt(page),
      totalPages:    Math.ceil(total / limit) || 1,
    });
  } catch (err) {
    console.error('', err);
    res.render('admin/orders', {
      orders: [], statusOptions: [], currentStatus: 'All',
      total: 0, currentPage: 1, totalPages: 1,
    });
  }
});

// Update Order Status
router.post('/orders/update-status', async (req, res) => {
  try {
    const { orderId, status, note } = req.body;

    const order = await Order.findById(orderId);
    if (!order) return res.redirect('/admin/orders');

    order.status = status;
    order.statusHistory = order.statusHistory || [];
    order.statusHistory.push({ status, timestamp: new Date(), note: note || '' });

    if (status === 'Delivered') {
      const { dataUrl, payload } = await generateOrderQR(order.toObject());
      order.qrCodeData    = dataUrl;
      order.qrCodePayload = payload;

      try {
        await sendDeliveryEmail(order.customerEmail, order.customerName, order.orderId, dataUrl);
      } catch (emailErr) {
        console.error('', emailErr);
      }
    }

    await order.save();

    if (req.app.locals.broadcastOrderUpdate) {
      req.app.locals.broadcastOrderUpdate({
        orderId:    order._id.toString(),
        status:     order.status,
        customerId: order.customerId?.toString(),
      });
    }

    res.redirect('/admin/orders');
  } catch (err) {
    console.error('', err);
    res.redirect('/admin/orders');
  }
});

module.exports = router;
