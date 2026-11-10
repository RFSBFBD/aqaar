import { z } from 'zod';

export const loginSchema = z
  .object({
    email: z
      .string()
      .trim()
      .toLowerCase()
      .email('البريد الإلكتروني غير صالح')
      .max(255),
    password: z
      .string()
      .min(1, 'كلمة المرور مطلوبة')
      .max(200),
  })
  .strict();

export type LoginInput = z.infer<typeof loginSchema>;
