const express = require("express");
const axios = require("axios");
const crypto = require("crypto");

const app = express();
app.use(express.json());

const FB_PIXEL_ID = process.env.FB_PIXEL_ID;
const FB_ACCESS_TOKEN = process.env.FB_ACCESS_TOKEN;
const RAZORPAY_SECRET = process.env.RAZORPAY_SECRET;

function verifySignature(req) {
  const body = JSON.stringify(req.body);
  const expected = crypto
    .createHmac("sha256", RAZORPAY_SECRET)
    .update(body)
    .digest("hex");

  return expected === req.headers["x-razorpay-signature"];
}

app.post("/webhook", async (req, res) => {
  if (!verifySignature(req)) {
    return res.status(400).send("Invalid Razorpay signature");
  }

  const event = req.body.event;
  if (event !== "payment.captured") {
    return res.status(200).send("Ignored");
  }

  const payment = req.body.payload.payment.entity;
  const amount = payment.amount / 100;

  try {
    await axios.post(
      `https://graph.facebook.com/v18.0/${FB_PIXEL_ID}/events`,
      {
        data: [
          {
            event_name: "Purchase",
            event_time: Math.floor(Date.now() / 1000),
            action_source: "website",
            custom_data: {
              currency: "INR",
              value: amount,
            },
          },
        ],
      },
      { params: { access_token: FB_ACCESS_TOKEN } }
    );

    res.status(200).json({ success: true });
  } catch (err) {
    console.log("FB Error:", err.response?.data);
    res.status(500).send("Facebook Error");
  }
});

app.get("/", (req, res) => {
  res.send("Razorpay CAPI Server Running");
});

app.listen(8080);
