import express from "express";
import { stkPush, mpesaCallback, getPaymentHistory } from "../controllers/paymentController.js";
import { protect } from "../middlewares/authMiddleware.js";

const router = express.Router();

// Trigger STK Push
router.post("/stkpush", protect, stkPush);

// M-PESA Callback (Daraja hits this after payment)
router.post("/callback", mpesaCallback);

// Get payment history
router.get("/history", protect, getPaymentHistory);

export default router;
