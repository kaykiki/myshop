// /api/checkout.js — Vercel serverless function
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { items, currency = 'hkd' } = req.body || {};
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'No items provided' });
    }

    // Build Stripe line_items from your products.json items
    const line_items = items.map((item) => ({
      price: item.stripe_price_id, // already the correct price_... ID
      quantity: item.quantity || 1,
    }));

    const shippingRateId = process.env.SHIPPING_RATE_ID;
    const freeThreshold = Number(process.env.FREE_SHIPPING_THRESHOLD || 0);

    // Calculate subtotal in cents for free shipping check
    const subtotalCents = items.reduce(
      (sum, item) =>
        sum + Math.round(item.price_hkd * 100) * (item.quantity || 1),
      0
    );

    const params = {
      mode: 'payment',
      line_items,
      shipping_address_collection: { allowed_countries: ['HK'] },
      success_url: `${req.headers.origin}/success.html`,
      cancel_url: `${req.headers.origin}/`,
      metadata: {
        cart: JSON.stringify(
          items.map(({ name, quantity }) => ({ name, quantity }))
        ),
      },
    };

    // Add shipping only if under free shipping threshold
    if (
      shippingRateId &&
      !(freeThreshold > 0 && subtotalCents >= freeThreshold)
    ) {
      params.shipping_options = [{ shipping_rate: shippingRateId }];
    }

    const session = await stripe.checkout.sessions.create(params);

    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error(err);
    return res.status(400).json({ error: err.message });
  }
}
