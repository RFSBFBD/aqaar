import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import 'dotenv/config';
import { prisma } from '@/lib/prisma';
import type { TenantContext } from '@/server/auth/guards';
import { createUnit } from '@/server/services/unit.service';
import { createReservation } from '@/server/services/reservation.service';
import {
  createContractDraft,
  approveContract,
  updateContractDraft,
  getContractDetail,
} from '@/server/services/contract.service';
import { recordPayment } from '@/server/services/payment.service';

const adminA: TenantContext = {
  companyId: 'cmp_nukhba_a',
  userId: 'usr_a_admin',
  userRole: 'ADMIN',
  userName: 'Admin A',
};

const salesA1: TenantContext = {
  companyId: 'cmp_nukhba_a',
  userId: 'usr_a_sales1',
  userRole: 'SALES',
  userName: 'Sales A1',
};

const accountantA: TenantContext = {
  companyId: 'cmp_nukhba_a',
  userId: 'usr_a_accountant',
  userRole: 'ACCOUNTANT',
  userName: 'Accountant A',
};

const accountantB: TenantContext = {
  companyId: 'cmp_mustaqbal_b',
  userId: 'usr_b_accountant',
  userRole: 'ACCOUNTANT',
  userName: 'Accountant B',
};

describe('Phase 3 Integration Tests — Contracts, Installments, Payments & Concurrency', () => {
  const unitIds: string[] = [];

  beforeAll(async () => {
    await prisma.$queryRaw`SELECT 1`;
  });

  afterAll(async () => {
    if (unitIds.length > 0) {
      const contracts = await prisma.contract.findMany({
        where: { unitId: { in: unitIds } },
        select: { id: true },
      });
      const contractIds = contracts.map((c) => c.id);
      if (contractIds.length > 0) {
        await prisma.$executeRawUnsafe(
          `ALTER TABLE "payment_allocations" DISABLE TRIGGER payment_allocations_append_only`
        );
        await prisma.$executeRawUnsafe(
          `ALTER TABLE "payments" DISABLE TRIGGER payments_append_only`
        );
        await prisma.$executeRawUnsafe(
          `ALTER TABLE "contracts" DISABLE TRIGGER contracts_immutable_after_approval`
        );
        await prisma.paymentAllocation.deleteMany({
          where: { payment: { contractId: { in: contractIds } } },
        });
        await prisma.payment.deleteMany({ where: { contractId: { in: contractIds } } });
        await prisma.installment.deleteMany({ where: { contractId: { in: contractIds } } });
        await prisma.contract.deleteMany({ where: { id: { in: contractIds } } });
        await prisma.$executeRawUnsafe(
          `ALTER TABLE "contracts" ENABLE TRIGGER contracts_immutable_after_approval`
        );
        await prisma.$executeRawUnsafe(
          `ALTER TABLE "payments" ENABLE TRIGGER payments_append_only`
        );
        await prisma.$executeRawUnsafe(
          `ALTER TABLE "payment_allocations" ENABLE TRIGGER payment_allocations_append_only`
        );
      }
      await prisma.reservation.deleteMany({ where: { unitId: { in: unitIds } } });
      await prisma.unit.deleteMany({ where: { id: { in: unitIds } } });
    }
    await prisma.$disconnect();
  });

  it('executes full contract lifecycle: 5% discount, Jan 31 dates, exact 100000/3 split, FIFO payments, idempotency, immutability', async () => {
    const unit = await createUnit(adminA, {
      projectName: 'مشروع العقود',
      unitNumber: `CTR-${Date.now()}`,
      type: 'شقة',
      area: 140,
      rooms: 3,
      price: 110_000n,
    });
    unitIds.push(unit.id);

    const res = await createReservation(salesA1, { unitId: unit.id, clientId: 'cli_a_1' });

    // 5.01% discount rejected (max on 110,000 = 5,500)
    await expect(
      createContractDraft(salesA1, {
        reservationId: res.id,
        discount: 5_501n,
        downPayment: 0n,
        installmentCount: 3,
        startDate: new Date(Date.UTC(2025, 0, 31)),
      })
    ).rejects.toMatchObject({ statusCode: 400 });

    // Valid draft: discount 5,000 => finalPrice 105,000, downPayment 5,000 => remaining 100,000 across 3 months from Jan 31
    const draft = await createContractDraft(salesA1, {
      reservationId: res.id,
      discount: 5_000n,
      downPayment: 5_000n,
      installmentCount: 3,
      startDate: new Date(Date.UTC(2025, 0, 31)),
    });
    expect(draft.remainingAmount).toBe('100000');

    // SALES cannot approve; Company B accountant cannot approve
    await expect(approveContract(salesA1, draft.id)).rejects.toMatchObject({ statusCode: 403 });
    await expect(approveContract(accountantB, draft.id)).rejects.toMatchObject({ statusCode: 404 });

    // Accountant A approves
    const approved = await approveContract(accountantA, draft.id);
    expect(approved.status).toBe('APPROVED');
    expect(approved.unitStatus).toBe('SOLD');
    expect(approved.installments.map((i) => i.amount)).toEqual(['33334', '33333', '33333']);
    expect(approved.installments.map((i) => i.dueDate)).toEqual([
      '2025-02-28',
      '2025-03-31',
      '2025-04-30',
    ]);

    // Double approval rejected
    await expect(approveContract(accountantA, draft.id)).rejects.toMatchObject({ statusCode: 409 });

    // Modification after approval rejected at service AND DB trigger
    await expect(
      updateContractDraft(salesA1, draft.id, { downPayment: 0n })
    ).rejects.toMatchObject({ statusCode: 409 });
    await expect(
      prisma.contract.update({ where: { id: draft.id }, data: { discount: 0n } })
    ).rejects.toThrow();

    // Payment: SALES rejected, Accountant B rejected
    await expect(
      recordPayment(salesA1, { contractId: draft.id, amount: 10_000n, idempotencyKey: 'k-sales-0001' })
    ).rejects.toMatchObject({ statusCode: 403 });
    await expect(
      recordPayment(accountantB, { contractId: draft.id, amount: 10_000n, idempotencyKey: 'k-compb-0001' })
    ).rejects.toMatchObject({ statusCode: 404 });

    // Overpayment rejected
    await expect(
      recordPayment(accountantA, { contractId: draft.id, amount: 100_001n, idempotencyKey: 'k-over-0001' })
    ).rejects.toMatchObject({ statusCode: 400 });

    // Record 50,000 with idempotency key -> allocates 33334 to #1 (PAID) and 16666 to #2 (PARTIAL)
    const p1 = await recordPayment(accountantA, {
      contractId: draft.id,
      amount: 50_000n,
      idempotencyKey: 'k-pay-first-0001',
    });
    expect(p1.replayed).toBe(false);
    expect(p1.allocations.map((a) => [a.sequenceNumber, a.amount])).toEqual([
      [1, '33334'],
      [2, '16666'],
    ]);
    expect(p1.remainingContractBalance).toBe('50000');

    // Replay with same idempotencyKey -> returns existing payment, no duplicate
    const p1Replay = await recordPayment(accountantA, {
      contractId: draft.id,
      amount: 50_000n,
      idempotencyKey: 'k-pay-first-0001',
    });
    expect(p1Replay.replayed).toBe(true);
    expect(p1Replay.id).toBe(p1.id);

    // Payment is append-only in DB
    await expect(prisma.payment.delete({ where: { id: p1.id } })).rejects.toThrow();
    await expect(
      prisma.payment.update({ where: { id: p1.id }, data: { amount: 1n } })
    ).rejects.toThrow();

    // Concurrent payments racing for remaining 50,000: two 30,000 requests -> only 1 succeeds!
    const concurrentPayments = await Promise.allSettled([
      recordPayment(accountantA, { contractId: draft.id, amount: 30_000n, idempotencyKey: 'k-race-a-001' }),
      recordPayment(accountantA, { contractId: draft.id, amount: 30_000n, idempotencyKey: 'k-race-b-002' }),
    ]);
    expect(concurrentPayments.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(concurrentPayments.filter((r) => r.status === 'rejected')).toHaveLength(1);

    const finalDetail = await getContractDetail(accountantA, draft.id);
    expect(finalDetail.outstandingBalance).toBe('20000');
  });

  it('serializes concurrent updateContractDraft vs approveContract with controlled 409 (no raw DB trigger 500)', async () => {
    const unit = await createUnit(adminA, {
      projectName: 'مشروع سباق الاعتماد',
      unitNumber: `RACE-${Date.now()}`,
      type: 'شقة',
      area: 125,
      rooms: 3,
      price: 200_000n,
    });
    unitIds.push(unit.id);

    const res = await createReservation(salesA1, { unitId: unit.id, clientId: 'cli_a_1' });
    const draft = await createContractDraft(salesA1, {
      reservationId: res.id,
      discount: 0n,
      downPayment: 20_000n,
      installmentCount: 3,
      startDate: new Date(Date.UTC(2026, 0, 31)),
    });

    const [approveResult, updateResult] = await Promise.allSettled([
      approveContract(accountantA, draft.id),
      updateContractDraft(salesA1, draft.id, { downPayment: 50_000n }),
    ]);

    expect(approveResult.status).toBe('fulfilled');

    if (updateResult.status === 'rejected') {
      expect(updateResult.reason).toMatchObject({ statusCode: 409 });
    }

    // Regardless of race winner, contract is now APPROVED and any subsequent update returns controlled 409
    await expect(
      updateContractDraft(salesA1, draft.id, { downPayment: 10_000n })
    ).rejects.toMatchObject({ statusCode: 409 });

    const finalState = await getContractDetail(accountantA, draft.id);
    expect(finalState.status).toBe('APPROVED');
    const instSum = finalState.installments.reduce((acc, i) => acc + BigInt(i.amount), 0n);
    expect(instSum + BigInt(finalState.downPayment)).toBe(BigInt(finalState.finalPrice));
  });
});
