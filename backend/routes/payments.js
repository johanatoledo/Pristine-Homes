// Este archivo es el encargado de crear un Payment Intent con Stripe
// usando una cotización generada previamente.

import express from 'express';
import Stripe from 'stripe';
import { z } from 'zod';
import { verifyQuote } from './pricing.js'; // Importamos la función de validación de cotizaciones

const router = express.Router();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Definimos el esquema de validación para el ID de la cotización
const paymentIntentInputSchema = z.object({
  quoteId: z.string().uuid()
});

// Stripe: crear PaymentIntent (devuelve clientSecret)
router.post('/stripe/create-payment-intent', async (req, res, next) => {
  try {
    // 1. Validar que la solicitud contenga un quoteId válido
    const { quoteId } = paymentIntentInputSchema.parse(req.body);

    // 2. Usar la función de pricing.js para verificar la cotización
    // Esto asegura que la cotización existe y no ha expirado.
    const quote = verifyQuote(quoteId);

    // 3. Manejar el caso de una cotización no encontrada o expirada
    if (!quote) {
      return res.status(404).json({ error: 'Quote not found or has expired' });
    }

    // 4. Crear el Payment Intent con los datos de la cotización
    // El monto y la moneda se toman directamente del objeto de la cotización,
    // garantizando que no se puedan manipular.
    const intent = await stripe.paymentIntents.create({
      amount: quote.amount,
      currency: quote.currency,
      metadata: { quoteId: String(quoteId) },
      automatic_payment_methods: { enabled: true }
    });

    // 5. Enviar el client_secret de vuelta al cliente para el pago
    res.json({ clientSecret: intent.client_secret });
  } catch (e) {
    next(e);
  }
});

export default router;
