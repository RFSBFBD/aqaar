import { describe, it, expect } from 'vitest';
import {
  canTransitionUnit,
  assertUnitTransition,
  canTransitionReservation,
  assertReservationTransition,
  canTransitionContract,
  assertContractTransition,
  deriveInstallmentStatus,
} from '@/domain/state-machines';

describe('Domain State Machines', () => {
  describe('Unit state machine', () => {
    it('allows valid transitions only', () => {
      expect(canTransitionUnit('AVAILABLE', 'RESERVED')).toBe(true);
      expect(canTransitionUnit('RESERVED', 'AVAILABLE')).toBe(true);
      expect(canTransitionUnit('RESERVED', 'SOLD')).toBe(true);
    });

    it('rejects invalid transitions (direct SOLD, transitions out of SOLD)', () => {
      expect(canTransitionUnit('AVAILABLE', 'SOLD')).toBe(false);
      expect(canTransitionUnit('SOLD', 'AVAILABLE')).toBe(false);
      expect(canTransitionUnit('SOLD', 'RESERVED')).toBe(false);
      expect(() => assertUnitTransition('SOLD', 'AVAILABLE')).toThrow();
    });
  });

  describe('Reservation state machine', () => {
    it('allows ACTIVE -> EXPIRED and ACTIVE -> CONVERTED only', () => {
      expect(canTransitionReservation('ACTIVE', 'EXPIRED')).toBe(true);
      expect(canTransitionReservation('ACTIVE', 'CONVERTED')).toBe(true);
      expect(canTransitionReservation('EXPIRED', 'ACTIVE')).toBe(false);
      expect(canTransitionReservation('CONVERTED', 'EXPIRED')).toBe(false);
      expect(() => assertReservationTransition('EXPIRED', 'CONVERTED')).toThrow();
    });
  });

  describe('Contract state machine (immutability after APPROVED)', () => {
    it('allows DRAFT -> APPROVED only', () => {
      expect(canTransitionContract('DRAFT', 'APPROVED')).toBe(true);
      expect(canTransitionContract('APPROVED', 'DRAFT')).toBe(false);
      expect(canTransitionContract('APPROVED', 'APPROVED')).toBe(false);
      expect(() => assertContractTransition('APPROVED', 'APPROVED')).toThrow();
    });
  });

  describe('Installment derived status', () => {
    const due = new Date(Date.UTC(2026, 4, 1)); // 2026-05-01

    it('returns PENDING before due date with 0 paid', () => {
      expect(deriveInstallmentStatus(10_000n, 0n, due, new Date(Date.UTC(2026, 4, 1, 18, 0)))).toBe('PENDING');
    });

    it('returns PARTIAL before/on due date with partial payment', () => {
      expect(deriveInstallmentStatus(10_000n, 3_000n, due, new Date(Date.UTC(2026, 4, 1, 18, 0)))).toBe('PARTIAL');
    });

    it('returns OVERDUE after due date when unpaid or partial', () => {
      expect(deriveInstallmentStatus(10_000n, 0n, due, new Date(Date.UTC(2026, 4, 2)))).toBe('OVERDUE');
      expect(deriveInstallmentStatus(10_000n, 3_000n, due, new Date(Date.UTC(2026, 4, 2)))).toBe('OVERDUE');
    });

    it('returns PAID even when past due date (PAID overrides OVERDUE)', () => {
      expect(deriveInstallmentStatus(10_000n, 10_000n, due, new Date(Date.UTC(2026, 5, 1)))).toBe('PAID');
    });
  });
});
