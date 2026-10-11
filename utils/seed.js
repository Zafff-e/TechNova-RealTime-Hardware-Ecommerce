require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');
const User     = require('../models/User');
const Product  = require('../models/Product');
const Order    = require('../models/Order');

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/technova';

const seedData = async () => {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB at', MONGO_URI);

    // Clear existing data
    await Promise.all([
      User.deleteMany({}),
      Product.deleteMany({}),
      Order.deleteMany({}),
    ]);
    console.log('Collections cleared.');

    // Seed Users
    const adminPassword    = await bcrypt.hash('admin123', 10);
    const customerPassword = await bcrypt.hash('user123', 10);

    await User.create([
      {
        name:       'TechNova Admin',
        email:      'admin@technova.com',
        username:   'admin',
        password:   adminPassword,
        role:       'admin',
        isVerified: true,
      },
      {
        name:       'Test Customer',
        email:      'customer@technova.com',
        password:   customerPassword,
        role:       'customer',
        isVerified: true,
        phone:      '01711223344',
        address:    'House 1, Road 2, Dhaka',
      },
    ]);

    console.log('Users seeded:');
    console.log('Admin    → admin@technova.com    / admin123');
    console.log('Customer → customer@technova.com / user123');

    // Seed Products
    await Product.create([
      {
        name:          'AMD Ryzen 5 5600X Processor',
        description:   '6 cores, 12 threads — amazing performance for gaming and streaming.',
        price:         18500,
        originalPrice: 20000,
        category:      'CPU',
        brand:         'AMD',
        stock:         15,
        isFeatured:    true,
        salesCount:    28,
        imagePath:     '/images/placeholder.png',
        tags:          ['gaming', 'ryzen', 'am4'],
      },
      {
        name:          'Dell XPS 15 Laptop',
        description:   'Premium 15-inch laptop with stunning OLED display and Intel Core i7.',
        price:         145000,
        originalPrice: 150000,
        category:      'Laptop',
        brand:         'Dell',
        stock:         8,
        isFeatured:    true,
        salesCount:    14,
        imagePath:     '/images/placeholder.png',
        tags:          ['laptop', 'premium', 'work'],
      },
      {
        name:        'Apple iPad Pro 11-inch (M2)',
        description: 'The ultimate iPad experience with the M2 chip and Liquid Retina display.',
        price:       95000,
        category:    'Tab',
        brand:       'Apple',
        stock:       15,
        salesCount:  30,
        imagePath:   '/images/placeholder.png',
        tags:        ['tablet', 'apple', 'ipad'],
      },
      {
        name:          'Samsung 980 PRO 1TB NVMe SSD',
        description:   'Ultra-fast PCIe Gen4 storage for your OS and games. Up to 7000 MB/s.',
        price:         11000,
        originalPrice: 13000,
        category:      'Storage',
        brand:         'Samsung',
        stock:         20,
        salesCount:    45,
        imagePath:     '/images/placeholder.png',
        tags:          ['ssd', 'nvme', 'samsung'],
      },
      {
        name:        'Budget Office Desktop Core i3',
        description: 'Reliable desktop for office work and study. Comes with Windows 11.',
        price:       25000,
        category:    'Desktop',
        brand:       'TechNova Builder',
        stock:       20,
        salesCount:  55,
        imagePath:   '/images/placeholder.png',
        tags:        ['desktop', 'office', 'budget'],
      },
      {
        name:          'ASUS RTX 4070 Super Graphics Card',
        description:   'Next-gen GPU with DLSS 3.5 support. Dominate 1440p gaming.',
        price:         65000,
        originalPrice: 70000,
        category:      'GPU',
        brand:         'ASUS',
        stock:         6,
        isFeatured:    true,
        salesCount:    18,
        imagePath:     '/images/placeholder.png',
        tags:          ['gpu', 'rtx', 'gaming', 'asus'],
      },
      {
        name:          'Corsair Vengeance DDR5 32GB (2x16GB) 5600MHz',
        description:   'High-performance DDR5 RAM for Intel 12th/13th gen platforms.',
        price:         12500,
        originalPrice: 14000,
        category:      'RAM',
        brand:         'Corsair',
        stock:         25,
        salesCount:    60,
        imagePath:     '/images/placeholder.png',
        tags:          ['ram', 'ddr5', 'corsair'],
      },
      {
        name:        'LG UltraGear 27" 165Hz Gaming Monitor',
        description: '27-inch IPS panel, 1ms response time, G-Sync compatible.',
        price:       34000,
        category:    'Monitor',
        brand:       'LG',
        stock:       10,
        isFeatured:  true,
        salesCount:  22,
        imagePath:   '/images/placeholder.png',
        tags:        ['monitor', 'gaming', 'lg'],
      },
      {
        name:          'ASUS ROG Strix B550-F Motherboard',
        description:   'AMD AM4 ATX motherboard with PCIe 4.0 and WiFi 6.',
        price:         21000,
        originalPrice: 23000,
        category:      'Motherboard',
        brand:         'ASUS',
        stock:         12,
        salesCount:    17,
        imagePath:     '/images/placeholder.png',
        tags:          ['motherboard', 'asus', 'am4', 'b550'],
      },
      {
        name:        'Noctua NH-D15 CPU Cooler',
        description: 'Award-winning dual-tower air cooler. Near-silent performance.',
        price:       8500,
        category:    'Cooling',
        brand:       'Noctua',
        stock:       18,
        salesCount:  32,
        imagePath:   '/images/placeholder.png',
        tags:        ['cooler', 'noctua', 'cpu'],
      },
    ]);

    console.log('10 Products seeded successfully.');

    await mongoose.disconnect();
    console.log('\n Seed complete! You can now run: npm run dev');
    process.exit(0);
  } catch (err) {
    console.error('Seeding error:', err);
    process.exit(1);
  }
};

seedData();
