import { prisma } from '@/lib/prisma';
import {
  bigIntToString,
  calculateContractBalance,
  calculateFinalPrice,
  calculateRemainingAmount,
  deriveInstallmentStatus,
  generateDueDates,
  generateInstallmentAmounts,
  validateDiscount,
  validateDownPayment,
  validateInstallmentSum,
} from '@/domain';
import { AuthError, DomainError, type TenantContext } from '@/server/auth/guards';
import type { CreateContractDraftInput, UpdateContractDraftInput } from '@/server/validation/contract';
import { findContractDetailScoped, findContractsScoped } from '@/server/repositories/contract.repository';
import { expireOverdueReservations } from '@/server/services/reservation-expiry.service';
import { recordAuditLog } from '@/server/services/audit.service';

export interface ContractSummaryDto {
  id: string;
  reservationId: string;
  unitId: string;
  unitNumber: string;
  projectName: string;
  unitStatus: 'AVAILABLE' | 'RESERVED' | 'SOLD';
  clientId: string;
  clientName: string;
  clientPhone: string;
  createdById: string;
  createdByName: string;
  approvedByName: string | null;
  status: 'DRAFT' | 'APPROVED';
  unitPrice: string;
  discount: string;
  finalPrice: string;
  downPayment: string;
  remainingAmount: string;
  outstandingBalance: string;
  installmentCount: number;
  startDate: string;
  approvedAt: string | null;
  createdAt: string;
}

export interface InstallmentDto {
  id: string;
  sequenceNumber: number;
  amount: string;
  paidAmount: string;
  remainingAmount: string;
  status: 'PENDING' | 'PARTIAL' | 'PAID' | 'OVERDUE';
  dueDate: string;
}

export interface PaymentAllocationDto {
  installmentId: string;
  sequenceNumber: number;
  amount: string;
}

export interface ContractPaymentDto {
  id: string;
  amount: string;
  idempotencyKey: string;
  recordedByName: string;
  createdAt: string;
  allocations: PaymentAllocationDto[];
}

export interface ContractDetailDto extends ContractSummaryDto {
  installments: InstallmentDto[];
  payments: ContractPaymentDto[];
}

export async function listContracts(ctx: TenantContext): Promise<ContractSummaryDto[]> {
  const createdById = ctx.userRole === 'SALES' ? ctx.userId : undefined;
  const rows = await findContractsScoped({
    companyId: ctx.companyId,
    createdById,
  });

  return rows.map((c) => {
    const outstanding =
      c.status === 'APPROVED'
        ? calculateContractBalance(c.installments)
        : c.remainingAmount;

    return {
      id: c.id,
      reservationId: c.reservationId,
      unitId: c.unit.id,
      unitNumber: c.unit.unitNumber,
      projectName: c.unit.projectName,
      unitStatus: c.unit.status,
      clientId: c.client.id,
      clientName: c.client.name,
      clientPhone: c.client.phone,
      createdById: c.createdBy.id,
      createdByName: c.createdBy.name,
      approvedByName: c.approvedBy?.name ?? null,
      status: c.status,
      unitPrice: bigIntToString(c.unitPrice),
      discount: bigIntToString(c.discount),
      finalPrice: bigIntToString(c.finalPrice),
      downPayment: bigIntToString(c.downPayment),
      remainingAmount: bigIntToString(c.remainingAmount),
      outstandingBalance: bigIntToString(outstanding),
      installmentCount: c.installmentCount,
      startDate: c.startDate.toISOString().slice(0, 10),
      approvedAt: c.approvedAt ? c.approvedAt.toISOString() : null,
      createdAt: c.createdAt.toISOString(),
    };
  });
}

export async function getContractDetail(
  ctx: TenantContext,
  contractId: string,
  now: Date = new Date()
): Promise<ContractDetailDto> {
  const createdById = ctx.userRole === 'SALES' ? ctx.userId : undefined;
  const c = await findContractDetailScoped({
    companyId: ctx.companyId,
    contractId,
    createdById,
  });

  if (!c) {
    throw new DomainError('العقد غير موجود', 404);
  }

  const outstanding =
    c.status === 'APPROVED'
      ? calculateContractBalance(c.installments)
      : c.remainingAmount;

  return {
    id: c.id,
    reservationId: c.reservationId,
    unitId: c.unit.id,
    unitNumber: c.unit.unitNumber,
    projectName: c.unit.projectName,
    unitStatus: c.unit.status,
    clientId: c.client.id,
    clientName: c.client.name,
    clientPhone: c.client.phone,
    createdById: c.createdBy.id,
    createdByName: c.createdBy.name,
    approvedByName: c.approvedBy?.name ?? null,
    status: c.status,
    unitPrice: bigIntToString(c.unitPrice),
    discount: bigIntToString(c.discount),
    finalPrice: bigIntToString(c.finalPrice),
    downPayment: bigIntToString(c.downPayment),
    remainingAmount: bigIntToString(c.remainingAmount),
    outstandingBalance: bigIntToString(outstanding),
    installmentCount: c.installmentCount,
    startDate: c.startDate.toISOString().slice(0, 10),
    approvedAt: c.approvedAt ? c.approvedAt.toISOString() : null,
    createdAt: c.createdAt.toISOString(),
    installments: c.installments.map((inst) => ({
      id: inst.id,
      sequenceNumber: inst.sequenceNumber,
      amount: bigIntToString(inst.amount),
      paidAmount: bigIntToString(inst.paidAmount),
      remainingAmount: bigIntToString(inst.amount - inst.paidAmount),
      status: deriveInstallmentStatus(inst.amount, inst.paidAmount, inst.dueDate, now),
      dueDate: inst.dueDate.toISOString().slice(0, 10),
    })),
    payments: c.payments.map((p) => ({
      id: p.id,
      amount: bigIntToString(p.amount),
      idempotencyKey: p.idempotencyKey,
      recordedByName: p.recordedBy.name,
      createdAt: p.createdAt.toISOString(),
      allocations: p.allocations.map((a) => ({
        installmentId: a.installmentId,
        sequenceNumber: a.installment.sequenceNumber,
        amount: bigIntToString(a.amount),
      })),
    })),
  };
}

export async function createContractDraft(
  ctx: TenantContext,
  input: CreateContractDraftInput,
  now: Date = new Date()
): Promise<ContractSummaryDto> {
  if (ctx.userRole !== 'SALES') {
    throw new AuthError('إنشاء مسودة العقد متاح لمندوب المبيعات فقط', 403);
  }

  // Ensure overdue reservations are expired cleanly before transaction
  await expireOverdueReservations({ companyId: ctx.companyId, now });

  return prisma.$transaction(async (tx) => {
    const reservation = await tx.reservation.findFirst({
      where: {
        id: input.reservationId,
        companyId: ctx.companyId,
        agentId: ctx.userId,
      },
      include: {
        unit: true,
        client: true,
        agent: { select: { id: true, name: true } },
      },
    });

    if (!reservation) {
      throw new DomainError('الحجز غير موجود أو غير تابع لك', 404);
    }

    // Lock reservation and unit rows
    await tx.$queryRaw`
      SELECT "id" FROM "reservations"
      WHERE "id" = ${reservation.id} AND "company_id" = ${ctx.companyId}
      FOR UPDATE
    `;
    await tx.$queryRaw`
      SELECT "id" FROM "units"
      WHERE "id" = ${reservation.unitId} AND "company_id" = ${ctx.companyId}
      FOR UPDATE
    `;

    const freshReservation = await tx.reservation.findUniqueOrThrow({
      where: { id: reservation.id },
      include: { unit: true },
    });

    if (
      freshReservation.status !== 'ACTIVE' ||
      freshReservation.expiresAt <= now ||
      freshReservation.unit.status !== 'RESERVED'
    ) {
      throw new DomainError('الحجز منتهي الصلاحية أو لم تعد الوحدة محجوزة', 409);
    }

    const existingContract = await tx.contract.findFirst({
      where: {
        reservationId: reservation.id,
        companyId: ctx.companyId,
      },
      select: { id: true },
    });

    if (existingContract) {
      throw new DomainError('يوجد عقد مرتبط بهذا الحجز مسبقاً', 409);
    }

    const unitPrice = freshReservation.unit.price;
    const discountCheck = validateDiscount(unitPrice, input.discount);
    if (!discountCheck.valid) {
      throw new DomainError(discountCheck.message ?? 'الخصم غير صالح', 400);
    }

    const finalPrice = calculateFinalPrice(unitPrice, input.discount);
    const downCheck = validateDownPayment(finalPrice, input.downPayment);
    if (!downCheck.valid) {
      throw new DomainError(downCheck.message ?? 'الدفعة الأولى غير صالحة', 400);
    }

    const remainingAmount = calculateRemainingAmount(finalPrice, input.downPayment);

    const created = await tx.contract.create({
      data: {
        companyId: ctx.companyId,
        reservationId: reservation.id,
        unitId: reservation.unitId,
        clientId: reservation.clientId,
        createdById: ctx.userId,
        status: 'DRAFT',
        unitPrice,
        discount: input.discount,
        finalPrice,
        downPayment: input.downPayment,
        remainingAmount,
        installmentCount: input.installmentCount,
        startDate: input.startDate,
      },
    });

    await recordAuditLog(
      {
        companyId: ctx.companyId,
        userId: ctx.userId,
        action: 'CONTRACT_DRAFT_CREATED',
        entityType: 'Contract',
        entityId: created.id,
        details: {
          unitNumber: freshReservation.unit.unitNumber,
          finalPrice: bigIntToString(finalPrice),
          installmentCount: input.installmentCount,
        },
      },
      tx
    );

    return {
      id: created.id,
      reservationId: created.reservationId,
      unitId: freshReservation.unit.id,
      unitNumber: freshReservation.unit.unitNumber,
      projectName: freshReservation.unit.projectName,
      unitStatus: freshReservation.unit.status,
      clientId: reservation.client.id,
      clientName: reservation.client.name,
      clientPhone: reservation.client.phone,
      createdById: ctx.userId,
      createdByName: reservation.agent.name,
      approvedByName: null,
      status: created.status,
      unitPrice: bigIntToString(created.unitPrice),
      discount: bigIntToString(created.discount),
      finalPrice: bigIntToString(created.finalPrice),
      downPayment: bigIntToString(created.downPayment),
      remainingAmount: bigIntToString(created.remainingAmount),
      outstandingBalance: bigIntToString(created.remainingAmount),
      installmentCount: created.installmentCount,
      startDate: created.startDate.toISOString().slice(0, 10),
      approvedAt: null,
      createdAt: created.createdAt.toISOString(),
    };
  });
}

export async function updateContractDraft(
  ctx: TenantContext,
  contractId: string,
  input: UpdateContractDraftInput,
  now: Date = new Date()
): Promise<ContractDetailDto> {
  await prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "contracts"
      WHERE "id" = ${contractId} AND "company_id" = ${ctx.companyId}
      FOR UPDATE
    `;

    if (locked.length === 0) {
      throw new DomainError('العقد غير موجود', 404);
    }

    const existing = await tx.contract.findUniqueOrThrow({
      where: { id: contractId },
      include: {
        reservation: true,
        unit: true,
      },
    });

    if (existing.status === 'APPROVED') {
      throw new DomainError('العقد معتمد ولا يمكن تعديله', 409);
    }

    if (ctx.userRole !== 'SALES' || existing.createdById !== ctx.userId) {
      throw new AuthError('تعديل مسودة العقد متاح لمندوب المبيعات المنشئ فقط', 403);
    }

    if (
      existing.reservation.status !== 'ACTIVE' ||
      existing.reservation.expiresAt <= now ||
      existing.unit.status !== 'RESERVED'
    ) {
      throw new DomainError('انتهت صلاحية الحجز ولا يمكن تعديل مسودة العقد', 409);
    }

    const nextDiscount = input.discount ?? existing.discount;
    const nextDownPayment = input.downPayment ?? existing.downPayment;
    const nextCount = input.installmentCount ?? existing.installmentCount;

    const discountCheck = validateDiscount(existing.unitPrice, nextDiscount);
    if (!discountCheck.valid) {
      throw new DomainError(discountCheck.message ?? 'الخصم غير صالح', 400);
    }

    const finalPrice = calculateFinalPrice(existing.unitPrice, nextDiscount);
    const downCheck = validateDownPayment(finalPrice, nextDownPayment);
    if (!downCheck.valid) {
      throw new DomainError(downCheck.message ?? 'الدفعة الأولى غير صالحة', 400);
    }

    const remainingAmount = calculateRemainingAmount(finalPrice, nextDownPayment);

    await tx.contract.update({
      where: { id: existing.id },
      data: {
        discount: nextDiscount,
        finalPrice,
        downPayment: nextDownPayment,
        remainingAmount,
        installmentCount: nextCount,
      },
    });
  });

  return getContractDetail(ctx, contractId, now);
}

/**
 * Approves a DRAFT contract in a single atomic transaction:
 * - Verifies ACCOUNTANT role
 * - Locks contract, reservation, and unit rows
 * - Re-verifies reservation is still ACTIVE & unexpired and unit is RESERVED
 * - Generates exact installment schedule with deterministic remainder & Jan 31 date clamping
 * - Transitions Contract -> APPROVED, Reservation -> CONVERTED, Unit -> SOLD
 * - Writes AuditLog
 */
export async function approveContract(
  ctx: TenantContext,
  contractId: string,
  now: Date = new Date()
): Promise<ContractDetailDto> {
  if (ctx.userRole !== 'ACCOUNTANT') {
    throw new AuthError('اعتماد العقود متاح للمحاسب فقط', 403);
  }

  // Expire any overdue reservations before attempting approval
  await expireOverdueReservations({ companyId: ctx.companyId, now });

  await prisma.$transaction(async (tx) => {
    const lockedContracts = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "contracts"
      WHERE "id" = ${contractId} AND "company_id" = ${ctx.companyId}
      FOR UPDATE
    `;

    if (lockedContracts.length === 0) {
      throw new DomainError('العقد غير موجود', 404);
    }

    const contract = await tx.contract.findUniqueOrThrow({
      where: { id: contractId },
    });

    if (contract.status !== 'DRAFT') {
      throw new DomainError('تم اعتماد العقد مسبقاً ولا يمكن اعتماده مرة أخرى', 409);
    }

    await tx.$queryRaw`
      SELECT "id" FROM "reservations"
      WHERE "id" = ${contract.reservationId} AND "company_id" = ${ctx.companyId}
      FOR UPDATE
    `;
    await tx.$queryRaw`
      SELECT "id" FROM "units"
      WHERE "id" = ${contract.unitId} AND "company_id" = ${ctx.companyId}
      FOR UPDATE
    `;

    const reservation = await tx.reservation.findUniqueOrThrow({
      where: { id: contract.reservationId },
    });
    const unit = await tx.unit.findUniqueOrThrow({
      where: { id: contract.unitId },
    });

    if (
      reservation.status !== 'ACTIVE' ||
      reservation.expiresAt <= now ||
      unit.status !== 'RESERVED'
    ) {
      throw new DomainError('انتهت صلاحية الحجز أو لم تعد الوحدة محجوزة', 409);
    }

    // Generate installments deterministically
    const amounts = generateInstallmentAmounts(
      contract.remainingAmount,
      contract.installmentCount
    );
    if (!validateInstallmentSum(amounts, contract.remainingAmount)) {
      throw new DomainError('خطأ داخلي في تطابق مجموع الأقساط', 500);
    }

    const dueDates = generateDueDates(contract.startDate, contract.installmentCount);

    await tx.installment.createMany({
      data: amounts.map((amount, index) => ({
        contractId: contract.id,
        sequenceNumber: index + 1,
        amount,
        paidAmount: 0n,
        status: amount === 0n ? 'PAID' : 'PENDING',
        dueDate: dueDates[index]!,
      })),
    });

    await tx.contract.update({
      where: { id: contract.id },
      data: {
        status: 'APPROVED',
        approvedById: ctx.userId,
        approvedAt: now,
      },
    });

    await tx.reservation.update({
      where: { id: reservation.id },
      data: { status: 'CONVERTED' },
    });

    await tx.unit.update({
      where: { id: unit.id },
      data: { status: 'SOLD' },
    });

    await recordAuditLog(
      {
        companyId: ctx.companyId,
        userId: ctx.userId,
        action: 'CONTRACT_APPROVED',
        entityType: 'Contract',
        entityId: contract.id,
        details: {
          unitNumber: unit.unitNumber,
          finalPrice: bigIntToString(contract.finalPrice),
          installmentCount: contract.installmentCount,
        },
      },
      tx
    );
  });

  return getContractDetail(ctx, contractId, now);
}
