// /api/checkout.js - Vercel Serverless Function (Node 18+)
import Stripe from 'stripe';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end('Method Not Allowed');
  try {
    const { items, currency = 'hkd' } = req.body || {};
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'No items provided' });
    }

    const line_items = items.map(it => {
      if (it.price) { // Stripe Price ID preferred
        return { price: it.price, quantity: it.quantity || 1 };
      }
      // Fallback using raw amount (cents)
      return {
        quantity: it.quantity || 1,
        price_data: {
          currency,
          unit_amount: it.amount,
          product_data: { name: it.name }
        }
      };
    });

    const params = {
      mode: 'payment',
      line_items,
      shipping_address_collection: { allowed_countries: ['HK'] },
      success_url: `${req.headers.origin}/success.html`,
      cancel_url: `${req.headers.origin}/`,
    };
    if (process.env.SHIPPING_RATE_ID) {
      params.shipping_options = [{ shipping_rate: process.env.SHIPPING_RATE_ID }];
    }
    // Optional: carry cart metadata (name/qty/size) for reference
    params.metadata = { cart: JSON.stringify(items.map(({name, quantity, metadata}) => ({name, quantity, ...(metadata||{})}))) };

    const session = await stripe.checkout.sessions.create(params);
    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error(err);
    return res.status(400).json({ error: err.message });
  }
}
