// maneja la logica para crear y consultar las reservas
import express from 'express';
import pool from '../src/db.js';
import { bookingSchema } from '../src/validators.js';
import { estimatePrice } from '../src/price.js';
import { z } from 'zod';


import { verifyQuote } from './pricing.js';
// si lo moviste a un "service", cambia el import en consecuencia.

const router = express.Router();

// schema opcional SOLO para quoteId (no tocamos bookingSchema)
const quoteIdSchema = z.object({ quoteId: z.string().uuid().optional() });

router.post('/', async (req, res, next) => {
  try {

   // 0) Resolver userId
let userId = Number(req.user?.id); // si tienes middleware de auth
if (!Number.isFinite(userId) || userId <= 0) {
  const bodyUserId = Number(req.body.userId);
  if (Number.isFinite(bodyUserId) && bodyUserId > 0) {
    userId = bodyUserId;
  } else {
    // Último recurso: crear / buscar por email del cliente
    const email = req.body?.customer?.email;
    const name  = req.body?.customer?.name || 'Guest';
    const phone = req.body?.customer?.phone || 'N/A';
    if (!email) return res.status(400).json({ error: 'Falta userId o customer.email' });

    // upsert simple por email
    const [uRows] = await pool.query('SELECT id FROM users WHERE email=:email', { email });
    if (uRows.length) {
      userId = uRows[0].id;
    } else {
      const [ins] = await pool.query(
        'INSERT INTO users (name,email,phone) VALUES (:name,:email,:phone)',
        { name, email, phone }
      );
      userId = ins.insertId;
    }
  }
}
req.body.userId = userId; // inyectar para validación posterior    

    // 1) Valida body principal con tu bookingSchema
    const payload = bookingSchema.parse(req.body);

    // 1.1) Toma quoteId si lo enviaron (opcional, no interfiere con bookingSchema)
    let quoteId = null;
    try {
      const q = quoteIdSchema.parse(req.body);
      quoteId = q.quoteId ?? null;
    } catch {
      // si mandan un quoteId inválido, lo ignoramos en silencio (no hacemos cambios drásticos)
      quoteId = null;
    }

    // 2) Verificación del Servicio
    const [svcRows] = await pool.query(
      'SELECT id, base_price AS basePrice FROM services WHERE code=:code AND active=1',
      { code: payload.serviceCode }
    );
    if (!svcRows.length) return res.status(400).json({ error: 'Servicio no disponible' });
    const service = svcRows[0];

    // 3) Determinar precio
    //    Si vino quoteId válido y vigente, y coincide con los datos, usamos ese monto (fijado).
    //    Si no, calculamos con estimatePrice (flujo original).
    let priceMajor; // precio en unidad mayor (USD)
    if (quoteId) {
      const quote = verifyQuote(quoteId);
      if (quote) {
        // opcional: validar que el quote corresponde al mismo input relevante
        const sameInput =
          quote.input.serviceCode === payload.serviceCode &&
          Number(quote.input.beds)  === Number(payload.beds) &&
          Number(quote.input.baths) === Number(payload.baths) &&
          quote.input.freq          === payload.freq &&
          JSON.stringify((quote.input.extras ?? []).sort()) === JSON.stringify((payload.extras ?? []).sort());

        if (sameInput) {
          // quote.amount viene en unidad menor: pasamos a mayor para guardar como antes (consistencia con tu DB)
          priceMajor = quote.amount / 100;
        } else {
          // si no coincide, mantenemos comportamiento suave: recalculamos (sin 409 para evitar “cambios drásticos”)
          priceMajor = estimatePrice({
            base: Number(service.basePrice),
            beds: payload.beds,
            baths: payload.baths,
            freq: payload.freq,
            extras: payload.extras || []
          });
        }
      } else {
        // quote expirado/no existe -> calculamos
        priceMajor = estimatePrice({
          base: Number(service.basePrice),
          beds: payload.beds,
          baths: payload.baths,
          freq: payload.freq,
          extras: payload.extras || []
        });
      }
    } else {
      // sin quoteId -> flujo original
      priceMajor = estimatePrice({
        base: Number(service.basePrice),
        beds: payload.beds,
        baths: payload.baths,
        freq: payload.freq,
        extras: payload.extras || []
      });
    }

    // 4) Crear reserva (misma estructura que ya tenías)
    const [r] = await pool.query(
      `INSERT INTO bookings (user_id, service_id, beds, baths, freq, extras, date, time, address, zip, price, status)
       VALUES (:userId, :serviceId, :beds, :baths, :freq, CAST(:extras AS JSON), :date, :time, :address, :zip, :price, 'pending')`,
      {
        userId: payload.userId,
        serviceId: service.id,
        beds: payload.beds,
        baths: payload.baths,
        freq: payload.freq,
        extras: JSON.stringify(payload.extras || []),
        date: payload.date,
        time: payload.time,
        address: payload.address,
        zip: payload.zip,
        price: priceMajor // sigues guardando en unidad mayor como antes
      }
    );

    // 5) Devolver la reserva creada (igual que tenías)
    const [row] = await pool.query(
      `SELECT b.id, b.date, b.time, b.price, b.status, s.code AS serviceCode, s.name AS serviceName
       FROM bookings b JOIN services s ON s.id=b.service_id WHERE b.id=:id`,
      { id: r.insertId }
    );

    res.status(201).json(row[0]);
  } catch (e) { next(e); }
});

// listar reservas por userId (sin cambios)
router.get('/', async (req, res, next) => {
  try {
    const userId = Number(req.query.userId);
    if (!userId) return res.status(400).json({ error: 'userId requerido' });
    const [rows] = await pool.query(
      `SELECT b.id, b.date, b.time, b.price, b.status, b.beds, b.baths, b.freq, b.extras,
              s.code AS serviceCode, s.name AS serviceName
       FROM bookings b JOIN services s ON s.id=b.service_id
       WHERE b.user_id=:userId ORDER BY b.created_at DESC`,
      { userId }
    );
    res.json(rows);
  } catch (e) { next(e); }
});

export default router;
