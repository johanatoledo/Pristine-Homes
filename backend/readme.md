# 1) Crear BD y tablas

mysql -u root -p < schema.sql

# 2) Configurar .env

cp .env.example .env && nano .env

# 3) Instalar deps y correr

npm install
npm run dev # o npm start

🧩 Ejemplos de llamadas (curl)

# Obtener servicios

curl http://localhost:4000/api/services

# Crear/actualizar usuario

curl -X POST http://localhost:4000/api/users \
 -H 'Content-Type: application/json' \
 -H 'X-CSRF-Token: <token>' \
 -d '{"name":"Juan Perez","email":"juan@test.com","phone":"+54 11 5555-5555"}'

# Crear booking

curl -X POST http://localhost:4000/api/bookings \
 -H 'Content-Type: application/json' -H 'X-CSRF-Token: <token>' \
 -d '{"userId":1,"serviceCode":"regular","beds":2,"baths":1,"freq":"una-vez","extras":["ventanas"],"date":"2025-08-31","time":"10:00","address":"Calle 123","zip":"1000"}'

# Stripe: crear intent

curl -X POST http://localhost:4000/api/payments/stripe/create-payment-intent \
 -H 'Content-Type: application/json' -H 'X-CSRF-Token: <token>' \
 -d '{"bookingId":1}'

📌 Siguientes pasos

Cablear el Paso 4 del SPA para llamar a /api/users → /api/bookings → /api/payments/\*.

Agregar autenticación (JWT/Magic Link) si quieres un panel persistente multi-dispositivo.

Completar webhook de MercadoPago consultando el estado del pago y enlazándolo al bookingId.
