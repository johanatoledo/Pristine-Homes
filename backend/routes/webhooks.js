import express from 'express';
import pool from '../db.js';
import Stripe from 'stripe';

const router = express.Router();

// Stripe Webhook: usar express.raw
router.post('/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'payment_intent.succeeded') {
    const pi = event.data.object; // contains amount, metadata.bookingId
    const bookingId = Number(pi.metadata?.bookingId);
    if (bookingId) {
      await pool.query('UPDATE bookings SET status=\'confirmed\' WHERE id=:id', { id: bookingId });
      await pool.query(
        `INSERT INTO payments (booking_id, provider, external_id, amount, currency, status, raw)
         VALUES (:bookingId, 'stripe', :ext, :amount, :curr, :status, CAST(:raw AS JSON))
         ON DUPLICATE KEY UPDATE status=VALUES(status), raw=VALUES(raw)`,
        {
          bookingId,
          ext: pi.id,
          amount: (pi.amount_received ?? pi.amount) / 100,
          curr: pi.currency?.toUpperCase() || 'USD',
          status: pi.status,
          raw: JSON.stringify(pi)
        }
      );
    }
  }

  res.json({ received: true });
});

// MercadoPago Webhook (simplificado)
router.post('/mercadopago', express.json(), async (req, res) => {
  // Según configuración, MP enviará notificaciones sobre pagos
  // Aquí deberías validar/consultar el pago vía SDK/REST y actualizar la reserva.
  // Ejemplo simplificado:
  try {
    const topic = req.query.topic || req.body.topic;
    if (topic === 'payment') {
      const dataId = req.query.id || req.body.data?.id;
      // TODO: consultar estado del pago y actualizar booking/payments
    }
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'webhook error' });
  }
});

export default router;