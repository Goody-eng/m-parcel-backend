import axios from "axios";

/**
 * Notification Service
 * Handles WhatsApp, SMS, and Email notifications
 */

// Send SMS using Africa's Talking API (or Twilio)
export const sendSMS = async (phoneNumber, message) => {
  try {
    // For now, we'll use a simple console log
    // In production, integrate with Africa's Talking or Twilio
    console.log(`📱 [SMS] To: ${phoneNumber}`);
    console.log(`   Message: ${message}`);
    console.log(`   ✅ SMS sent (simulated)`);
    
    // TODO: Integrate with Africa's Talking API
    // const response = await axios.post(
    //   "https://api.africastalking.com/version1/messaging",
    //   {
    //     username: process.env.AFRICASTALKING_USERNAME,
    //     to: phoneNumber,
    //     message: message,
    //   },
    //   {
    //     headers: {
    //       apiKey: process.env.AFRICASTALKING_API_KEY,
    //       "Content-Type": "application/x-www-form-urlencoded",
    //     },
    //   }
    // );
    
    return { success: true, message: "SMS sent (simulated)" };
  } catch (error) {
    console.error("❌ SMS Error:", error);
    return { success: false, error: error.message };
  }
};

// Send WhatsApp message using Meta Cloud API or Twilio
export const sendWhatsApp = async (phoneNumber, message) => {
  try {
    // For now, we'll use a simple console log
    // In production, integrate with Meta Cloud API or Twilio
    console.log(`💬 [WhatsApp] To: ${phoneNumber}`);
    console.log(`   Message: ${message}`);
    console.log(`   ✅ WhatsApp sent (simulated)`);
    
    // TODO: Integrate with Meta Cloud API
    // const response = await axios.post(
    //   `https://graph.facebook.com/v18.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
    //   {
    //     messaging_product: "whatsapp",
    //     to: phoneNumber,
    //     type: "text",
    //     text: { body: message },
    //   },
    //   {
    //     headers: {
    //       Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
    //       "Content-Type": "application/json",
    //     },
    //   }
    // );
    
    return { success: true, message: "WhatsApp sent (simulated)" };
  } catch (error) {
    console.error("❌ WhatsApp Error:", error);
    return { success: false, error: error.message };
  }
};

// Send notification (tries WhatsApp first, falls back to SMS)
export const sendNotification = async (phoneNumber, message, preferredMethod = "sms") => {
  try {
    // Format phone number (ensure it starts with country code)
    let formattedPhone = phoneNumber.toString().trim();
    if (!formattedPhone.startsWith("254")) {
      if (formattedPhone.startsWith("0")) {
        formattedPhone = "254" + formattedPhone.substring(1);
      } else if (formattedPhone.startsWith("+")) {
        formattedPhone = formattedPhone.substring(1);
      } else {
        formattedPhone = "254" + formattedPhone;
      }
    }

    if (preferredMethod === "whatsapp") {
      const result = await sendWhatsApp(formattedPhone, message);
      if (!result.success) {
        // Fallback to SMS if WhatsApp fails
        return await sendSMS(formattedPhone, message);
      }
      return result;
    } else {
      return await sendSMS(formattedPhone, message);
    }
  } catch (error) {
    console.error("❌ Notification Error:", error);
    return { success: false, error: error.message };
  }
};

// Send order status update to customer
export const notifyOrderStatusUpdate = async (order, status) => {
  try {
    const statusMessages = {
      Pending: `Your order ${order.orderId} has been created and is pending assignment.`,
      InTransit: `Great news! Your order ${order.orderId} is on the way. Driver is heading to ${order.dropoffAddress}.`,
      Delivered: `🎉 Your order ${order.orderId} has been delivered successfully to ${order.dropoffAddress}. Thank you for choosing M-PARCEL!`,
      Cancelled: `Your order ${order.orderId} has been cancelled. If you have any questions, please contact us.`,
    };

    const message = statusMessages[status] || `Your order ${order.orderId} status has been updated to ${status}.`;
    
    // Send to customer
    await sendNotification(order.customerPhone, message, "whatsapp");
    
    return { success: true };
  } catch (error) {
    console.error("❌ Order notification error:", error);
    return { success: false, error: error.message };
  }
};

// Send driver assignment notification
export const notifyDriverAssignment = async (driver, order) => {
  try {
    const message = `🚚 New delivery assigned! Order ${order.orderId}: Pickup from ${order.pickupAddress} → Deliver to ${order.dropoffAddress}. Customer: ${order.customerName} (${order.customerPhone}). Amount: KES ${order.amount}`;
    
    await sendNotification(driver.phone, message, "sms");
    
    return { success: true };
  } catch (error) {
    console.error("❌ Driver assignment notification error:", error);
    return { success: false, error: error.message };
  }
};

// Send panic alert to admin/security
export const sendPanicAlert = async (driver, location = null) => {
  try {
    // Get all admin users
    const User = (await import("../models/User.js")).default;
    const admins = await User.find({ role: "admin" }).select("phone name");
    
    const locationText = location 
      ? `Location: ${location.lat}, ${location.lon}` 
      : "Location not available";
    
    const message = `🚨 PANIC ALERT! Driver ${driver.name} (${driver.phone}) has triggered an emergency alert. ${locationText}. Please respond immediately!`;
    
    // Send to all admins
    const results = await Promise.all(
      admins.map(admin => sendNotification(admin.phone, message, "sms"))
    );
    
    console.log(`🚨 Panic alert sent to ${admins.length} admin(s)`);
    
    return { success: true, notified: admins.length };
  } catch (error) {
    console.error("❌ Panic alert error:", error);
    return { success: false, error: error.message };
  }
};

