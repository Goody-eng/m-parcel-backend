import Order from "../models/Order.js";
import User from "../models/User.js";

// SME: create new order
export const createOrder = async (req, res) => {
  try {
    const { customerName, customerPhone, pickupAddress, dropoffAddress, amount } = req.body;

    const newOrder = await Order.create({
      orderId: "ORD" + Date.now(),
      customerName,
      customerPhone,
      pickupAddress,
      dropoffAddress,
      amount,
      createdBy: req.user._id,
    });

    res.status(201).json(newOrder);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error while creating order" });
  }
};

// SME: view all orders they created
export const getMyOrders = async (req, res) => {
  try {
    const orders = await Order.find({ createdBy: req.user._id })
      .populate("assignedDriver", "name phone role");
    res.json(orders);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Unable to fetch orders" });
  }
};

// SME: assign a driver
export const assignDriver = async (req, res) => {
  try {
    const { orderId, driverId } = req.body;

    const driver = await User.findById(driverId);
    if (!driver || driver.role !== "driver") {
      return res.status(400).json({ message: "Invalid driver ID" });
    }

    const order = await Order.findOneAndUpdate(
        { orderId },
        { assignedDriver: driverId, status: "InTransit" },
        { new: true }
      ).populate("assignedDriver", "name phone role");
      
      res.json(order);
      

    res.json(order);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error assigning driver" });
  }
};

// Driver: confirm delivery
export const confirmDelivery = async (req, res) => {
  try {
    const { orderId } = req.body;

    const order = await Order.findOneAndUpdate(
      { orderId, assignedDriver: req.user._id },
      { status: "Delivered" },
      { new: true }
    );

    if (!order) {
      return res.status(404).json({ message: "Order not found or not assigned to you" });
    }

    res.json(order);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error confirming delivery" });
  }
};

// Admin: get all orders (for monitoring)
export const getAllOrders = async (req, res) => {
  try {
    const orders = await Order.find()
      .populate("createdBy", "name phone role")
      .populate("assignedDriver", "name phone role");
    res.json(orders);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Cannot retrieve all orders" });
  }
};
