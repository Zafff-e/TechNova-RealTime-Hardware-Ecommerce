require("dotenv").config();
const express = require("express");
const http = require("http");
const path = require("path");
const session = require("express-session");
const { WebSocketServer } = require("ws");
const mongoose = require("mongoose");
const { initMailer } = require("./utils/email");

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });
const PORT = process.env.PORT || 8008;

console.log(`Starting TechNova — target http://localhost:${PORT}`);
process.on("uncaughtException", (err) => {
  console.error("", err && err.stack ? err.stack : err);
});
process.on("unhandledRejection", (reason) => {
  console.error("", reason);
});

// MONGODB CONNECTION
const MONGO_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/technova";

mongoose
  .connect(MONGO_URI)
  .then(() => {
    console.log(`Connected → ${MONGO_URI}`);
  })
  .catch((err) => {
    console.error("Connection failed:", err.message);
    console.log("\n️  Troubleshooting:");
    console.log("1. Make sure MongoDB is running on your system");
    console.log("2. Open a new terminal and run: mongosh");
    console.log("3. If mongosh connects, MongoDB is running — restart this app");
    console.log("4. If mongosh fails, start MongoDB: net start MongoDB");
  });

// VIEW ENGINE
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// MIDDLEWARE
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.use(
  session({
    secret: process.env.SESSION_SECRET || "technova_secret_2026",
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, maxAge: 1000 * 60 * 60 * 8 },
  }),
);

// Global view locals — inject user + cart count into every view
app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  res.locals.cartCount = (req.session.cart || []).reduce(
    (s, i) => s + i.quantity,
    0,
  );
  res.locals.storeName = process.env.STORE_NAME || "TechNova";
  next();
});

// Ensure upload directory exists
const fs = require("fs");
if (!fs.existsSync("./uploads")) fs.mkdirSync("./uploads");

// WEBSOCKET ENGINE
const clients = new Set();
let viewerCount = 0;

wss.on("connection", (socket) => {
  clients.add(socket);
  viewerCount++;
  broadcast({ type: "VIEWER_COUNT", count: viewerCount });
  console.log(`Client connected. Total viewers: ${viewerCount}`);

  socket.on("message", (raw) => {
    try {
      const data = JSON.parse(raw);
      // Live chat relay
      if (data.type === "CHAT_MSG") {
        broadcast({
          type: "CHAT_MSG",
          sender: data.sender,
          message: data.message,
          timestamp: new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
        });
      }
    } catch (e) {
      /* ignore invalid messages */
    }
  });

  socket.on("close", () => {
    clients.delete(socket);
    viewerCount = Math.max(0, viewerCount - 1);
    broadcast({ type: "VIEWER_COUNT", count: viewerCount });
    console.log(`Client disconnected. Total viewers: ${viewerCount}`);
  });
});

function broadcast(data) {
  const msg = JSON.stringify(data);
  clients.forEach((client) => {
    if (client.readyState === 1) client.send(msg);
  });
}

// Expose broadcast helpers to routes via app.locals
app.locals.broadcastRefresh = () => broadcast({ type: "REFRESH_DATA" });
app.locals.broadcastNewOrder = (order) =>
  broadcast({
    type: "NEW_ORDER",
    orderId: order.orderId,
    amount: order.totalAmount,
  });
app.locals.broadcastOrderUpdate = (data) =>
  broadcast({ type: "ORDER_STATUS_UPDATE", ...data });

// ROUTES
const authRoutes = require("./routes/auth");
const shopRoutes = require("./routes/shop");
const cartRoutes = require("./routes/cart");
const orderRoutes = require("./routes/orders");
const adminRoutes = require("./routes/admin");

app.use("/", authRoutes);
app.use("/", shopRoutes);
app.use("/", cartRoutes);
app.use("/", orderRoutes);
app.use("/admin", adminRoutes);

// 404 FALLBACK
app.use((req, res) => {
  res.status(404).render("error", {
    title: "404 Not Found",
    message: "The page you are looking for does not exist.",
  });
});

// START SERVER + INIT MAILER
server.listen(PORT, async () => {
  console.log(`TechNova running at http://localhost:${PORT}`);
  try {
    await initMailer();
  } catch (e) {
    console.error("Failed to initialize:", e.message);
  }
});
