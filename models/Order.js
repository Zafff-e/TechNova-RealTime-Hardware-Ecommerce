const mongoose = require("mongoose");

const statusHistorySchema = new mongoose.Schema({
  status:    { type: String },
  timestamp: { type: Date, default: Date.now },
  note:      { type: String, default: "" },
}, { _id: false });

const orderItemSchema = new mongoose.Schema({
  productId:  { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
  name:       { type: String },
  price:      { type: Number },
  quantity:   { type: Number },
  imagePath:  { type: String },
  isPreOrder: { type: Boolean, default: false },
}, { _id: false });

const orderSchema = new mongoose.Schema({
  orderId:              { type: String, unique: true, required: true },
  customerId:           { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  customerName:         { type: String, default: "" },
  customerEmail:        { type: String, default: "" },
  customerPhone:        { type: String, default: "" },
  deliveryAddress:      { type: String, required: true },
  items:                { type: [orderItemSchema], default: [] },
  subtotal:             { type: Number, default: 0 },
  deliveryFee:          { type: Number, default: 80 },
  totalAmount:          { type: Number, required: true },
  estimatedDelivery:    { type: Date, default: null },
  status: {
    type: String,
    enum: ["Order Placed", "Packaging", "Dispatched", "Out for Delivery", "Delivered", "Cancelled"],
    default: "Order Placed",
  },
  statusHistory:        { type: [statusHistorySchema], default: [] },
  paymentMethod:        { type: String, default: "COD" },
  orderOtp:             { type: String, default: null },
  orderOtpExpiry:       { type: Date, default: null },
  isOtpVerified:        { type: Boolean, default: false },
  qrCodeData:           { type: String, default: null },
  qrCodePayload:        { type: String, default: null },
  receiptConfirmed:     { type: Boolean, default: false },
  receiptConfirmedAt:   { type: Date, default: null },
  placedAt:             { type: Date, default: Date.now },
  createdAt:            { type: Date, default: Date.now },
});

module.exports = mongoose.model("Order", orderSchema);
