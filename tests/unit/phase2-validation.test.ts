import { describe, it, expect } from 'vitest';
import { createUnitSchema, updateUnitSchema, unitQuerySchema } from '@/server/validation/unit';
import { createClientSchema, updateClientSchema } from '@/server/validation/client';
import { createReservationSchema } from '@/server/validation/reservation';

describe('Phase 2 Validation & Mass-Assignment Guards', () => {
  describe('Unit schemas', () => {
    it('accepts valid unit payload with integer minor-unit price string', () => {
      const parsed = createUnitSchema.parse({
        projectName: 'أبراج النخبة',
        unitNumber: 'A-101',
        type: 'شقة',
        area: 150.5,
        rooms: 3,
        price: '85000000',
      });
      expect(parsed.price).toBe(85_000_000n);
    });

    it('rejects float price strings, non-positive price, and mass assignment (status/companyId)', () => {
      expect(
        createUnitSchema.safeParse({
          projectName: 'أبراج',
          unitNumber: 'A-1',
          type: 'شقة',
          area: 120,
          rooms: 3,
          price: '1000.50',
        }).success
      ).toBe(false);

      expect(
        createUnitSchema.safeParse({
          projectName: 'أبراج',
          unitNumber: 'A-1',
          type: 'شقة',
          area: 120,
          rooms: 3,
          price: '0',
        }).success
      ).toBe(false);

      // Mass assignment attempt: status or companyId
      expect(
        createUnitSchema.safeParse({
          projectName: 'أبراج',
          unitNumber: 'A-1',
          type: 'شقة',
          area: 120,
          rooms: 3,
          price: '100000',
          status: 'SOLD',
          companyId: 'cmp_other',
        }).success
      ).toBe(false);

      expect(updateUnitSchema.safeParse({ status: 'SOLD' }).success).toBe(false);
    });

    it('enforces sorting allowlist (price/area only), pagination bounds, and minPrice <= maxPrice', () => {
      expect(unitQuerySchema.parse({}).sortBy).toBe('price');
      expect(unitQuerySchema.parse({ sortBy: 'area', sortDir: 'desc' })).toMatchObject({
        sortBy: 'area',
        sortDir: 'desc',
      });

      // Invalid sort field (SQL injection / arbitrary column attempt)
      expect(unitQuerySchema.safeParse({ sortBy: 'unitNumber' }).success).toBe(false);
      expect(unitQuerySchema.safeParse({ sortBy: 'price; DROP TABLE units' }).success).toBe(false);
      expect(unitQuerySchema.safeParse({ sortDir: 'random' }).success).toBe(false);

      // Pagination boundaries
      expect(unitQuerySchema.safeParse({ page: 0 }).success).toBe(false);
      expect(unitQuerySchema.safeParse({ pageSize: 101 }).success).toBe(false);

      // minPrice > maxPrice
      expect(
        unitQuerySchema.safeParse({ minPrice: '2000', maxPrice: '1000' }).success
      ).toBe(false);
    });
  });

  describe('Client & Reservation schemas', () => {
    it('rejects mass assignment of agentId or companyId on client creation/update', () => {
      expect(
        createClientSchema.safeParse({
          name: 'عميل جديد',
          phone: '0501234567',
          notes: 'ملاحظة',
          agentId: 'usr_other',
          companyId: 'cmp_other',
        }).success
      ).toBe(false);

      expect(updateClientSchema.safeParse({ agentId: 'usr_other' }).success).toBe(false);
    });

    it('validates reservation input strictly', () => {
      expect(
        createReservationSchema.safeParse({
          unitId: 'unit_a_101',
          clientId: 'cli_a_1',
          expiresAt: '2099-01-01',
        }).success
      ).toBe(false);
    });
  });
});
