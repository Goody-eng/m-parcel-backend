import Order from "../models/Order.js";
import User from "../models/User.js";
import { notifyOrderStatusUpdate, notifyDriverAssignment } from "../services/notificationService.js";

// Get all drivers for assignment (prioritize unassigned drivers)
export const getDrivers = async (req, res) => {
  try {
    console.log("🔍 Fetching drivers...");
    
    // First, let's check all users to see what roles exist
    const allUsers = await User.find({}).select("name phone role");
    console.log(`📊 Total users in database: ${allUsers.length}`);
    allUsers.forEach(user => {
      console.log(`  - ${user.name} (${user.phone}): role = "${user.role}"`);
    });

    // Get all drivers
    const allDrivers = await User.find({ role: "driver" })
      .select("name phone location")
      .sort({ name: 1 });

    console.log(`🚗 Found ${allDrivers.length} driver(s) with role="driver"`);
    allDrivers.forEach(driver => {
      console.log(`  - ${driver.name} (${driver.phone})`);
    });

    // Get all active orders (Pending or InTransit) to determine assigned drivers
    const activeOrders = await Order.find({
      status: { $in: ["Pending", "InTransit"] },
      assignedDriver: { $exists: true, $ne: null },
    }).select("assignedDriver");

    console.log(`📦 Found ${activeOrders.length} active order(s) with assigned drivers`);

    // Create a set of assigned driver IDs
    const assignedDriverIds = new Set(
      activeOrders.map((order) => order.assignedDriver.toString())
    );

    // Separate drivers into assigned and unassigned
    const unassignedDrivers = [];
    const assignedDrivers = [];

    allDrivers.forEach((driver) => {
      const driverObj = driver.toObject();
      const isAssigned = assignedDriverIds.has(driver._id.toString());
      driverObj.isAssigned = isAssigned;

      if (isAssigned) {
        assignedDrivers.push(driverObj);
      } else {
        unassignedDrivers.push(driverObj);
      }
    });

    // Return unassigned drivers first, then assigned drivers
    // If no unassigned drivers, return all drivers with isAssigned flag
    const result = unassignedDrivers.length > 0 
      ? [...unassignedDrivers, ...assignedDrivers] 
      : allDrivers.map(d => ({
          ...d.toObject(),
          isAssigned: assignedDriverIds.has(d._id.toString())
        }));

    console.log(`✅ Returning ${result.length} driver(s): ${unassignedDrivers.length} unassigned, ${assignedDrivers.length} assigned`);
    res.json(result);
  } catch (error) {
    console.error("❌ Error in getDrivers:", error);
    res.status(500).json({ message: "Failed to fetch drivers" });
  }
};

// SME: create new order
export const createOrder = async (req, res) => {
  try {
    const {
      customerName,
      customerPhone,
      pickupAddress,
      dropoffAddress,
      amount,
      assignedDriver,
      vehicleType,
      referenceId,
      paymentMethod,
    } = req.body;

    const orderData = {
      orderId: "ORD" + Date.now(),
      customerName,
      customerPhone,
      pickupAddress,
      dropoffAddress,
      amount,
      createdBy: req.user._id,
    };

    // If driver is assigned during creation, add it
    if (assignedDriver) {
      const driver = await User.findById(assignedDriver);
      if (driver && driver.role === "driver") {
        orderData.assignedDriver = assignedDriver;
        orderData.status = "InTransit";
      }
    }

    // Store vehicle type and other details in a notes field (we can add a proper field later)
    if (vehicleType || referenceId || paymentMethod) {
      orderData.notes = JSON.stringify({ vehicleType, referenceId, paymentMethod });
    }

    const newOrder = await Order.create(orderData);
    const populatedOrder = await Order.findById(newOrder._id)
      .populate("assignedDriver", "name phone")
      .populate("createdBy", "name phone");

    // Send notification to customer about order creation
    try {
      console.log(`📧 Sending order creation notification to customer: ${populatedOrder.customerPhone}`);
      const notifyResult = await notifyOrderStatusUpdate(populatedOrder, "Pending");
      if (notifyResult.success) {
        console.log("✅ Order creation notification sent successfully");
      } else {
        console.error("❌ Failed to send order creation notification:", notifyResult.error);
      }
    } catch (err) {
      console.error("❌ Error sending order creation notification:", err);
    }

    // If driver is assigned, notify them
    if (populatedOrder.assignedDriver) {
      try {
        console.log(`📧 Sending driver assignment notification to: ${populatedOrder.assignedDriver.phone}`);
        const driverNotifyResult = await notifyDriverAssignment(populatedOrder.assignedDriver, populatedOrder);
        if (driverNotifyResult.success) {
          console.log("✅ Driver assignment notification sent successfully");
        } else {
          console.error("❌ Failed to send driver assignment notification:", driverNotifyResult.error);
        }
      } catch (err) {
        console.error("❌ Error sending driver assignment notification:", err);
      }
    }

    res.status(201).json(populatedOrder);
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

// SME: get single order by ID
export const getOrderById = async (req, res) => {
  try {
    const { id } = req.params;
    const order = await Order.findById(id)
      .populate("assignedDriver", "name phone role")
      .populate("createdBy", "name phone");

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    // Ensure only the creator or admin can view
    if (order.createdBy._id.toString() !== req.user._id.toString() && req.user.role !== "admin") {
      return res.status(403).json({ message: "Access denied" });
    }

    res.json(order);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to fetch order" });
  }
};

// SME: update order
export const updateOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      customerName,
      customerPhone,
      pickupAddress,
      dropoffAddress,
      amount,
      assignedDriver,
      vehicleType,
      referenceId,
      paymentMethod,
    } = req.body;

    console.log(`📝 Update order request - ID: ${id}, User: ${req.user._id}`);

    // Validate MongoDB ObjectId format
    if (!id || !id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ message: "Invalid order ID format" });
    }

    // Find order and verify ownership
    const order = await Order.findById(id);
    if (!order) {
      console.log(`❌ Order not found: ${id}`);
      return res.status(404).json({ message: "Order not found" });
    }

    if (order.createdBy.toString() !== req.user._id.toString() && req.user.role !== "admin") {
      return res.status(403).json({ message: "Access denied. You can only edit your own orders." });
    }

    // Don't allow editing if order is delivered or cancelled
    if (order.status === "Delivered" || order.status === "Cancelled") {
      return res.status(400).json({ message: "Cannot edit delivered or cancelled orders" });
    }

    // Build update object
    const updateData = {};
    if (customerName !== undefined) updateData.customerName = customerName;
    if (customerPhone !== undefined) updateData.customerPhone = customerPhone;
    if (pickupAddress !== undefined) updateData.pickupAddress = pickupAddress;
    if (dropoffAddress !== undefined) updateData.dropoffAddress = dropoffAddress;
    if (amount !== undefined) updateData.amount = amount;

    // Handle driver assignment or removal
    if (assignedDriver !== undefined) {
      if (assignedDriver === "" || assignedDriver === null) {
        // Remove driver assignment
        updateData.assignedDriver = null;
        // If order was InTransit, revert to Pending
        if (order.status === "InTransit") {
          updateData.status = "Pending";
        }
      } else {
        // Assign new driver
        const driver = await User.findById(assignedDriver);
        if (!driver || driver.role !== "driver") {
          return res.status(400).json({ message: "Invalid driver ID" });
        }
        updateData.assignedDriver = assignedDriver;
        if (order.status === "Pending") {
          updateData.status = "InTransit";
        }
      }
    }

    // Update notes
    if (vehicleType || referenceId || paymentMethod) {
      const existingNotes = order.notes ? JSON.parse(order.notes) : {};
      updateData.notes = JSON.stringify({
        ...existingNotes,
        vehicleType: vehicleType || existingNotes.vehicleType,
        referenceId: referenceId || existingNotes.referenceId,
        paymentMethod: paymentMethod || existingNotes.paymentMethod,
      });
    }

    const updatedOrder = await Order.findByIdAndUpdate(id, updateData, { new: true })
      .populate("assignedDriver", "name phone role")
      .populate("createdBy", "name phone");

    if (!updatedOrder) {
      console.log(`❌ Order not found after update: ${id}`);
      return res.status(404).json({ message: "Order not found after update" });
    }

    console.log(`✅ Order updated successfully: ${updatedOrder.orderId}`);
    res.json(updatedOrder);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to update order" });
  }
};

// SME: cancel order
export const cancelOrder = async (req, res) => {
  try {
    const { id } = req.params;

    const order = await Order.findById(id);
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    // Verify ownership
    if (order.createdBy.toString() !== req.user._id.toString() && req.user.role !== "admin") {
      return res.status(403).json({ message: "Access denied" });
    }

    // Don't allow cancelling if already delivered
    if (order.status === "Delivered") {
      return res.status(400).json({ message: "Cannot cancel a delivered order" });
    }

    // Don't allow cancelling if already cancelled
    if (order.status === "Cancelled") {
      return res.status(400).json({ message: "Order is already cancelled" });
    }

    const cancelledOrder = await Order.findByIdAndUpdate(
      id,
      { status: "Cancelled" },
      { new: true }
    )
      .populate("assignedDriver", "name phone role")
      .populate("createdBy", "name phone");

    res.json({
      message: "Order cancelled successfully",
      order: cancelledOrder,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to cancel order" });
  }
};

// SME: delete order (soft delete - only for pending/cancelled orders)
export const deleteOrder = async (req, res) => {
  try {
    const { id } = req.params;

    console.log(`🗑️ Delete order request - ID: ${id}, User: ${req.user._id}`);

    // Validate MongoDB ObjectId format
    if (!id || !id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ message: "Invalid order ID format" });
    }

    const order = await Order.findById(id);
    if (!order) {
      console.log(`❌ Order not found: ${id}`);
      return res.status(404).json({ message: "Order not found" });
    }

    // Verify ownership
    if (order.createdBy.toString() !== req.user._id.toString() && req.user.role !== "admin") {
      return res.status(403).json({ message: "Access denied. You can only delete your own orders." });
    }

    // Only allow deleting pending or cancelled orders
    if (order.status === "Delivered" || order.status === "InTransit") {
      return res.status(400).json({ 
        message: "Cannot delete delivered or in-transit orders. Please cancel them first." 
      });
    }

    // Delete the order
    const deletedOrder = await Order.findByIdAndDelete(id);

    if (!deletedOrder) {
      return res.status(404).json({ message: "Order not found for deletion" });
    }

    console.log(`✅ Order deleted successfully: ${deletedOrder.orderId}`);
    res.json({
      message: "Order deleted successfully",
    });
  } catch (error) {
    console.error("❌ Delete order error:", error);
    res.status(500).json({ message: "Failed to delete order" });
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
      { orderId, createdBy: req.user._id },
      { assignedDriver: driverId, status: "InTransit" },
      { new: true }
    )
      .populate("assignedDriver", "name phone role")
      .populate("createdBy", "name phone");

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    // Notify driver about assignment
    if (order.assignedDriver) {
      try {
        console.log(`📧 Sending driver assignment notification to: ${order.assignedDriver.phone}`);
        const driverNotifyResult = await notifyDriverAssignment(order.assignedDriver, order);
        if (driverNotifyResult.success) {
          console.log("✅ Driver assignment notification sent successfully");
        } else {
          console.error("❌ Failed to send driver assignment notification:", driverNotifyResult.error);
        }
      } catch (err) {
        console.error("❌ Error sending driver assignment notification:", err);
      }
    }

    // Notify customer about status update
    try {
      console.log(`📧 Sending status update notification to customer: ${order.customerPhone}`);
      const statusNotifyResult = await notifyOrderStatusUpdate(order, "InTransit");
      if (statusNotifyResult.success) {
        console.log("✅ Status update notification sent successfully");
      } else {
        console.error("❌ Failed to send status update notification:", statusNotifyResult.error);
      }
    } catch (err) {
      console.error("❌ Error sending status update notification:", err);
    }

    res.json(order);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error assigning driver" });
  }
};

// Driver: get assigned orders (active orders)
export const getMyAssignedOrders = async (req, res) => {
  try {
    const orders = await Order.find({
      assignedDriver: req.user._id,
      status: { $in: ["Pending", "InTransit"] },
    })
      .populate("createdBy", "name phone")
      .sort({ createdAt: -1 });
    res.json(orders);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to fetch assigned orders" });
  }
};

// Driver: get completed rides history
export const getCompletedRides = async (req, res) => {
  try {
    const orders = await Order.find({
      assignedDriver: req.user._id,
      status: "Delivered",
    })
      .populate("createdBy", "name phone")
      .sort({ deliveredAt: -1 });
    res.json(orders);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to fetch completed rides" });
  }
};

// Driver: finish ride (mark as delivered, update payment, free driver)
export const finishRide = async (req, res) => {
  try {
    const { orderId, paymentStatus } = req.body;
    
    // Get delivery proof file path if uploaded
    const deliveryProof = req.file ? `/uploads/delivery-proofs/${req.file.filename}` : null;

    // Find the order assigned to this driver
    const order = await Order.findOne({
      orderId,
      assignedDriver: req.user._id,
      status: { $in: ["Pending", "InTransit"] },
    });

    if (!order) {
      return res.status(404).json({
        message: "Order not found or not assigned to you, or already completed",
      });
    }

    // Update order: mark as delivered, update payment status, set delivery time, add proof
    const updatedOrder = await Order.findByIdAndUpdate(
      order._id,
      {
        status: "Delivered",
        paymentStatus: paymentStatus || "Paid",
        deliveredAt: new Date(),
        deliveryProof: deliveryProof || order.deliveryProof, // Keep existing if no new upload
      },
      { new: true }
    )
      .populate("assignedDriver", "name phone")
      .populate("createdBy", "name phone");

    // Notify customer about delivery
    try {
      console.log(`📧 Sending delivery notification to customer: ${updatedOrder.customerPhone}`);
      const deliveryNotifyResult = await notifyOrderStatusUpdate(updatedOrder, "Delivered");
      if (deliveryNotifyResult.success) {
        console.log("✅ Delivery notification sent successfully");
      } else {
        console.error("❌ Failed to send delivery notification:", deliveryNotifyResult.error);
      }
    } catch (err) {
      console.error("❌ Error sending delivery notification:", err);
    }

    res.status(200).json({
      message: "Ride completed successfully. You are now available for new assignments.",
      order: updatedOrder,
    });
  } catch (error) {
    console.error("❌ Finish ride error:", error);
    res.status(500).json({ message: "Failed to finish ride" });
  }
};

// Driver: confirm delivery (legacy - keeping for backward compatibility)
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
 // PATCH /api/orders/:id/deliver
export const updateDeliveryStatus = async (req, res) => {
    try {
      const { id } = req.params;
      const { status, deliveryProof } = req.body;
  
      // Ensure only drivers can mark delivery
      if (req.user.role !== "driver") {
        return res.status(403).json({ message: "Access denied. Drivers only." });
      }
  
      // Validate allowed statuses
      if (!["Delivered", "Cancelled"].includes(status)) {
        return res.status(400).json({ message: "Invalid status update." });
      }
  
      const order = await Order.findByIdAndUpdate(
        id,
        {
          status,
          deliveryProof: deliveryProof || null,
          deliveredAt: new Date(),
        },
        { new: true }
      );
  
      if (!order) {
        return res.status(404).json({ message: "Order not found." });
      }
  
      res.status(200).json({
        message: `Order marked as ${status}`,
        order,
      });
    } catch (err) {
      console.error("❌ Delivery update error:", err.message);
      res.status(500).json({ message: "Failed to update delivery status." });
    }
  };
  