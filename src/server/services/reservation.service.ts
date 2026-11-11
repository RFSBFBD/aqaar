import { prisma } from '@/lib/prisma';
import { bigIntToString } from '@/domain';
import { AuthError, DomainError, type TenantContext } from '@/server/auth/guards';
import type { CreateReservationInput } from '@/server/validation/reservation';
import { findClientByIdScoped } from '@/server/repositories/client.repository';
import { findReservationsScoped } from '@/server/repositories/reservation.repository';
import { expireOverdueReservations } from '@/server/services/reservation-expiry.service';
import { recordAuditLog } from '@/server/services/audit.service';

const RESERVATION_TTL_MS = 72 * 60 * 60 * 1000;

export interface ReservationDto {
  id: string;
  unitId: string;
  unitNumber: string;
  projectName: string;
  unitPrice: string;
  unitStatus: 'AVAILABLE' | 'RESERVED' | 'SOLD';
  clientId: string;
  clientName: string;
  clientPhone: string;
  agentId: string;
  agentName: string;
  status: 'ACTIVE' | 'EXPIRED' | 'CONVERTED';
  expiresAt: string;
  createdAt: string;
  contractId: string | null;
}

export async function listReservations(ctx: TenantContext): Promise<ReservationDto[]> {
  await expireOverdueReservations({ companyId: ctx.companyId });

  const agentId = ctx.userRole === 'SALES' ? ctx.userId : undefined;
  const rows = await findReservationsScoped({
    companyId: ctx.companyId,
    agentId,
  });

  return rows.map((r) => ({
    id: r.id,
    unitId: r.unit.id,
    unitNumber: r.unit.unitNumber,
    projectName: r.unit.projectName,
    unitPrice: bigIntToString(r.unit.price),
    unitStatus: r.unit.status,
    clientId: r.client.id,
    clientName: r.client.name,
    clientPhone: r.client.phone,
    agentId: r.agent.id,
    agentName: r.agent.name,
    status: r.status,
    expiresAt: r.expiresAt.toISOString(),
    createdAt: r.createdAt.toISOString(),
    contractId: r.contracts[0]?.id ?? null,
  }));
}

/**
 * Atomically reserves an AVAILABLE unit for 72 hours.
 * Uses PostgreSQL conditional UPDATE inside a transaction + partial unique index safety net
 * so concurrent requests for the same unit allow at most 1 winner.
 */
export async function createReservation(
  ctx: TenantContext,
  input: CreateReservationInput,
  now: Date = new Date()
): Promise<ReservationDto> {
  if (ctx.userRole !== 'SALES') {
    throw new AuthError('إنشاء الحجز متاح لمندوب المبيعات فقط', 403);
  }

  return prisma.$transaction(async (tx) => {
    // 1. Verify client ownership (must belong to same company AND same SALES agent)
    const client = await findClientByIdScoped({
      companyId: ctx.companyId,
      clientId: input.clientId,
      agentId: ctx.userId,
      tx,
    });

    if (!client) {
      throw new DomainError('العميل غير موجود أو غير تابع لك', 404);
    }

    // 2. Lazy expiry for this specific unit before locking/claiming
    await expireOverdueReservations({
      companyId: ctx.companyId,
      unitId: input.unitId,
      now,
      tx,
    });

    // 3. Atomic conditional update on the unit (company-scoped & status=AVAILABLE)
    const updatedCount = await tx.$executeRaw`
      UPDATE "units"
      SET "status" = 'RESERVED'::"UnitStatus", "updated_at" = NOW()
      WHERE "id" = ${input.unitId}
        AND "company_id" = ${ctx.companyId}
        AND "status" = 'AVAILABLE'::"UnitStatus"
    `;

    if (updatedCount === 0) {
      // Distinguish between unit not found in company (404) vs already reserved/sold (409)
      const unitExists = await tx.unit.findFirst({
        where: { id: input.unitId, companyId: ctx.companyId },
        select: { id: true, status: true },
      });

      if (!unitExists) {
        throw new DomainError('الوحدة غير موجودة', 404);
      }
      throw new DomainError('الوحدة غير متاحة للحجز حالياً', 409);
    }

    const expiresAt = new Date(now.getTime() + RESERVATION_TTL_MS);

    const reservation = await tx.reservation.create({
      data: {
        companyId: ctx.companyId,
        unitId: input.unitId,
        clientId: input.clientId,
        agentId: ctx.userId,
        status: 'ACTIVE',
        expiresAt,
      },
      include: {
        unit: true,
        client: true,
        agent: { select: { id: true, name: true } },
      },
    });

    await recordAuditLog(
      {
        companyId: ctx.companyId,
        userId: ctx.userId,
        action: 'RESERVATION_CREATED',
        entityType: 'Reservation',
        entityId: reservation.id,
        details: {
          unitId: reservation.unitId,
          unitNumber: reservation.unit.unitNumber,
          clientId: reservation.clientId,
          expiresAt: expiresAt.toISOString(),
        },
      },
      tx
    );

    return {
      id: reservation.id,
      unitId: reservation.unit.id,
      unitNumber: reservation.unit.unitNumber,
      projectName: reservation.unit.projectName,
      unitPrice: bigIntToString(reservation.unit.price),
      unitStatus: reservation.unit.status,
      clientId: reservation.client.id,
      clientName: reservation.client.name,
      clientPhone: reservation.client.phone,
      agentId: reservation.agent.id,
      agentName: reservation.agent.name,
      status: reservation.status,
      expiresAt: reservation.expiresAt.toISOString(),
      createdAt: reservation.createdAt.toISOString(),
      contractId: null,
    };
  });
}
