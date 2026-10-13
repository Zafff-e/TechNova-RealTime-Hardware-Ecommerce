const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const fs = require('node:fs');

const projectRoot = path.join(__dirname, '..');

test('1. Architecture & Model Schema Definitions', async (t) => {
  await t.test('User schema has expected fields, role enum and defaults', () => {
    const User = require(path.join(projectRoot, 'models/User'));
    assert.ok(User.schema, 'User schema should exist');
    assert.strictEqual(User.schema.path('role').defaultValue, 'customer');
    assert.deepStrictEqual(User.schema.path('role').enumValues, ['customer', 'admin']);
    assert.strictEqual(User.schema.path('isVerified').defaultValue, false);
  });

  await t.test('Product schema has expected fields and default placeholder image', () => {
    const Product = require(path.join(projectRoot, 'models/Product'));
    assert.ok(Product.schema, 'Product schema should exist');
    assert.strictEqual(Product.schema.path('imagePath').defaultValue, '/images/placeholder.png');
    assert.strictEqual(Product.schema.path('stock').defaultValue, 0);
  });

  await t.test('Order schema has expected status lifecycle enum and defaults', () => {
    const Order = require(path.join(projectRoot, 'models/Order'));
    assert.ok(Order.schema, 'Order schema should exist');
    assert.strictEqual(Order.schema.path('status').defaultValue, 'Order Placed');
    const expectedStatuses = ["Order Placed", "Packaging", "Dispatched", "Out for Delivery", "Delivered", "Cancelled"];
    assert.deepStrictEqual(Order.schema.path('status').enumValues, expectedStatuses);
  });
});

test('2. QR Code Invoice Generator Utility', async (t) => {
  const { generateQRCode, generateOrderQR } = require(path.join(projectRoot, 'utils/qrcode'));

  await t.test('generateQRCode returns a valid base64 PNG data URL', async () => {
    const samplePayload = { orderId: 'ORD-TEST-100', totalAmount: 15500 };
    const dataUrl = await generateQRCode(samplePayload);
    assert.ok(typeof dataUrl === 'string', 'Should return string');
    assert.ok(dataUrl.startsWith('data:image/png;base64,'), 'Should start with base64 PNG data URL');
  });

  await t.test('generateOrderQR returns valid dataUrl and parsed JSON payload', async () => {
    const mockOrder = {
      orderId: 'ORD-99999',
      user: '507f1f77bcf86cd799439011',
      customerEmail: 'customer@test.com',
      totalAmount: 45000,
      items: [{ name: 'Intel Core i7', quantity: 1, price: 45000 }]
    };
    const result = await generateOrderQR(mockOrder);
    assert.ok(result.dataUrl.startsWith('data:image/png;base64,'));
    const parsed = JSON.parse(result.payload);
    assert.strictEqual(parsed.orderId, 'ORD-99999');
    assert.strictEqual(parsed.totalAmount, 45000);
    assert.strictEqual(parsed.items.length, 1);
  });
});

test('3. Authentication & RBAC Middleware', async (t) => {
  const { requireAuth, requireAdmin, requireVerified } = require(path.join(projectRoot, 'middleware/auth'));

  await t.test('requireAuth permits authenticated session', () => {
    let calledNext = false;
    const req = { session: { user: { name: 'Test User' } } };
    const res = {};
    requireAuth(req, res, () => { calledNext = true; });
    assert.strictEqual(calledNext, true);
  });

  await t.test('requireAuth redirects unauthenticated visitor to /login and saves returnTo', () => {
    let redirectedTo = null;
    const req = { session: {}, originalUrl: '/checkout' };
    const res = { redirect: (url) => { redirectedTo = url; } };
    requireAuth(req, res, () => {});
    assert.strictEqual(redirectedTo, '/login');
    assert.strictEqual(req.session.returnTo, '/checkout');
  });

  await t.test('requireAdmin permits admin users', () => {
    let calledNext = false;
    const req = { session: { user: { role: 'admin' } } };
    const res = {};
    requireAdmin(req, res, () => { calledNext = true; });
    assert.strictEqual(calledNext, true);
  });

  await t.test('requireAdmin renders 403 error view for non-admin users', () => {
    let renderedView = null;
    let statusCode = null;
    const req = { session: { user: { role: 'customer' } } };
    const res = {
      status: (code) => {
        statusCode = code;
        return {
          render: (view, data) => { renderedView = view; }
        };
      }
    };
    requireAdmin(req, res, () => {});
    assert.strictEqual(statusCode, 403);
    assert.strictEqual(renderedView, 'error');
  });

  await t.test('requireVerified checks email verification flag', () => {
    let calledNext = false;
    const reqVerified = { session: { user: { isVerified: true } } };
    requireVerified(reqVerified, {}, () => { calledNext = true; });
    assert.strictEqual(calledNext, true);

    let redirected = null;
    const reqUnverified = { session: { user: { isVerified: false } } };
    const res = { redirect: (url) => { redirected = url; } };
    requireVerified(reqUnverified, res, () => {});
    assert.strictEqual(redirected, '/verify-email');
  });
});

test('4. Seed Data Integrity', async (t) => {
  await t.test('products.json contains valid products array with pricing', () => {
    const raw = fs.readFileSync(path.join(projectRoot, 'data/products.json'), 'utf8');
    const products = JSON.parse(raw);
    assert.ok(Array.isArray(products) && products.length > 0, 'Should have products array');
    products.forEach((p) => {
      assert.ok(p.name, 'Product must have name');
      assert.ok(p.category, 'Product must have category');
      assert.ok(typeof p.price === 'number' && p.price > 0, 'Price must be positive number');
    });
  });
});
