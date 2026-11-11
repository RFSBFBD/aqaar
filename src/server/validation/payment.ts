import { z } from 'zod';
import { positiveBigIntStringSchema } from './common';

export const createPaymentSchema = z
  .object({
    contractId: z.string().trim().min(1, 'معرف العقد مطلوب').max(100),
    amount: positiveBigIntStringSchema,
    idempotencyKey: z
      .string()
      .trim()
      .min(8, 'مفتاح عدم التكرار قصير جداً')
      .max(128, 'مفتاح عدم التكرار طويل جداً'),
  })
  .strict();

export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;
