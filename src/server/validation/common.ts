import { z } from 'zod';

/**
 * Zod schema for a non-negative integer minor-unit amount transmitted as a decimal string
 * (or whole-number string, rejecting decimals/floats).
 */
export const bigIntStringSchema = z
  .string()
  .trim()
  .regex(/^\d+$/, 'المبلغ يجب أن يكون عدداً صحيحاً موجباً بوحدة العملة الصغرى (بدون كسور عشرية)')
  .transform((val) => BigInt(val));

export const positiveBigIntStringSchema = bigIntStringSchema.refine(
  (val) => val > 0n,
  'القيمة يجب أن تكون أكبر من صفر'
);

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).max(10000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
