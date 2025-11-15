import express from "express";
import { triggerPanic, getPanicHistory } from "../controllers/panicController.js";
import { protect } from "../middlewares/authMiddleware.js";

const router = express.Router();

// Driver: Trigger panic button
router.post("/trigger", protect, triggerPanic);

// Admin: Get panic history
router.get("/history", protect, getPanicHistory);

export default router;

