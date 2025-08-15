//archivo encargado de crear un Payment Intent con Stripe y devolver el client_secret necesario para el pago.
import express from 'express';
import pool from '../src/db.js';
import Stripe from 'stripe';

import { stripeIntentSchema } from '../src/validators.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);


const router = express.Router();

// Stripe: crear PaymentIntent (devuelve clientSecret)
router.post('/stripe/create-payment-intent', async (req, res, next) => {
  try {
    const { bookingId } = stripeIntentSchema.parse(req.body);

// Busca la reserva en tu base de datos utilizando el bookingId que recibiste.
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



export default router;