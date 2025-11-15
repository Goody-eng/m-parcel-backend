import { sendPanicAlert } from "../services/notificationService.js";
import User from "../models/User.js";

// Driver: Trigger panic button
export const triggerPanic = async (req, res) => {
  try {
    // Only drivers can trigger panic
    if (req.user.role !== "driver") {
      return res.status(403).json({ 
        message: "Access denied. Only drivers can trigger panic alerts." 
      });
    }

    const driver = await User.findById(req.user._id);
    if (!driver) {
      return res.status(404).json({ message: "Driver not found" });
    }

    // Get driver location if available
    const location = driver.location && driver.location.lat 
      ? { lat: driver.location.lat, lon: driver.location.lon }
      : null;

    // Send panic alert to all admins
    const result = await sendPanicAlert(driver, location);

    if (result.success) {
      console.log(`🚨 Panic alert triggered by driver ${driver.name} (${driver.phone})`);
      res.status(200).json({
        message: "Panic alert sent successfully. Help is on the way!",
        notified: result.notified,
      });
    } else {
      res.status(500).json({
        message: "Failed to send panic alert. Please call emergency services directly.",
        error: result.error,
      });
    }
  } catch (error) {
    console.error("❌ Panic trigger error:", error);
    res.status(500).json({ 
      message: "Failed to trigger panic alert",
      error: error.message 
    });
  }
};

// Admin: Get panic alert history (future feature)
export const getPanicHistory = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Access denied. Admin only." });
    }

    // TODO: Store panic alerts in database for history
    res.json({ message: "Panic history feature coming soon" });
  } catch (error) {
    console.error("❌ Get panic history error:", error);
    res.status(500).json({ message: "Failed to fetch panic history" });
  }
};

