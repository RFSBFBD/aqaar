import { z } from 'zod';

export const createClientSchema = z
  .object({
    name: z.string().trim().min(2, 'اسم العميل مطلوب').max(150),
    phone: z
      .string()
      .trim()
      .min(5, 'رقم الهاتف غير صالح')
      .max(30, 'رقم الهاتف طويل جداً'),
    notes: z.string().trim().max(2000).default(''),
  })
  .strict();

export const updateClientSchema = z
  .object({
    name: z.string().trim().min(2).max(150).optional(),
    phone: z.string().trim().min(5).max(30).optional(),
    notes: z.string().trim().max(2000).optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'يجب توفير حقل واحد على الأقل للتحديث',
  });

export type CreateClientInput = z.infer<typeof createClientSchema>;
export type UpdateClientInput = z.infer<typeof updateClientSchema>;
