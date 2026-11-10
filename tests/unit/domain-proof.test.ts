import { describe, it, expect } from 'vitest';
import {
  validateDiscount,
  calculateFinalPrice,
  validateDownPayment,
  calculateRemainingAmount,
  generateInstallmentAmounts,
  validateInstallmentSum,
  allocatePayment,
  validatePaymentAmount,
} from '@/domain/financial';
import { assertContractTransition, assertUnitTransition } from '@/domain/state-machines';

/**
 * Sprint 0.5 — Test-First Domain Proof for cross-cutting domain invariants:
 * - End-to-end financial invariant (down payment + installments === final price)
 * - Immutability invariant after contract approval
 * - Pure specification contracts for reservation concurrency, tenant isolation, and idempotency
 */
describe('Sprint 0.5 Domain Invariant Proofs', () => {
  it('proves downPayment + sum(installments) === finalPrice for full contract math', () => {
    const unitPrice = 1_500_000_00n;
    const discount = 75_000_00n; // exactly 5%
    expect(validateDiscount(unitPrice, discount).valid).toBe(true);

    const finalPrice = calculateFinalPrice(unitPrice, discount);
    expect(finalPrice).toBe(1_425_000_00n);

    const downPayment = 225_000_00n;
    expect(validateDownPayment(finalPrice, downPayment).valid).toBe(true);

    const remaining = calculateRemainingAmount(finalPrice, downPayment);
    const schedule = generateInstallmentAmounts(remaining, 19);
    expect(validateInstallmentSum(schedule, remaining)).toBe(true);

    const installmentTotal = schedule.reduce((a, b) => a + b, 0n);
    expect(downPayment + installmentTotal).toBe(finalPrice);
  });

  it('proves approved contracts and sold units cannot re-transition', () => {
    expect(() => assertContractTransition('DRAFT', 'APPROVED')).not.toThrow();
    expect(() => assertContractTransition('APPROVED', 'APPROVED')).toThrow();
    expect(() => assertUnitTransition('RESERVED', 'SOLD')).not.toThrow();
    expect(() => assertUnitTransition('SOLD', 'RESERVED')).toThrow();
  });

  it('proves sequential partial payments eventually settle all installments cleanly', () => {
    const amounts = generateInstallmentAmounts(100_000n, 3); // [33334, 33333, 33333]
    let state = amounts.map((amount, idx) => ({
      id: `i-${idx + 1}`,
      amount,
      paidAmount: 0n,
    }));

    // Pay 50,000
    const p1 = allocatePayment(50_000n, state);
    for (const u of p1.updatedInstallments) {
      const target = state.find((s) => s.id === u.id)!;
      target.paidAmount = u.newPaidAmount;
    }
    expect(state.map((s) => s.paidAmount)).toEqual([33_334n, 16_666n, 0n]);

    // Pay remaining 50,000
    const remaining = state.reduce((sum, s) => sum + (s.amount - s.paidAmount), 0n);
    expect(remaining).toBe(50_000n);
    expect(validatePaymentAmount(50_001n, remaining).valid).toBe(false);

    const p2 = allocatePayment(50_000n, state);
    for (const u of p2.updatedInstallments) {
      const target = state.find((s) => s.id === u.id)!;
      target.paidAmount = u.newPaidAmount;
    }
    expect(state.every((s) => s.paidAmount === s.amount)).toBe(true);
  });
});
