import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import morgan from "morgan";
import path from "path";
import { fileURLToPath } from "url";
import connectDB from "./config/db.js";
import authRoutes from "./routes/authRoutes.js";
import orderRoutes from "./routes/orderRoutes.js";
import paymentRoutes from "./routes/paymentRoutes.js";
import { protect } from "./middlewares/authMiddleware.js";
import adminRoutes from "./routes/adminRoutes.js";  
import userRoutes from "./routes/userRoutes.js";
import dashboardRoutes from "./routes/dashboardRoutes.js";
import panicRoutes from "./routes/panicRoutes.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();
connectDB();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

// Serve static files (delivery proofs)
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

// Test Route
app.get("/", (req, res) => {
  res.send("🚚 M-PARCEL Backend API is running...");
});

app.use("/api/auth", authRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/users", userRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/panic", panicRoutes);

// Test routes
app.get("/api/test/protected", protect, (req, res) => {
  res.json({ message: "You are authenticated!", user: req.user });
});

// Test panic route registration
app.get("/api/test/panic-route", (req, res) => {
  res.json({ message: "Panic routes are registered", routes: ["/api/panic/trigger", "/api/panic/history"] });
});

// Server Listen
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📋 Registered API routes:`);
  console.log(`   - /api/auth`);
  console.log(`   - /api/orders`);
  console.log(`   - /api/payments`);
  console.log(`   - /api/admin`);
  console.log(`   - /api/users`);
  console.log(`   - /api/dashboard`);
  console.log(`   - /api/panic (POST /trigger, GET /history)`);
});
