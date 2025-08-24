
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

// Determina el entorno y carga el archivo .env correspondiente
const envFile = process.env.NODE_ENV === 'production'
  ? '.env.production'
  : '.env.development';

dotenv.config({ path: envFile });

// Pool de conexiones MySQL, configurable vía variables de entorno
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});



export default pool;