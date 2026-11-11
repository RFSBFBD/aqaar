import { z } from 'zod';
import { bigIntStringSchema } from './common';

const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/;

export const createContractDraftSchema = z
  .object({
    reservationId: z.string().trim().min(1, 'معرف الحجز مطلوب').max(100),
    discount: bigIntStringSchema.default(0n),
    downPayment: bigIntStringSchema,
    installmentCount: z.coerce
      .number()
      .int('عدد الأقساط يجب أن يكون عدداً صحيحاً')
      .min(1, 'عدد الأقساط يجب أن يكون 1 على الأقل')
      .max(360, 'الحد الأقصى لعدد الأقساط هو 360'),
    startDate: z
      .string()
      .trim()
      .regex(isoDateRegex, 'تاريخ البداية يجب أن يكون بصيغة YYYY-MM-DD')
      .refine((val) => {
        const [y, m, d] = val.split('-').map(Number);
        const dt = new Date(Date.UTC(y!, m! - 1, d!));
        return (
          dt.getUTCFullYear() === y &&
          dt.getUTCMonth() === m! - 1 &&
          dt.getUTCDate() === d
        );
      }, 'تاريخ غير صالح')
      .transform((val) => {
        const [y, m, d] = val.split('-').map(Number);
        return new Date(Date.UTC(y!, m! - 1, d!));
      }),
  })
  .strict();

export const updateContractDraftSchema = z
  .object({
    discount: bigIntStringSchema.optional(),
    downPayment: bigIntStringSchema.optional(),
    installmentCount: z.coerce.number().int().min(1).max(360).optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'يجب توفير حقل واحد على الأقل للتعديل',
  });

export type CreateContractDraftInput = z.infer<typeof createContractDraftSchema>;
export type UpdateContractDraftInput = z.infer<typeof updateContractDraftSchema>;
