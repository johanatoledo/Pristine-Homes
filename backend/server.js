import dotenv from 'dotenv';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import csrf from 'csurf';
import rateLimit from 'express-rate-limit';
import Stripe from 'stripe';
import path from 'node:path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';


import servicesRoutes from './routes/services.js';
import usersRoutes from './routes/users.js';
import bookingsRoutes from './routes/bookings.js';
import paymentsRoutes from './routes/payments.js';
import webhooksRoutes from './routes/webhooks.js';
import pricingRoutes from './routes/pricing.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
dotenv.config();
// Seguridad básica
app.use(helmet());
app.use(morgan('dev'));
app.use(cors({
  origin: process.env.FRONTEND_ORIGIN?.split(',') || '*',
  credentials: true,
  allowedHeaders: ['Content-Type','X-CSRF-Token']
}));

// Body parsers (ojo: webhooks usan raw en su router)
app.use(express.json());
app.use(cookieParser());

// Rate limit
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 200 });
app.use('/api/', limiter);

// CSRF con cookie (doble submit). Exponer token vía endpoint.
const csrfProtection = csrf({ cookie: true });

// APLICACIÓN DEL MIDDLEWARE CSRF
// Aplica el middleware directamente a los routers que necesitan protección
// Esto se hace en un solo lugar y de forma explícita
app.use('/api/bookings', csrfProtection, bookingsRoutes);
app.use('/api/payments', csrfProtection, paymentsRoutes);
app.use('/api/pricing', csrfProtection, pricingRoutes);
app.use('/api/users', csrfProtection, usersRoutes);
app.use('/api/services', csrfProtection, servicesRoutes);

// Endpoint para obtener el token CSRF.
// Este endpoint debe tener el middleware para poder usar req.csrfToken()
app.get('/api/csrf-token', csrfProtection, (req, res) => {
  res.json({ csrfToken: req.csrfToken() });
});

app.get('/api/health', (req, res) => res.json({ ok: true }));

// Webhooks (fuera de /api y sin CSRF)
app.use('/webhooks', webhooksRoutes);

const distDir = path.join(__dirname, '..', '..', 'frontend', 'dist');
app.use(express.static(distDir));

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
app.get('/stripe/return', async (req, res, next) => {
  try {
    const { payment_intent: piId, booking_id } = req.query;
    if (!piId) return res.redirect(`/payment-failed.html?reason=missing_payment_intent`);

    const pi = await stripe.paymentIntents.retrieve(String(piId));

    const amount   = pi.amount;
    const currency = (pi.currency || 'usd').toUpperCase();
    const bId      = booking_id || pi.metadata?.bookingId || '';

    if (pi.status === 'succeeded' || pi.status === 'processing') {
      const qs = new URLSearchParams({
        booking_id: `${bId}`,
        amount: `${amount}`,
        currency,
        payment_intent_client_secret: pi.client_secret
      });
      return res.redirect(`/success.html?${qs.toString()}`);
    } else {
      const qs = new URLSearchParams({
        booking_id: `${bId}`,
        amount: `${amount}`,
        currency,
        code: pi.last_payment_error?.code || '',
        reason: pi.last_payment_error?.decline_code || pi.status || ''
      });
      return res.redirect(`/payment-failed.html?${qs.toString()}`);
    }
  } catch (e) { next(e); }
});

// Manejo de errores
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  if (err.code === 'EBADCSRFTOKEN') return res.status(403).json({ error: 'CSRF token inválido' });
  res.status(400).json({ error: err.message || 'Error' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`API escuchando en http://localhost:${PORT}`));
