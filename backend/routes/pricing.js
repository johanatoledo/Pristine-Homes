//se encarga de generar una cotización (quote) con una fecha de expiración para garantizar que el precio final no pueda ser manipulado por el usuario en el frontend antes de un pago.
import express from 'express';
import pool from '../src/db.js';
import { estimatePrice } from '../src/price.js';
import { bookingSchema } from '../src/validators.js';
import { z } from 'zod';
import crypto from 'crypto';

const router = express.Router();

// Schema de cotización derivado de bookingSchema (sin userId ni campos irrelevantes)
const quoteInputSchema = bookingSchema.pick({
  serviceCode: true,
  beds: true,
  baths: true,
  freq: true,
  extras: true
}).extend({
  zip: z.string().min(3).max(16).optional()
});

// Almacenamiento en memoria de cotizaciones
const QUOTES = new Map(); // quoteId -> { amount, currency, input, expiresAt }
const QUOTE_TTL_MS = 15 * 60 * 1000; // 15 minutos

export function verifyQuote(quoteId) {
  const q = QUOTES.get(quoteId);
  if (!q) return null;
  if (Date.now() > q.expiresAt) {
    QUOTES.delete(quoteId);
    return null;
  }
  return q;
}

router.post('/quote', async (req, res, next) => {
  try {
    // 1) Validar entrada usando tu bookingSchema reducido
    const input = quoteInputSchema.parse(req.body);

    // 2) Buscar base_price del servicio
    const [rows] = await pool.query(
      'SELECT id, code, base_price AS basePrice FROM services WHERE code = ? AND active = 1 LIMIT 1',
      [input.serviceCode]
    );
    if (!rows.length) {
      return res.status(404).json({ error: 'Service not found' });
    }

    const { basePrice } = rows[0];

    // 3) Calcular precio con price.js (en unidad mayor)
    const amountMajor = estimatePrice({
      base: Number(basePrice),
      beds: input.beds,
      baths: input.baths,
      freq: input.freq,
      extras: input.extras ?? []
    });

    // 4) Convertir a unidad menor
    const amount = Math.round(amountMajor * 100);
    const currency = 'USD'; // o la que definas en la DB

    // 5) Guardar quote en memoria
    const quoteId = crypto.randomUUID();
    QUOTES.set(quoteId, {
      amount,
      currency,
      input,
      expiresAt: Date.now() + QUOTE_TTL_MS
    });

    res.json({
      quoteId,
      amount,
      currency,
      ttlSeconds: QUOTE_TTL_MS / 1000
    });
  } catch (e) {
    next(e);
  }
});

export default router;
