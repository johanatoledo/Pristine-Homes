import express from 'express';
import pool from '../db.js';
import { userSchema } from '../validators.js';
import { sanitizeString } from '../utils/sanitize.js';

const router = express.Router();

router.post('/', async (req, res, next) => {
  try {
    const data = userSchema.parse(req.body);
    data.name = sanitizeString(data.name);
    const [r] = await pool.query(
      `INSERT INTO users (name,email,phone) VALUES (:name,:email,:phone)
       ON DUPLICATE KEY UPDATE name=VALUES(name), phone=VALUES(phone)`,
      data
    );
    // si fue update, obtener id por email
    const [user] = await pool.query('SELECT id,name,email,phone FROM users WHERE email=:email', { email: data.email });
    res.status(201).json(user[0]);
  } catch (e) { next(e); }
});

export default router;