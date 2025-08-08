import express from 'express';
import pool from '../db.js';
import Stripe from 'stripe';
import mercadopago from 'mercadopago';
import { stripeIntentSchema, mpPreferenceSchema } from '../validators.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
mercadopago.configure({ access_token: process.env.MP_ACCESS_TOKEN });

const router = express.Router();

// Stripe: crear PaymentIntent (devuelve clientSecret)
router.post('/stripe/create-payment-intent', async (req, res, next) => {
  try {
    const { bookingId } = stripeIntentSchema.parse(req.body);

    const [rows] = await pool.query('SELECT id, price FROM bookings WHERE id=:id', { id: bookingId });
    if (!rows.length) return res.status(404).json({ error: 'Reserva no encontrada' });
    const booking = rows[0];

    const intent = await stripe.paymentIntents.create({
      amount: Math.round(Number(booking.price) * 100),
      currency: 'usd',
      metadata: { bookingId: String(booking.id) },
      automatic_payment_methods: { enabled: true }
    });

    res.json({ clientSecret: intent.client_secret });
  } catch (e) { next(e); }
});

// MercadoPago: crear Preference
router.post('/mercadopago/create-preference', async (req, res, next) => {
  try {
    const { bookingId } = mpPreferenceSchema.parse(req.body);

    const [rows] = await pool.query(
      `SELECT b.id, b.price, s.name AS serviceName FROM bookings b
       JOIN services s ON s.id=b.service_id WHERE b.id=:id`,
      { id: bookingId }
    );
    if (!rows.length) return res.status(404).json({ error: 'Reserva no encontrada' });
    const b = rows[0];

    const preference = await mercadopago.preferences.create({
      items: [{ title: `Reserva #${b.id} – ${b.serviceName}`, quantity: 1, unit_price: Number(b.price), currency_id: 'USD' }],
      back_urls: {
        success: `${process.env.FRONTEND_ORIGIN}/#panel`,
        failure: `${process.env.FRONTEND_ORIGIN}/#panel`,
        pending: `${process.env.FRONTEND_ORIGIN}/#panel`
      },
      auto_return: 'approved',
      metadata: { bookingId: String(b.id) }
    });

    res.json({ init_point: preference.body.init_point, id: preference.body.id });
  } catch (e) { next(e); }
});

export default router;