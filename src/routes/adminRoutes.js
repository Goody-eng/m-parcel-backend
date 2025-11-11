import express from "express";
import { protect } from "../middlewares/authMiddleware.js";
import { getDashboardStats } from "../controllers/adminController.js";

const router = express.Router();

// Admin-only route
router.get("/dashboard", protect, async (req, res, next) => {
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Access denied. Admins only." });
    }
    next();
  }, getDashboardStats);
  

export default router;
