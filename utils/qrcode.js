const QRCode = require('qrcode');

// generate qr code image
async function generateQRCode(payload) {
  const dataString = typeof payload === 'string' ? payload : JSON.stringify(payload);
  const dataUrl = await QRCode.toDataURL(dataString, {
    width: 256,
    margin: 2,
    color: {
      dark: '#1e293b',
      light: '#ffffff'
    }
  });
  return dataUrl;
}

// generate qr data for order
async function generateOrderQR(order) {
  const payload = JSON.stringify({
    orderId: order.orderId,
    customerId: order.user.toString(),
    customerEmail: order.customerEmail,
    totalAmount: order.totalAmount,
    deliveredAt: new Date().toISOString(),
    items: order.items.map(i => ({ name: i.name, qty: i.quantity, price: i.price }))
  });

  const dataUrl = await generateQRCode(payload);
  return { dataUrl, payload };
}

module.exports = { generateQRCode, generateOrderQR };
