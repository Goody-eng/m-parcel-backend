import Order from "../models/Order.js";
import User from "../models/User.js";

// 🧮 ADMIN — Sees all stats
export const getAdminDashboard = async (req, res) => {
  try {
    const totalOrders = await Order.countDocuments();
    const pendingOrders = await Order.countDocuments({ status: "Pending" });
    const deliveredOrders = await Order.countDocuments({ status: "Delivered" });
    const totalUsers = await User.countDocuments();

    res.json({
      totalOrders,
      pendingOrders,
      deliveredOrders,
      totalUsers,
    });
  } catch (error) {
    res.status(500).json({ message: "Error loading admin stats", error });
  }
};

// 🧑‍💼 SME — Sees only their orders
export const getSmeDashboard = async (req, res) => {
  try {
    const totalOrders = await Order.countDocuments({ createdBy: req.user._id });
    const pendingOrders = await Order.countDocuments({
      createdBy: req.user._id,
      status: "Pending",
    });
    const deliveredOrders = await Order.countDocuments({
      createdBy: req.user._id,
      status: "Delivered",
    });

    res.json({
      totalOrders,
      pendingOrders,
      deliveredOrders,
    });
  } catch (error) {
    res.status(500).json({ message: "Error loading SME dashboard", error });
  }
};

// 🚚 DRIVER — Sees only assigned deliveries
export const getDriverDashboard = async (req, res) => {
  try {
    const totalOrders = await Order.countDocuments({
      assignedDriver: req.user._id,
    });
    const deliveredOrders = await Order.countDocuments({
      assignedDriver: req.user._id,
      status: "Delivered",
    });
    const inTransitOrders = await Order.countDocuments({
      assignedDriver: req.user._id,
      status: "InTransit",
    });

    res.json({
      totalOrders,
      inTransitOrders,
      deliveredOrders,
    });
  } catch (error) {
    res.status(500).json({ message: "Error loading driver dashboard", error });
  }
};
