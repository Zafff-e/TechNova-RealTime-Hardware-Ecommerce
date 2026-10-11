const mongoose = require("mongoose");

const productSchema = new mongoose.Schema({
  name:         { type: String, required: true },
  category:     { type: String, required: true },
  brand:        { type: String, default: "" },
  price:        { type: Number, required: true },
  originalPrice:{ type: Number, default: null },
  description:  { type: String, default: "" },
  stock:        { type: Number, default: 0 },
  imagePath:    { type: String, default: "/images/placeholder.png" },
  orderCount:   { type: Number, default: 0 },
  salesCount:   { type: Number, default: 0 },
  isFeatured:   { type: Boolean, default: false },
  isPreOrder:   { type: Boolean, default: false },
  preOrderETA:  { type: String, default: "" },
  tags:         { type: [String], default: [] },
  rating:       { type: Number, default: 0 },
  createdAt:    { type: Date, default: Date.now },
});

module.exports = mongoose.model("Product", productSchema);
