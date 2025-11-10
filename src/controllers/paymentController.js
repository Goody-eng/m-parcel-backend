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
    const callbackData = req.body;

    const resultCode =
      callbackData?.Body?.stkCallback?.ResultCode ?? "NoResultCode";

    if (resultCode === 0) {
      const metadata =
        callbackData.Body.stkCallback.CallbackMetadata.Item || [];
      const mpesaReceipt = metadata.find(
        (item) => item.Name === "MpesaReceiptNumber"
      )?.Value;
      const amount = metadata.find((item) => item.Name === "Amount")?.Value;
      const phone = metadata.find((item) => item.Name === "PhoneNumber")?.Value;
      const orderId = callbackData.Body.stkCallback.MerchantRequestID;

      await Order.findOneAndUpdate(
        { orderId },
        { paymentStatus: "Paid", status: "Completed", mpesaReceipt, phone }
      );
    }

    res.status(200).json({ message: "Callback received successfully" });
  } catch (err) {
    console.error("Callback Error:", err.message);
    res.status(500).json({ message: "Error handling callback" });
  }
};
