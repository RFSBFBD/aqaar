import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import {
  allocatePayment,
  bigIntToString,
  calculateContractBalance,
  validatePaymentAmount,
} from '@/domain';
import { AuthError, DomainError, type TenantContext } from '@/server/auth/guards';
import type { CreatePaymentInput } from '@/server/validation/payment';
import { recordAuditLog } from '@/server/services/audit.service';

export interface RecordedPaymentDto {
  id: string;
  contractId: string;
  amount: string;
  idempotencyKey: string;
  createdAt: string;
  replayed: boolean;
  allocations: Array<{
    installmentId: string;
    sequenceNumber: number;
    amount: string;
  }>;
  remainingContractBalance: string;
}

async function fetchPaymentResult(
  companyId: string,
  paymentId: string,
  replayed: boolean
): Promise<RecordedPaymentDto> {
  const payment = await prisma.payment.findFirstOrThrow({
    where: { id: paymentId, companyId },
    include: {
      allocations: {
        include: { installment: { select: { sequenceNumber: true } } },
        orderBy: { installment: { sequenceNumber: 'asc' } },
      },
      contract: {
        include: {
          installments: { select: { amount: true, paidAmount: true } },
        },
      },
    },
  });

  const remaining = calculateContractBalance(payment.contract.installments);

  return {
    id: payment.id,
    contractId: payment.contractId,
    amount: bigIntToString(payment.amount),
    idempotencyKey: payment.idempotencyKey,
    createdAt: payment.createdAt.toISOString(),
    replayed,
    allocations: payment.allocations.map((a) => ({
      installmentId: a.installmentId,
      sequenceNumber: a.installment.sequenceNumber,
      amount: bigIntToString(a.amount),
    })),
    remainingContractBalance: bigIntToString(remaining),
  };
}

/**
 * Records an append-only payment for an APPROVED contract, allocating FIFO
 * to oldest unpaid installments inside a single locked PostgreSQL transaction.
 */
export async function recordPayment(
  ctx: TenantContext,
  input: CreatePaymentInput
): Promise<RecordedPaymentDto> {
  if (ctx.userRole !== 'ACCOUNTANT') {
    throw new AuthError('تسجيل الدفعات متاح للمحاسب فقط', 403);
  }

  // Fast-path idempotency check
  const existingPre = await prisma.payment.findUnique({
    where: {
      companyId_idempotencyKey: {
        companyId: ctx.companyId,
        idempotencyKey: input.idempotencyKey,
      },
    },
  });

  if (existingPre) {
    if (existingPre.contractId !== input.contractId || existingPre.amount !== input.amount) {
      throw new DomainError('مفتاح عدم التكرار مستخدم لعملية دفع أخرى', 409);
    }
    return fetchPaymentResult(ctx.companyId, existingPre.id, true);
  }

  try {
    const paymentId = await prisma.$transaction(async (tx) => {
      // Lock the contract row to serialize concurrent payments for the same contract
      const locked = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT "id" FROM "contracts"
        WHERE "id" = ${input.contractId} AND "company_id" = ${ctx.companyId}
        FOR UPDATE
      `;

      if (locked.length === 0) {
        throw new DomainError('العقد غير موجود', 404);
      }

      // Re-check idempotency inside lock
      const existingInTx = await tx.payment.findUnique({
        where: {
          companyId_idempotencyKey: {
            companyId: ctx.companyId,
            idempotencyKey: input.idempotencyKey,
          },
        },
      });

      if (existingInTx) {
        if (existingInTx.contractId !== input.contractId || existingInTx.amount !== input.amount) {
          throw new DomainError('مفتاح عدم التكرار مستخدم لعملية دفع أخرى', 409);
        }
        return { id: existingInTx.id, replayed: true };
      }

      const contract = await tx.contract.findUniqueOrThrow({
        where: { id: input.contractId },
        include: {
          installments: {
            orderBy: { sequenceNumber: 'asc' },
          },
        },
      });

      if (contract.status !== 'APPROVED') {
        throw new DomainError('لا يمكن تسجيل دفعة لعقد غير معتمد', 409);
      }

      const totalRemaining = calculateContractBalance(contract.installments);
      const amountCheck = validatePaymentAmount(input.amount, totalRemaining);
      if (!amountCheck.valid) {
        throw new DomainError(amountCheck.message ?? 'مبلغ الدفعة غير صالح', 400);
      }

      const { allocations, updatedInstallments } = allocatePayment(
        input.amount,
        contract.installments.map((inst) => ({
          id: inst.id,
          amount: inst.amount,
          paidAmount: inst.paidAmount,
        }))
      );

      const payment = await tx.payment.create({
        data: {
          companyId: ctx.companyId,
          contractId: contract.id,
          amount: input.amount,
          idempotencyKey: input.idempotencyKey,
          recordedById: ctx.userId,
        },
      });

      await tx.paymentAllocation.createMany({
        data: allocations.map((a) => ({
          paymentId: payment.id,
          installmentId: a.installmentId,
          amount: a.amount,
        })),
      });

      for (const upd of updatedInstallments) {
        await tx.installment.update({
          where: { id: upd.id },
          data: {
            paidAmount: upd.newPaidAmount,
            status: upd.newStatus,
          },
        });
      }

      await recordAuditLog(
        {
          companyId: ctx.companyId,
          userId: ctx.userId,
          action: 'PAYMENT_RECORDED',
          entityType: 'Payment',
          entityId: payment.id,
          details: {
            contractId: contract.id,
            amount: bigIntToString(input.amount),
            idempotencyKey: input.idempotencyKey,
          },
        },
        tx
      );

      return { id: payment.id, replayed: false };
    });

    return fetchPaymentResult(ctx.companyId, paymentId.id, paymentId.replayed);
  } catch (error) {
    // Handle race condition where two parallel requests used the exact same idempotencyKey
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      const winner = await prisma.payment.findUnique({
        where: {
          companyId_idempotencyKey: {
            companyId: ctx.companyId,
            idempotencyKey: input.idempotencyKey,
          },
        },
      });
      if (winner) {
        if (winner.contractId !== input.contractId || winner.amount !== input.amount) {
          throw new DomainError('مفتاح عدم التكرار مستخدم لعملية دفع أخرى', 409);
        }
        return fetchPaymentResult(ctx.companyId, winner.id, true);
      }
    }
    throw error;
  }
}
