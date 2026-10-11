// auth middlewares

const requireAuth = (req, res, next) => {
  if (req.session && req.session.user) {
    return next();
  }
  req.session.returnTo = req.originalUrl;
  res.redirect('/login');
};

const requireAdmin = (req, res, next) => {
  if (req.session && req.session.user && req.session.user.role === 'admin') {
    return next();
  }
  if (req.session && req.session.user) {
    return res.status(403).render('error', {
      title: 'Access Denied',
      message: 'You need admin privileges to access this page.',
      user: req.session.user
    });
  }
  res.redirect('/login');
};

const requireVerified = (req, res, next) => {
  if (req.session && req.session.user && req.session.user.isVerified) {
    return next();
  }
  if (req.session && req.session.user && !req.session.user.isVerified) {
    return res.redirect('/verify-email');
  }
  res.redirect('/login');
};

module.exports = { requireAuth, requireAdmin, requireVerified };
