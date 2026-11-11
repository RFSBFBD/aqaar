import { describe, it, expect } from 'vitest';
import { createContractDraftSchema, updateContractDraftSchema } from '@/server/validation/contract';
import { createPaymentSchema } from '@/server/validation/payment';

describe('Phase 3 Contract & Payment Validation', () => {
  it('validates contract draft input strictly and rejects forged fields', () => {
    const parsed = createContractDraftSchema.parse({
      reservationId: 'res_123',
      discount: '5000',
      downPayment: '10000',
      installmentCount: 12,
      startDate: '2026-01-31',
    });

    expect(parsed.discount).toBe(5000n);
    expect(parsed.downPayment).toBe(10000n);
    expect(parsed.startDate.toISOString().slice(0, 10)).toBe('2026-01-31');

    // Invalid calendar date (Feb 30)
    expect(
      createContractDraftSchema.safeParse({
        reservationId: 'res_123',
        downPayment: '0',
        installmentCount: 12,
        startDate: '2026-02-30',
      }).success
    ).toBe(false);

    // Forged companyId / approvedById / status / unitPrice
    expect(
      createContractDraftSchema.safeParse({
        reservationId: 'res_123',
        downPayment: '0',
        installmentCount: 12,
        startDate: '2026-01-31',
        companyId: 'cmp_other',
        approvedById: 'usr_me',
        status: 'APPROVED',
      }).success
    ).toBe(false);

    // Float downPayment rejected
    expect(
      createContractDraftSchema.safeParse({
        reservationId: 'res_123',
        downPayment: '100.50',
        installmentCount: 12,
        startDate: '2026-01-31',
      }).success
    ).toBe(false);

    expect(updateContractDraftSchema.safeParse({ status: 'APPROVED' }).success).toBe(false);
  });

  it('validates payment input strictly (positive BigInt, mandatory idempotencyKey)', () => {
    const ok = createPaymentSchema.parse({
      contractId: 'ctr_123',
      amount: '50000',
      idempotencyKey: 'pay-key-12345678',
    });
    expect(ok.amount).toBe(50_000n);

    expect(
      createPaymentSchema.safeParse({
        contractId: 'ctr_123',
        amount: '0',
        idempotencyKey: 'pay-key-12345678',
      }).success
    ).toBe(false);

    expect(
      createPaymentSchema.safeParse({
        contractId: 'ctr_123',
        amount: '-100',
        idempotencyKey: 'pay-key-12345678',
      }).success
    ).toBe(false);

    expect(
      createPaymentSchema.safeParse({
        contractId: 'ctr_123',
        amount: '1000',
        idempotencyKey: 'short',
      }).success
    ).toBe(false);
  });
});
