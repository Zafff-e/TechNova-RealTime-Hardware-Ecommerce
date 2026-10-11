const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  name:       { type: String, required: true },
  email:      { type: String, unique: true, sparse: true },
  username:   { type: String, unique: true, sparse: true },
  password:   { type: String, required: true },
  phone:      { type: String, default: "" },
  address:    { type: String, default: "" },
  role:       { type: String, enum: ["customer", "admin"], default: "customer" },
  isVerified: { type: Boolean, default: false },
  otp:        { type: String, default: null },
  otpExpiry:  { type: Date, default: null },
  createdAt:  { type: Date, default: Date.now },
});

module.exports = mongoose.model("User", userSchema);
