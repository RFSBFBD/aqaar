import { z } from 'zod';
import { bigIntStringSchema, positiveBigIntStringSchema } from './common';

export const createUnitSchema = z
  .object({
    projectName: z.string().trim().min(2, 'اسم المشروع مطلوب').max(150),
    unitNumber: z.string().trim().min(1, 'رقم الوحدة مطلوب').max(50),
    type: z.string().trim().min(2, 'نوع الوحدة مطلوب').max(80),
    area: z.coerce.number().positive('المساحة يجب أن تكون أكبر من صفر').max(1_000_000),
    rooms: z.coerce.number().int('عدد الغرف يجب أن يكون عدداً صحيحاً').min(1, 'عدد الغرف 1 على الأقل').max(100),
    price: positiveBigIntStringSchema,
  })
  .strict();

export const updateUnitSchema = z
  .object({
    projectName: z.string().trim().min(2).max(150).optional(),
    unitNumber: z.string().trim().min(1).max(50).optional(),
    type: z.string().trim().min(2).max(80).optional(),
    area: z.coerce.number().positive().max(1_000_000).optional(),
    rooms: z.coerce.number().int().min(1).max(100).optional(),
    price: positiveBigIntStringSchema.optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'يجب توفير حقل واحد على الأقل للتحديث',
  });

export const unitQuerySchema = z
  .object({
    status: z.enum(['AVAILABLE', 'RESERVED', 'SOLD']).optional(),
    minPrice: bigIntStringSchema.optional(),
    maxPrice: bigIntStringSchema.optional(),
    sortBy: z.enum(['price', 'area']).default('price'),
    sortDir: z.enum(['asc', 'desc']).default('asc'),
    page: z.coerce.number().int().min(1).max(10000).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict()
  .refine(
    (q) => q.minPrice === undefined || q.maxPrice === undefined || q.minPrice <= q.maxPrice,
    { message: 'الحد الأدنى للسعر يجب أن لا يتجاوز الحد الأقصى', path: ['minPrice'] }
  );

export type CreateUnitInput = z.infer<typeof createUnitSchema>;
export type UpdateUnitInput = z.infer<typeof updateUnitSchema>;
export type UnitQueryInput = z.infer<typeof unitQuerySchema>;
