import express from "express";
import {
  createOrder,
  getMyOrders,
  getOrderById,
  updateOrder,
  cancelOrder,
  deleteOrder,
  assignDriver,
  confirmDelivery,
  getAllOrders,
  updateDeliveryStatus,
  getDrivers,
  getMyAssignedOrders,
  getCompletedRides,
  finishRide,
  } from "../controllers/orderController.js";
import { protect, adminOnly } from "../middlewares/authMiddleware.js";
import upload from "../middlewares/uploadMiddleware.js";

const router = express.Router();

// Get drivers list (for SME to assign)
router.get("/drivers", protect, getDrivers);

// Specific routes (must come before /:id)
router.get("/mine", protect, getMyOrders); // SME: get all my orders
router.get("/assigned", protect, getMyAssignedOrders); // Driver: get active orders
router.get("/completed", protect, getCompletedRides); // Driver: get completed rides
router.get("/all", protect, adminOnly, getAllOrders); // Admin: get all orders (MUST come before /:id)
router.post("/create", protect, createOrder); // SME: create order
router.post("/assign", protect, assignDriver); // SME: assign driver
router.post("/finish", protect, upload.single("deliveryProof"), finishRide); // Driver: finish ride with optional proof upload
router.post("/confirm", protect, confirmDelivery); // Legacy endpoint

// Dynamic routes (must come after specific routes)
router.get("/:id", protect, getOrderById); // Get single order
router.put("/:id", protect, updateOrder); // Update order
router.delete("/:id", protect, deleteOrder); // Delete order (must come before /:id/cancel)
router.patch("/:id/cancel", protect, cancelOrder); // Cancel order
router.patch("/:id/deliver", protect, updateDeliveryStatus); // Driver: update delivery status

export default router;
