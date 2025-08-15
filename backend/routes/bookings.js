//maneja la logica para crear y consultar las reservas
import express from 'express';
import pool from '../src/db.js';
import { bookingSchema } from '../src/validators.js';
import { estimatePrice } from '../src/price.js';

const router = express.Router();

router.post('/', async (req, res, next) => {
  try {
    const payload = bookingSchema.parse(req.body);

    //Verificación del Servicio
    const [svcRows] = await pool.query('SELECT id, base_price AS basePrice FROM services WHERE code=:code AND active=1', { code: payload.serviceCode });
    if (!svcRows.length) return res.status(400).json({ error: 'Servicio no disponible' });
    const service = svcRows[0];

    // calcula el precio de la reserva basándose en los datos validados y
    //  en el precio base del servicio obtenido de la base de datos.
    const price = estimatePrice({
      base: Number(service.basePrice),
      beds: payload.beds,
      baths: payload.baths,
      freq: payload.freq,
      extras: payload.extras
    });

    //Esta es la parte donde se crea la reserva. 
    //guarda todos los detalles de la reserva en la tabla bookings de tu base de datos
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


 //Después de insertar la reserva, el código hace una segunda consulta para obtener la reserva recién creada y la devuelve al frontend. 
    const [row] = await pool.query(
      `SELECT b.id, b.date, b.time, b.price, b.status, s.code AS serviceCode, s.name AS serviceName
       FROM bookings b JOIN services s ON s.id=b.service_id WHERE b.id=:id`,
      { id: r.insertId }
    );

    res.status(201).json(row[0]);
  } catch (e) { next(e); }
});

//Esta ruta permite al frontend solicitar todas las reservas para un userId específico.
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