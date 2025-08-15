import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import csrf from 'csurf';
import rateLimit from 'express-rate-limit';

import servicesRoutes from '../routes/services.js';
import usersRoutes from '../routes/users.js';
import bookingsRoutes from '../routes/bookings.js';
import paymentsRoutes from '../routes/payments.js';
import webhooksRoutes from '../routes/webhooks.js';

const app = express();

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
app.get('/api/csrf-token', (req, res) => {
  // generar token imponiendo middleware solo para ese endpoint
  const token = csrf({ cookie: true }).create(req, res);
  res.cookie('csrfToken', token, { httpOnly: false, sameSite: 'lax', secure: process.env.NODE_ENV==='production' });
  res.json({ csrfToken: token });
});

// Aplicar CSRF a rutas mutables
app.use('/api', (req, res, next) => {
  if (['GET','HEAD','OPTIONS'].includes(req.method)) return next();
  return csrfProtection(req, res, next);
});

app.get('/api/health', (req, res) => res.json({ ok: true }));

// Rutas API
app.use('/api/services', servicesRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/bookings', bookingsRoutes);
app.use('/api/payments', paymentsRoutes);

// Webhooks (fuera de /api y sin CSRF)
app.use('/webhooks', webhooksRoutes);

// Manejo de errores
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  if (err.code === 'EBADCSRFTOKEN') return res.status(403).json({ error: 'CSRF token inválido' });
  res.status(400).json({ error: err.message || 'Error' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`API escuchando en http://localhost:${PORT}`));