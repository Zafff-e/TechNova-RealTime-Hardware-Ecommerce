const nodemailer = require('nodemailer');

let transporter = null;

// init mailer
async function initMailer() {
  console.log('Running in OFFLINE DEMO MODE. Emails will not be sent over the network.');
}

// send verification email
async function sendOtpEmail(toEmail, toName, otp) {
  console.log(`\n=== MOCK EMAIL SENT ===`);
  console.log(`To: ${toEmail} (${toName})`);
  console.log(`Subject:  Verify Your TechNova Account`);
  console.log(`OTP Code: ${otp}`);
  console.log(`=======================\n`);
  return { messageId: 'mock-id' };
}

// send order otp
async function sendOrderOtpEmail(toEmail, toName, otp, orderId) {
  console.log(`\n=== MOCK EMAIL SENT ===`);
  console.log(`To: ${toEmail} (${toName})`);
  console.log(`Subject:  Confirm Your Order #${orderId} — TechNova`);
  console.log(`Order OTP Code: ${otp}`);
  console.log(`=======================\n`);
  return { messageId: 'mock-id' };
}

// send delivery confirmation
async function sendDeliveryEmail(toEmail, toName, orderId, qrDataUrl) {
  console.log(`\n=== MOCK EMAIL SENT ===`);
  console.log(`To: ${toEmail} (${toName})`);
  console.log(`Subject:  Your Order #${orderId} Has Been Delivered! — TechNova`);
  console.log(`QR Code URL passed successfully.`);
  console.log(`=======================\n`);
  return { messageId: 'mock-id' };
}

module.exports = { initMailer, sendOtpEmail, sendOrderOtpEmail, sendDeliveryEmail };
