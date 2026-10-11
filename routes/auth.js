const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { sendOtpEmail } = require('../utils/email');

function generateOTP() {
  return '123456';
}

// Customer Registration Page
router.get('/register', (req, res) => {
  if (req.session.user) return res.redirect('/');
  res.render('register', { error: null, success: null });
});

// Customer Registration Action
router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.render('register', { error: 'Name, email and password are required.', success: null });
    }

    const existing = await User.findOne({ email: email.toLowerCase().trim() });
    if (existing) {
      return res.render('register', { error: 'This email is already registered.', success: null });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const newUser = await User.create({
      name:       name.trim(),
      email:      email.toLowerCase().trim(),
      password:   hashedPassword,
      role:       'customer',
      isVerified: true,
    });

    const tempCart = req.session.cart || [];
    req.session.user = {
      id:         newUser._id.toString(),
      name:       newUser.name,
      email:      newUser.email,
      role:       newUser.role,
      isVerified: true,
      address:    newUser.address,
      phone:      newUser.phone,
    };
    req.session.cart = tempCart;
    res.redirect('/');
  } catch (err) {
    console.error('', err);
    res.render('register', { error: 'Something went wrong. Please try again.', success: null });
  }
});

// OTP Verification Page
router.get('/verify-email', (req, res) => {
  if (!req.session.pendingVerify && !req.session.user) return res.redirect('/register');
  res.render('verify-email', { error: null, success: null });
});

// OTP Verification Action
router.post('/verify-email', async (req, res) => {
  try {
    const { otp } = req.body;
    const pending = req.session.pendingVerify;
    if (!pending) return res.redirect('/register');

    const user = await User.findById(pending.userId);
    if (!user) return res.redirect('/register');

    if (user.otp !== otp || new Date() > new Date(user.otpExpiry)) {
      return res.render('verify-email', { error: 'Invalid or expired OTP. Please try again.', success: null });
    }

    user.isVerified = true;
    user.otp        = null;
    user.otpExpiry  = null;
    await user.save();

    delete req.session.pendingVerify;
    const tempCart = req.session.cart || [];

    req.session.user = {
      id:         user._id.toString(),
      name:       user.name,
      email:      user.email,
      role:       user.role,
      isVerified: true,
      address:    user.address,
      phone:      user.phone,
    };
    req.session.cart = tempCart;
    res.redirect('/');
  } catch (err) {
    console.error('', err);
    res.render('verify-email', { error: 'Verification failed. Please try again.', success: null });
  }
});

// Resend OTP
router.post('/resend-otp', async (req, res) => {
  try {
    const pending = req.session.pendingVerify;
    if (!pending) return res.redirect('/register');

    const user = await User.findById(pending.userId);
    if (!user) return res.redirect('/register');

    const otp = generateOTP();
    user.otp       = otp;
    user.otpExpiry = new Date(Date.now() + 10 * 60 * 1000);
    await user.save();

    await sendOtpEmail(user.email, user.name, otp);
    res.render('verify-email', { error: null, success: 'A new OTP has been sent to your email.' });
  } catch (err) {
    console.error('', err);
    res.render('verify-email', { error: 'Failed to resend OTP.', success: null });
  }
});

// Customer Login Page
router.get('/login', (req, res) => {
  if (req.session.user) return res.redirect('/');
  res.render('login', { error: null });
});

// Customer Login Action
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email: email.toLowerCase().trim() });

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.render('login', { error: 'Invalid email or password.' });
    }

    if (!user.isVerified) {
      req.session.pendingVerify = { userId: user._id.toString(), email: user.email, name: user.name };
      return res.redirect('/verify-email');
    }

    const tempCart = req.session.cart || [];
    req.session.user = {
      id:         user._id.toString(),
      name:       user.name,
      email:      user.email,
      role:       user.role,
      isVerified: user.isVerified,
      address:    user.address,
      phone:      user.phone,
    };
    req.session.cart = tempCart;

    if (user.role === 'admin') return res.redirect('/admin');

    const returnTo = req.session.returnTo || '/';
    delete req.session.returnTo;
    res.redirect(returnTo);
  } catch (err) {
    console.error('', err);
    res.render('login', { error: 'Something went wrong. Please try again.' });
  }
});

// Logout
router.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

// Admin Login Page
router.get('/admin-login', (req, res) => {
  if (req.session.user && req.session.user.role === 'admin') return res.redirect('/admin');
  res.render('admin-login', { error: null });
});

// Admin Login Action
router.post('/admin-login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const usernameLower = username.toLowerCase().trim();

    const user = await User.findOne({
      role: 'admin',
      $or: [
        { username: { $regex: new RegExp(`^${usernameLower}$`, 'i') } },
        { name:     { $regex: new RegExp(`^${usernameLower}$`, 'i') } },
        { email:    { $regex: new RegExp(`^${usernameLower}$`, 'i') } },
      ],
    });

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.render('admin-login', { error: 'Invalid admin credentials.' });
    }

    const tempCart = req.session.cart || [];
    req.session.user = {
      id:         user._id.toString(),
      name:       user.name,
      email:      user.email,
      role:       user.role,
      isVerified: user.isVerified,
    };
    req.session.cart = tempCart;
    res.redirect('/admin');
  } catch (err) {
    console.error('', err);
    res.render('admin-login', { error: 'Something went wrong. Please try again.' });
  }
});

// Admin Register Page
router.get('/admin-register', (req, res) => {
  if (req.session.user && req.session.user.role === 'admin') return res.redirect('/admin');
  res.render('admin-register', { error: null, success: null });
});

// Admin Register Action
router.post('/admin-register', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.render('admin-register', { error: 'Username and Password are required.', success: null });
    }

    const email = username.trim().toLowerCase().replace(/\s+/g, '') + '@admin.com';

    const existing = await User.findOne({
      $or: [
        { email: email },
        { username: { $regex: new RegExp(`^${username.trim()}$`, 'i') } },
      ],
    });
    if (existing) {
      return res.render('admin-register', { error: 'This username is already taken.', success: null });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    await User.create({
      username:   username.trim(),
      name:       username.trim(),
      email:      email,
      password:   hashedPassword,
      role:       'admin',
      isVerified: true,
    });

    res.render('admin-register', {
      error:   null,
      success: `Admin account "${username.trim()}" created successfully! You can now sign in.`,
    });
  } catch (err) {
    console.error('', err);
    res.render('admin-register', { error: 'Something went wrong. Please try again.', success: null });
  }
});

module.exports = router;
