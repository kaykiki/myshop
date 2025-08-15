// /api/checkout.js  — Vercel Serverless Function (Node 18+)
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY); // sk_test_... or sk_live_...

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end('Method Not Allowed');

  try {
    const { items, currency = 'hkd' } = req.body || {};
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'No items provided' });
    }

    // Convert cart items to Stripe line_items
    // Preferred: use Stripe Price IDs (price_***). Fallback: amount + name.
    const line_items = items.map((it) =>
      it.price
        ? { price: it.price, quantity: it.quantity || 1 }
        : {
            quantity: it.quantity || 1,
            price_data: {
              currency,
              unit_amount: it.amount, // in cents: HK$350 -> 35000
              product_data: { name: it.name },
            },
          }
    );

    // Shipping
    const shippingRateId = process.env.SHIPPING_RATE_ID; // e.g. shr_...
    const freeThreshold = Number(process.env.FREE_SHIPPING_THRESHOLD || 0); // cents (e.g. 30000 for HK$300)

    // Compute subtotal (only for fallback amount items; price IDs subtotal is not required here)
    const subtotal =
      items
        .map((it) => (it.amount ? it.amount * (it.quantity || 1) : 0))
        .reduce((a, b) => a + b, 0);

    const params = {
      mode: 'payment',
      line_items,
      // Enable address collection so shipping can be applied
      shipping_address_collection: { allowed_countries: ['HK'] },
      success_url: `${req.headers.origin}/success.html`,
      cancel_url: `${req.headers.origin}/`,
      // Handy: keep a readable cart snapshot in the session metadata
      metadata: {
        cart: JSON.stringify(
          items.map(({ name, quantity, metadata }) => ({
            name,
            quantity,
            ...(metadata || {}),
          }))
        ),
      },
    };

    // Apply shipping once per session (unless free threshold is met)
    if (shippingRateId && !(freeThreshold && subtotal >= freeThreshold)) {
      params.shipping_options = [{ shipping_rate: shippingRateId }];
    }

    const session = await stripe.checkout.sessions.create(params);
    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error(err);
    return res.status(400).json({ error: err.message });
  }
}
