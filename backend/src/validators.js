import { z } from 'zod';

export const userSchema = z.object({
  name: z.string().min(2).max(120),
  email: z.string().email().max(160),
  phone: z.string().min(5).max(40)
});

export const bookingSchema = z.object({
  userId: z.coerce.number().int().positive(),
  serviceCode: z.enum(['regular','profunda','preparacion','mudanza','apartamento','oficina']),
  beds: z.coerce.number().int().min(0).max(10),
  baths: z.coerce.number().int().min(1).max(10),
  freq: z.enum(['una-vez','semanal','quincenal','mensual']),
  extras: z.array(z.enum(['ventanas','horno','refrigerador','plancha'])).optional().default([]),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{2}:\d{2}/),
  address: z.string().min(5).max(255),
  zip: z.string().min(3).max(16)
});

export const stripeIntentSchema = z.object({ bookingId: z.coerce.number().int().positive() });
export const mpPreferenceSchema = z.object({ bookingId: z.coerce.number().int().positive() });