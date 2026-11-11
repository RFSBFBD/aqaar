import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

interface ExpiredReservationRow {
  id: string;
  unit_id: string;
  company_id: string;
}

/**
 * Atomically and idempotently expires all ACTIVE reservations whose expiresAt <= now,
 * returning their RESERVED units back to AVAILABLE.
 * Safe to run concurrently (uses atomic conditional UPDATE ... RETURNING).
 */
export async function expireOverdueReservations(
  options?: {
    companyId?: string;
    unitId?: string;
    now?: Date;
    tx?: Prisma.TransactionClient;
  }
): Promise<number> {
  const now = options?.now ?? new Date();
  const companyId = options?.companyId;
  const unitId = options?.unitId;

  const run = async (tx: Prisma.TransactionClient): Promise<number> => {
    const expiredRows = await tx.$queryRaw<ExpiredReservationRow[]>`
      UPDATE "reservations"
      SET "status" = 'EXPIRED'::"ReservationStatus", "updated_at" = NOW()
      WHERE "status" = 'ACTIVE'::"ReservationStatus"
        AND "expires_at" <= ${now}
        ${companyId ? Prisma.sql`AND "company_id" = ${companyId}` : Prisma.empty}
        ${unitId ? Prisma.sql`AND "unit_id" = ${unitId}` : Prisma.empty}
      RETURNING "id", "unit_id", "company_id"
    `;

    if (expiredRows.length === 0) {
      return 0;
    }

    const unitIds = Array.from(new Set(expiredRows.map((r) => r.unit_id)));

    await tx.unit.updateMany({
      where: {
        id: { in: unitIds },
        status: 'RESERVED',
      },
      data: {
        status: 'AVAILABLE',
      },
    });

    return expiredRows.length;
  };

  if (options?.tx) {
    return run(options.tx);
  }

  return prisma.$transaction(run);
}
