const express = require("express");
const crypto = require("crypto");
const axios = require("axios");

const app = express();

// 🔐 env vars
const FB_PIXEL_ID = process.env.FB_PIXEL_ID;
const FB_ACCESS_TOKEN = process.env.FB_ACCESS_TOKEN;
const RAZORPAY_SECRET = process.env.RAZORPAY_SECRET;

// ✅ capture RAW body exactly as Razorpay sent it
app.use(express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf; // Buffer (not string)
  }
}));

// ✅ signature check using RAW body
function verifySignature(req) {
  const expected = crypto
    .createHmac("sha256", RAZORPAY_SECRET)
    .update(req.rawBody)            // <— the critical fix
    .digest("hex");

  const received = req.headers["x-razorpay-signature"];
  return expected === received;
}

app.post("/webhook", async (req, res) => {
  if (!verifySignature(req)) {
    console.log("❌ Invalid signature");
    return res.status(400).send("Invalid Razorpay signature");
  }

  const evt = req.body?.event;
  if (evt !== "payment.captured") {
    return res.status(200).send("Ignored");
  }

  const payment = req.body?.payload?.payment?.entity;
  const amount = (payment?.amount ?? 0) / 100;

  try {
    const fb = await axios.post(
      `https://graph.facebook.com/v18.0/${FB_PIXEL_ID}/events`,
      {
        data: [
          {
            event_name: "Purchase",
            event_time: Math.floor(Date.now() / 1000),
            action_source: "website",
            custom_data: { currency: "INR", value: amount }
          }
        ]
      },
      { params: { access_token: FB_ACCESS_TOKEN } }
    );

    console.log("✅ CAPI sent:", fb.data);
    return res.status(200).json({ success: true });
  } catch (e) {
    console.log("⚠️ CAPI error:", e.response?.data || e.message);
    return res.status(500).send("Facebook CAPI Error");
  }
});

// simple health check
app.get("/", (req, res) => res.send("Razorpay CAPI Server Running"));
app.listen(8080, () => console.log("Server on :8080"));
