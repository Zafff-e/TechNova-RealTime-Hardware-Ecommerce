const express = require('express');
const router = express.Router();
const Product = require('../models/Product');

const CATEGORIES = ['All', 'Desktop', 'Laptop', 'Tab', 'CPU', 'GPU', 'RAM', 'Storage', 'Motherboard', 'Cooling', 'PSU', 'Case', 'Monitor', 'Peripheral'];

const OFFERS = [
  { badge: "Weekend Sale",  title: "Up to 30% Off Laptops",        description: "Grab the best deals on gaming and productivity laptops this weekend only." },
  { badge: "Clearance",     title: "Storage Drive Blowout",         description: "Save big on HDDs and SSDs. Upgrade your storage before they're gone." },
  { badge: "Combo Offer",   title: "Motherboard + CPU Bundles",     description: "Build your dream PC and save up to 15% when you buy them together." },
];

// Home Page
router.get('/', async (req, res) => {
  try {
    // Get products with highest orderCount (actual sales)
    // NOT salesCount (which may not be updated)
    const [popularProducts, featuredProducts, preOrderProducts, latestProducts] = await Promise.all([
      Product.find({ stock: { $gt: 0 } })
        .sort({ orderCount: -1 })  // Changed from salesCount to orderCount
        .limit(8)
        .select('_id name category price originalPrice imagePath orderCount stock isFeatured isPreOrder rating reviewCount')  // Only fetch needed fields
        .exec(),  // Force immediate execution (not lazy)
      Product.find({ stock: { $gt: 0 }, isFeatured: true })
        .limit(4)
        .select('_id name category price originalPrice imagePath orderCount stock isFeatured isPreOrder rating reviewCount')
        .exec(),
      Product.find({ isPreOrder: true })
        .limit(4)
        .select('_id name category price originalPrice imagePath orderCount stock isFeatured isPreOrder rating reviewCount')
        .exec(),
      Product.find({ stock: { $gt: 0 } })
        .sort({ createdAt: -1 })
        .limit(8)
        .select('_id name category price originalPrice imagePath orderCount stock isFeatured isPreOrder rating reviewCount')
        .exec(),
    ]);

    // Convert to plain objects (fixes caching issues)
    const popularProducts_plain = popularProducts.map(p => p.toObject());
    const featuredProducts_plain = featuredProducts.map(p => p.toObject());
    const preOrderProducts_plain = preOrderProducts.map(p => p.toObject());
    const latestProducts_plain = latestProducts.map(p => p.toObject());

    res.render('home', {
      popularProducts: popularProducts_plain,
      featuredProducts: featuredProducts_plain,
      preOrderProducts: preOrderProducts_plain,
      latestProducts: latestProducts_plain,
      categories: CATEGORIES,
      offers: OFFERS,
    });
  } catch (err) {
    console.error('[Home Error]', err);
    res.render('home', {
      popularProducts: [], featuredProducts: [], preOrderProducts: [],
      latestProducts: [], categories: CATEGORIES, offers: OFFERS,
    });
  }
});

// Shop Catalog
router.get('/shop', async (req, res) => {
  try {
    const { category, search, sort, minPrice, maxPrice, page = 1 } = req.query;
    const limit = 12;
    const skip  = (parseInt(page) - 1) * limit;

    // Build query
    const query = {};
    if (category && category !== 'All') query.category = category;
    if (search)    query.name = { $regex: search, $options: 'i' };
    if (minPrice)  query.price = { ...query.price, $gte: parseFloat(minPrice) };
    if (maxPrice)  query.price = { ...query.price, $lte: parseFloat(maxPrice) };

    // Build sort
    let sortObj = { createdAt: -1 };
    if (sort === 'price-asc')  sortObj = { price: 1 };
    if (sort === 'price-desc') sortObj = { price: -1 };
    if (sort === 'popular')    sortObj = { orderCount: -1 };  // Changed from salesCount to orderCount
    if (sort === 'rating')     sortObj = { rating: -1 };

    const [products, total] = await Promise.all([
      Product.find(query)
        .sort(sortObj)
        .skip(skip)
        .limit(limit)
        .select('_id name category price originalPrice imagePath orderCount stock isFeatured isPreOrder rating reviewCount')
        .exec(),
      Product.countDocuments(query),
    ]);

    res.render('shop', {
      products: products.map(p => p.toObject()),
      categories:      CATEGORIES,
      currentCategory: category || 'All',
      search:          search || '',
      sort:            sort || '',
      total,
      currentPage:  parseInt(page),
      totalPages:   Math.ceil(total / limit) || 1,
    });
  } catch (err) {
    console.error('[Shop Error]', err);
    res.render('shop', {
      products: [], categories: CATEGORIES, currentCategory: 'All',
      search: '', sort: '', total: 0, currentPage: 1, totalPages: 1,
    });
  }
});

// Product Detail
router.get('/product/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)
      .select('_id name category price originalPrice description imagePath orderCount stock isFeatured isPreOrder rating reviewCount brand tags')
      .exec();
    
    if (!product) return res.redirect('/shop');

    const related = await Product.find({
      category: product.category,
      _id:      { $ne: product._id },
      stock:    { $gt: 0 },
    })
      .limit(4)
      .select('_id name category price originalPrice imagePath orderCount stock isFeatured isPreOrder rating reviewCount')
      .exec();

    res.render('product-detail', { 
      product: product.toObject(),
      related: related.map(p => p.toObject())
    });
  } catch (err) {
    console.error('[Product Detail Error]', err);
    res.redirect('/shop');
  }
});

// Live Search API
router.get('/api/search', async (req, res) => {
  try {
    const query = req.query.q;
    if (!query || query.trim() === '') return res.json([]);

    const products = await Product.find({
      name: { $regex: query.trim(), $options: 'i' },
    })
      .limit(5)
      .select('_id name price imagePath')
      .exec();

    res.json(products.map(p => {
      const obj = p.toObject();
      return {
        id:        obj._id,
        name:      obj.name,
        price:     obj.price,
        imagePath: obj.imagePath || '/images/placeholder.png',
      };
    }));
  } catch (err) {
    console.error('[Search Error]', err);
    res.status(500).json([]);
  }
});

module.exports = router;
