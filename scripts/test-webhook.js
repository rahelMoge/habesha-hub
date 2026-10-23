require("dotenv").config();
const crypto = require("crypto");

const ref = process.argv[2];
const event = process.argv[3] || "payment.success";

if (!ref) {
  console.log("Usage: node scripts/test-webhook.js <merchant_reference> [event]");
  process.exit(1);
}

const body = JSON.stringify({
  webhook_type: "payment",
  event,
  status: event === "payment.success" ? "success" : "failed",
  mode: "test",
  currency: "ETB",
  amount: "1500",
  merchant_reference: ref,
  chapa_reference: "TESTREF",
});

const signature = crypto
  .createHmac("sha256", process.env.CHAPA_WEBHOOK_SECRET)
  .update(body)
  .digest("hex");

fetch("http://localhost:5000/api/payments/webhook", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-chapa-signature": signature,
  },
  body,
}).then(async (r) => console.log(r.status, await r.text()));