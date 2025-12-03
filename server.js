const express = require("express");
const axios = require("axios");
const crypto = require("crypto");

const app = express();
app.use(express.json());

// Environment Variables
const FB_PIXEL_ID = process.env.FB_PIXEL_ID;
const FB_ACCESS_TOKEN = process.env.FB_ACCESS_TOKEN;
const RAZORPAY_SECRET = process.env.RAZORPAY_SECRET;

// Verify Razorpay Signature
function verifySignature(req) {
  const body = JSON.stringify(req.body);
  const expectedSignature = crypto
    .createHmac("sha256", RAZORPAY_SECRET)
    .update(body)
    .digest("hex");

  return expectedSignature === req.headers["x-razorpay-signature"];
}

app.post("/webhook", async (req, res) => {
  // Signature validation
  if (!verifySignature(req)) {
    console.log("Invalid signature");
    return res.status(400).send("Invalid Razorpay signature");
  }

  const event = req.body.event;

  if (event !== "payment.captured") {
    return res.status(200).send("Event ignored");
  }

  const payment = req.body.payload.payment.entity;
  const amount = payment.amount / 100;

  try {
    const fbResponse = await axios.post(
      `https://graph.facebook.com/v18.0/${FB_PIXEL_ID}/events`,
      {
        data: [
          {
            event_name: "Purchase",
            event_time: Math.floor(Date.now() / 1000),
            action_source: "website",
            custom_data: {
              currency: "INR",
              value: amount
            }
          }
        ]
      },
      {
        params: { access_token: FB_ACCESS_TOKEN }
      }
    );

    console.log("CAPI Event Sent:", fbResponse.data);
    res.status(200).json({ success: true });
  } catch (err) {
    console.log("Facebook CAPI Error:", err.response?.data);
    res.status(500).send("Facebook CAPI Error");
  }
});

// Default route for browser check
app.get("/", (req, res) => {
  res.send("Razorpay CAPI Server Running");
});

app.listen(8080, () => console.log("Server Running on port 8080"));
