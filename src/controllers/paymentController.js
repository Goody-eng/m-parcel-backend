import axios from "axios";
import dotenv from "dotenv";
import Order from "../models/Order.js";

dotenv.config();

// Get access token from Safaricom
const getAccessToken = async () => {
  const auth = Buffer.from(
    `${process.env.MPESA_CONSUMER_KEY}:${process.env.MPESA_CONSUMER_SECRET}`
  ).toString("base64");

  const response = await axios.get(
    "https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials",
    {
      headers: { Authorization: `Basic ${auth}` },
    }
  );

  return response.data.access_token;
};

// STK Push endpoint
export const stkPush = async (req, res) => {
  try {
    const { phoneNumber, amount, orderId } = req.body;

    const token = await getAccessToken();

    const timestamp = new Date()
      .toISOString()
      .replace(/[-:TZ.]/g, "")
      .slice(0, 14);

    const password = Buffer.from(
      `${process.env.MPESA_SHORTCODE}${process.env.MPESA_PASSKEY}${timestamp}`
    ).toString("base64");

    const response = await axios.post(
      "https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest",
      {
        BusinessShortCode: process.env.MPESA_SHORTCODE,
        Password: password,
        Timestamp: timestamp,
        TransactionType: "CustomerPayBillOnline",
        Amount: amount,
        PartyA: phoneNumber,
        PartyB: process.env.MPESA_SHORTCODE,
        PhoneNumber: phoneNumber,
        CallBackURL: `${process.env.BASE_URL}/api/payments/callback`,
        AccountReference: orderId,
        TransactionDesc: "M-PARCEL Payment",
      },
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    res.status(200).json(response.data);
  } catch (error) {
    console.error("STK Push Error:", error.response?.data || error.message);
    res.status(500).json({ message: "Payment initiation failed" });
  }
};

// Callback handler
export const mpesaCallback = async (req, res) => {
    try {
      console.log("📩 M-PESA Callback received:");
      console.log(JSON.stringify(req.body, null, 2));
  
      const callbackData = req.body;
      const resultCode = callbackData?.Body?.stkCallback?.ResultCode ?? null;
      const merchantRequestID =
        callbackData?.Body?.stkCallback?.MerchantRequestID ?? null;
      const checkoutRequestID =
        callbackData?.Body?.stkCallback?.CheckoutRequestID ?? null;
  
      // Log result for debugging
      console.log(`Result Code: ${resultCode}`);
      console.log(`MerchantRequestID: ${merchantRequestID}`);
      console.log(`CheckoutRequestID: ${checkoutRequestID}`);
  
      if (resultCode === 0) {
        const metadata = callbackData.Body.stkCallback.CallbackMetadata.Item || [];

        const mpesaReceipt = metadata.find(
          (item) => item.Name === "MpesaReceiptNumber"
        )?.Value;
        const amount = metadata.find((item) => item.Name === "Amount")?.Value;
        const phone = metadata.find((item) => item.Name === "PhoneNumber")?.Value;
        
        // M-PESA doesn't return AccountReference in callback, so we need to find by phone + amount
        // or by CheckoutRequestID if we stored it
        console.log(`🔍 Searching for order with phone: ${phone}, amount: ${amount}`);
        
        // Try to find order by customer phone and amount (most recent unpaid order)
        // Format phone number to match (remove leading + or 0)
        let formattedPhone = phone?.toString() || "";
        if (formattedPhone.startsWith("254")) {
          formattedPhone = formattedPhone;
        } else if (formattedPhone.startsWith("0")) {
          formattedPhone = "254" + formattedPhone.substring(1);
        } else if (formattedPhone.startsWith("+")) {
          formattedPhone = formattedPhone.substring(1);
        }

        // Find the most recent unpaid order matching phone and amount
        const order = await Order.findOneAndUpdate(
          { 
            customerPhone: { $regex: formattedPhone.slice(-9) }, // Match last 9 digits
            amount: amount,
            paymentStatus: { $ne: "Paid" } // Only update if not already paid
          },
          {
            paymentStatus: "Paid",
            mpesaReceipt: mpesaReceipt || null,
          },
          { 
            new: true,
            sort: { createdAt: -1 } // Get most recent order first
          }
        );

        if (order) {
          console.log("✅ Order updated after payment:");
          console.log(`   Order ID: ${order.orderId}`);
          console.log(`   Customer: ${order.customerName}`);
          console.log(`   Amount: ${order.amount}`);
          console.log(`   M-PESA Receipt: ${mpesaReceipt}`);
        } else {
          console.warn("⚠️ Order not found matching phone and amount");
          console.warn(`   Searched for phone ending in: ${formattedPhone.slice(-9)}`);
          console.warn(`   Amount: ${amount}`);
          console.warn("   Available unpaid orders:");
          const unpaidOrders = await Order.find({ paymentStatus: { $ne: "Paid" } })
            .select("orderId customerPhone customerName amount createdAt")
            .sort({ createdAt: -1 })
            .limit(5);
          unpaidOrders.forEach(o => {
            console.warn(`     - ${o.orderId}: ${o.customerPhone} - ${o.customerName} - KES ${o.amount}`);
          });
        }
      } else {
        console.warn("⚠️ Payment not successful, result code:", resultCode);
      }
  
      res.status(200).json({ message: "Callback received successfully" });
    } catch (err) {
      console.error("❌ Callback Error:", err.message);
      console.error("❌ Callback Error Stack:", err.stack);
      res.status(500).json({ message: "Error handling callback" });
    }
  };

  // Get all successful payments
export const getPaymentHistory = async (req, res) => {
    try {
      const orders = await Order.find({ paymentStatus: "Paid" })
        .populate("createdBy", "name email role")
        .sort({ updatedAt: -1 });
  
      res.status(200).json(orders);
    } catch (err) {
      console.error("❌ Error fetching payment history:", err.message);
      res.status(500).json({ message: "Failed to fetch payment history" });
    }
  };
  