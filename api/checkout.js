// /api/checkout.js — enhanced logging + clear error messages
const Stripe = require("stripe");

module.exports = async function handler(req, res) {
  const json = (status, obj) => res.status(status).json(obj);

  try {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return res.status(405).send("Method Not Allowed");
    }

    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) return res.status(500).send("Missing STRIPE_SECRET_KEY environment variable");
    if (!key.startsWith("sk_")) return res.status(500).send("STRIPE_SECRET_KEY must start with sk_ (secret key)");

    const stripe = Stripe(key);
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const items = Array.isArray(body.items) ? body.items : [];
    if (!items.length) return res.status(400).send("No items in request body");

    const line_items = items.map((it) => ({
      price: it.priceId,
      quantity: Math.max(1, Number(it.quantity || 1)),
      adjustable_quantity: { enabled: true, minimum: 1, maximum: 10 },
    }));

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items,
      allow_promotion_codes: true,
      billing_address_collection: "auto",
      shipping_address_collection: { allowed_countries: ["HK", "GB"] },
      success_url: `${req.headers.origin || "https://littlemarket.vercel.app"}/?success=true`,
      cancel_url: `${req.headers.origin || "https://littlemarket.vercel.app"}/?canceled=true`,
    });

    return json(200, { url: session.url });
  } catch (err) {
    // Surface useful data in the response to debug quickly
    const payload = {
      message: err && err.message ? err.message : "Server error",
      type: err && err.type,
      code: err && err.code,
      errno: err && err.errno,
      syscall: err && err.syscall,
      statusCode: err && err.statusCode,
    };
    console.error("[checkout] error:", payload, err && err.stack);
    return json(500, payload);
  }
};
