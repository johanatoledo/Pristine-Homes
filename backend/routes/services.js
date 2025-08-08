import express from 'express';
import pool from '../db.js';

const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT id, code, name, description, base_price AS basePrice FROM services WHERE active=1 ORDER BY id');
    res.json(rows);
  } catch (e) { next(e); }
});

export default router;