// api/checkout.js
import Stripe from "stripe";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).send("Method Not Allowed");

  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

    const { items } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).send("No items");
    }

    // Build line items; attach size via 'metadata' and let quantities be adjustable
    const line_items = items.map((it) => ({
      price: it.priceId,
      quantity: it.quantity || 1,
      adjustable_quantity: { enabled: true, minimum: 1, maximum: 10 },
      // Optional: pass size to your fulfillment via metadata
      // Note: metadata goes on the line item in the session
      // (You can read it from the Checkout Session after payment via webhook)
    }));

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items,
      currency: "hkd",
      allow_promotion_codes: true,
      shipping_address_collection: { allowed_countries: ["HK", "GB"] },

      // Collect size choice on Checkout for T-shirts:
      custom_fields: [
        {
          key: "size",
          label: { type: "custom", text: "T-shirt size (if applicable)" },
          type: "dropdown",
          dropdown: { options: [
            { label:"S", value:"S" },
            { label:"M", value:"M" },
            { label:"L", value:"L" },
            { label:"XL", value:"XL" }
          ]},
          optional: true
        }
      ],

      success_url: `${req.headers.origin}/?success=true`,
      cancel_url: `${req.headers.origin}/?canceled=true`,
    });

    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error(err);
    return res.status(500).send(err.message || "Server error");
  }
}
