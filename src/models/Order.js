import mongoose from "mongoose";

const orderSchema = new mongoose.Schema(
  {
    orderId: { type: String, required: true, unique: true },
    customerName: { type: String, required: true },
    customerPhone: { type: String, required: true },
    pickupAddress: { type: String, required: true },
    dropoffAddress: { type: String, required: true },
    amount: { type: Number, required: true },
    status: {
      type: String,
      enum: ["Pending", "InTransit", "Delivered", "Cancelled"],
      default: "Pending",
    },
    paymentStatus: {
      type: String,
      enum: ["Unpaid", "Paid", "Reconciled"],
      default: "Unpaid",
    },
    assignedDriver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User", // SME who created it
      required: true,
    },
    deliveryProof: { type: String },
  },
  { timestamps: true }
);

const Order = mongoose.model("Order", orderSchema);
export default Order;
