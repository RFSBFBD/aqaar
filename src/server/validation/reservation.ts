import { z } from 'zod';

export const createReservationSchema = z
  .object({
    unitId: z.string().trim().min(1, 'معرف الوحدة مطلوب').max(100),
    clientId: z.string().trim().min(1, 'معرف العميل مطلوب').max(100),
  })
  .strict();

export type CreateReservationInput = z.infer<typeof createReservationSchema>;
