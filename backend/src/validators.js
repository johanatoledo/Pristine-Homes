//asegura que todos los datos que llegan a tu servidor, especialmente desde el frontend, tengan el formato y la estructura correctos.
import { z } from 'zod';

//creacion de esquema reutilizable
export const userSchema = z.object({
  name: z.string().min(2).max(120),
  email: z.string().email().max(160),
  phone: z.string().min(5).max(40)
});

//esquema para validar los datos de una reserva. 
export const bookingSchema = z.object({
  userId: z.coerce.number().int().positive(),
  serviceCode: z.enum(['Regular','Deep','Preparation','MovingOut','Apartament','Office']),
  beds: z.coerce.number().int().min(0).max(10),
  baths: z.coerce.number().int().min(1).max(10),
  freq: z.enum(['Once','Weekly','Biweekly','Monthly']),
  extras: z.array(z.enum(['windows','oven','refrigerator','iron'])).optional().default([]),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{2}:\d{2}/),
  address: z.string().min(5).max(255),
  zip: z.string().min(3).max(16)
});

//Valida que el body de la solicitud contenga una propiedad bookingId que pueda ser convertida a un número entero positivo.
export const stripeIntentSchema = z.object({ bookingId: z.coerce.number().int().positive() });
