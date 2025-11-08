import express from "express";
import {
  createOrder,
  getMyOrders,
  assignDriver,
  confirmDelivery,
  getAllOrders,
} from "../controllers/orderController.js";
import { protect, adminOnly } from "../middlewares/authMiddleware.js";

const router = express.Router();

// SME routes
router.post("/create", protect, createOrder);
router.get("/mine", protect, getMyOrders);
router.post("/assign", protect, assignDriver);

// Driver route
router.post("/confirm", protect, confirmDelivery);

// Admin route
router.get("/all", protect, adminOnly, getAllOrders);

export default router;
