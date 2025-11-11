import User from "../models/User.js";
import Order from "../models/Order.js";

export const getDashboardStats = async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalOrders = await Order.countDocuments();
    const paidOrders = await Order.countDocuments({ paymentStatus: "Paid" });
    const deliveredOrders = await Order.countDocuments({ status: "Delivered" });

    const pendingOrders = await Order.countDocuments({ status: "Pending" });
    const activeDrivers = await User.countDocuments({ role: "driver" });

    res.json({
      totalUsers,
      totalOrders,
      paidOrders,
      deliveredOrders,
      pendingOrders,
      activeDrivers,
    });
  } catch (error) {
    console.error("❌ Admin dashboard error:", error.message);
    res.status(500).json({ message: "Failed to load admin dashboard" });
  }
};
