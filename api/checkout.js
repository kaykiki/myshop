// /api/checkout.js — LIVE mode ready, NO custom_fields (quickest to ship)
const Stripe = require("stripe");

module.exports = async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return res.status(405).send("Method Not Allowed");
    }

    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) return res.status(500).send("Missing STRIPE_SECRET_KEY");
    const stripe = Stripe(key);

    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const items = Array.isArray(body.items) ? body.items : [];
    if (!items.length) return res.status(400).send("No items");

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

    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error("[checkout] error:", err);
    return res.status(500).send(err.message || "Server error");
  }
};
