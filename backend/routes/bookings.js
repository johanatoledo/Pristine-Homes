import express from 'express';
import pool from '../db.js';
import { bookingSchema } from '../validators.js';
import { estimatePrice } from '../price.js';

const router = express.Router();

router.post('/', async (req, res, next) => {
  try {
    const payload = bookingSchema.parse(req.body);

    const [svcRows] = await pool.query('SELECT id, base_price AS basePrice FROM services WHERE code=:code AND active=1', { code: payload.serviceCode });
    if (!svcRows.length) return res.status(400).json({ error: 'Servicio no disponible' });
    const service = svcRows[0];

    const price = estimatePrice({
      base: Number(service.basePrice),
      beds: payload.beds,
      baths: payload.baths,
      freq: payload.freq,
      extras: payload.extras
    });

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
        price
      }
    );

    const [row] = await pool.query(
      `SELECT b.id, b.date, b.time, b.price, b.status, s.code AS serviceCode, s.name AS serviceName
       FROM bookings b JOIN services s ON s.id=b.service_id WHERE b.id=:id`,
      { id: r.insertId }
    );

    res.status(201).json(row[0]);
  } catch (e) { next(e); }
});

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