import express from "express";
import { protect } from "../middlewares/authMiddleware.js";
import {
  getAdminDashboard,
  getSmeDashboard,
  getDriverDashboard,
} from "../controllers/dashboardController.js";

const router = express.Router();

// Role-based dashboard endpoints
router.get("/admin", protect, getAdminDashboard);
router.get("/sme", protect, getSmeDashboard);
router.get("/driver", protect, getDriverDashboard);

export default router;
