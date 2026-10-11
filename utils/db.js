/**
 * utils/db.js
 * 
 * Previously contained readJSONFile / writeJSONFile helpers for flat-file storage.
 * The application now uses MongoDB via Mongoose.
 * All database operations are handled directly in each route via Mongoose models:
 *   - models/User.js
 *   - models/Product.js
 *   - models/Order.js
 *
 * MongoDB connection is established in app.js using MONGODB_URI from .env
 */

module.exports = {};
