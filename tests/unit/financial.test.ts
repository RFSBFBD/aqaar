import { describe, it, expect } from 'vitest';
import {
  validateDiscount,
  calculateFinalPrice,
  validateDownPayment,
  calculateRemainingAmount,
  generateInstallmentAmounts,
  validateInstallmentSum,
  allocatePayment,
  calculateContractBalance,
  validatePaymentAmount,
  bigIntToString,
  stringToBigInt,
} from '@/domain/financial';

describe('Financial Domain Rules (BigInt Minor Units)', () => {
  describe('Discount cap (5%)', () => {
    it('accepts 0 discount', () => {
      expect(validateDiscount(100_000n, 0n)).toEqual({ valid: true });
    });

    it('accepts exact 5% discount', () => {
      expect(validateDiscount(100_000n, 5_000n)).toEqual({ valid: true });
    });

    it('rejects 5.01% / 1 minor unit above 5% discount', () => {
      const res = validateDiscount(100_000n, 5_001n);
      expect(res.valid).toBe(false);
    });

    it('rejects negative discount', () => {
      const res = validateDiscount(100_000n, -1n);
      expect(res.valid).toBe(false);
    });

    it('rejects non-positive unit price', () => {
      expect(validateDiscount(0n, 0n).valid).toBe(false);
      expect(validateDiscount(-100n, 0n).valid).toBe(false);
    });
  });

  describe('Final price & Down payment bounds', () => {
    it('calculates finalPrice = unitPrice - discount', () => {
      expect(calculateFinalPrice(500_000_00n, 25_000_00n)).toBe(475_000_00n);
    });

    it('accepts down payment of 0 and up to finalPrice', () => {
      expect(validateDownPayment(100_000n, 0n)).toEqual({ valid: true });
      expect(validateDownPayment(100_000n, 25_000n)).toEqual({ valid: true });
      expect(validateDownPayment(100_000n, 100_000n)).toEqual({ valid: true });
    });

    it('rejects negative down payment or down payment exceeding finalPrice', () => {
      expect(validateDownPayment(100_000n, -1n).valid).toBe(false);
      expect(validateDownPayment(100_000n, 100_001n).valid).toBe(false);
    });

    it('calculates remainingAmount = finalPrice - downPayment', () => {
      expect(calculateRemainingAmount(475_000_00n, 75_000_00n)).toBe(400_000_00n);
    });
  });

  describe('Installment generation & exact sum invariant', () => {
    it('splits 100000 minor units into 3 installments with deterministic remainder on first items', () => {
      const amounts = generateInstallmentAmounts(100_000n, 3);
      expect(amounts).toEqual([33_334n, 33_333n, 33_333n]);
      expect(validateInstallmentSum(amounts, 100_000n)).toBe(true);
    });

    it('splits 10007 across 3 installments -> [3336, 3336, 3335]', () => {
      const amounts = generateInstallmentAmounts(10_007n, 3);
      expect(amounts).toEqual([3_336n, 3_336n, 3_335n]);
      expect(validateInstallmentSum(amounts, 10_007n)).toBe(true);
    });

    it('handles zero remaining amount across N installments', () => {
      const amounts = generateInstallmentAmounts(0n, 4);
      expect(amounts).toEqual([0n, 0n, 0n, 0n]);
      expect(validateInstallmentSum(amounts, 0n)).toBe(true);
    });

    it('preserves exact sum across arbitrary large BigInt values (> MAX_SAFE_INTEGER)', () => {
      const remaining = 90_071_992_547_409_937n;
      const amounts = generateInstallmentAmounts(remaining, 17);
      expect(amounts).toHaveLength(17);
      expect(validateInstallmentSum(amounts, remaining)).toBe(true);
    });

    it('rejects count <= 0 or negative remaining', () => {
      expect(() => generateInstallmentAmounts(10_000n, 0)).toThrow();
      expect(() => generateInstallmentAmounts(10_000n, -2)).toThrow();
      expect(() => generateInstallmentAmounts(-1n, 2)).toThrow();
    });
  });

  describe('Payment allocation (FIFO) & overpayment rejection', () => {
    const baseInstallments = [
      { id: 'inst-1', amount: 10_000n, paidAmount: 0n },
      { id: 'inst-2', amount: 10_000n, paidAmount: 0n },
      { id: 'inst-3', amount: 10_000n, paidAmount: 0n },
    ];

    it('allocates partial payment to oldest installment first', () => {
      const res = allocatePayment(4_000n, baseInstallments);
      expect(res.allocations).toEqual([{ installmentId: 'inst-1', amount: 4_000n }]);
      expect(res.updatedInstallments).toEqual([
        { id: 'inst-1', newPaidAmount: 4_000n, newStatus: 'PARTIAL' },
      ]);
    });

    it('allocates across multiple installments in sequence order', () => {
      const partialStart = [
        { id: 'inst-1', amount: 10_000n, paidAmount: 4_000n },
        { id: 'inst-2', amount: 10_000n, paidAmount: 0n },
        { id: 'inst-3', amount: 10_000n, paidAmount: 0n },
      ];
      const res = allocatePayment(11_000n, partialStart);
      expect(res.allocations).toEqual([
        { installmentId: 'inst-1', amount: 6_000n },
        { installmentId: 'inst-2', amount: 5_000n },
      ]);
      expect(res.updatedInstallments).toEqual([
        { id: 'inst-1', newPaidAmount: 10_000n, newStatus: 'PAID' },
        { id: 'inst-2', newPaidAmount: 5_000n, newStatus: 'PARTIAL' },
      ]);
    });

    it('skips already paid installments', () => {
      const installments = [
        { id: 'inst-1', amount: 10_000n, paidAmount: 10_000n },
        { id: 'inst-2', amount: 10_000n, paidAmount: 0n },
      ];
      const res = allocatePayment(10_000n, installments);
      expect(res.allocations).toEqual([{ installmentId: 'inst-2', amount: 10_000n }]);
      expect(res.updatedInstallments).toEqual([
        { id: 'inst-2', newPaidAmount: 10_000n, newStatus: 'PAID' },
      ]);
    });

    it('rejects zero, negative, and overpayment amounts', () => {
      const remaining = calculateContractBalance(baseInstallments);
      expect(remaining).toBe(30_000n);
      expect(validatePaymentAmount(0n, remaining).valid).toBe(false);
      expect(validatePaymentAmount(-500n, remaining).valid).toBe(false);
      expect(validatePaymentAmount(30_001n, remaining).valid).toBe(false);
      expect(() => allocatePayment(30_001n, baseInstallments)).toThrow();
    });
  });

  describe('BigInt serialization', () => {
    it('round-trips large integer minor units without precision loss', () => {
      const large = 9007199254740993123n;
      const serialized = bigIntToString(large);
      expect(serialized).toBe('9007199254740993123');
      expect(stringToBigInt(serialized)).toBe(large);
    });

    it('rejects non-integer strings (floats or text)', () => {
      expect(() => stringToBigInt('100.50')).toThrow();
      expect(() => stringToBigInt('abc')).toThrow();
      expect(() => stringToBigInt('')).toThrow();
    });
  });
});
