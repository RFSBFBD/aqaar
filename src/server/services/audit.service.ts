import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

export interface AuditEntryInput {
  companyId: string;
  userId: string;
  action: string;
  entityType: string;
  entityId: string;
  details?: Record<string, unknown>;
}

/**
 * Records an immutable audit log entry. Accepts an optional transaction client
 * so the audit event is committed atomically with the business operation.
 */
export async function recordAuditLog(
  input: AuditEntryInput,
  tx?: Prisma.TransactionClient
): Promise<void> {
  const client = tx ?? prisma;
  await client.auditLog.create({
    data: {
      companyId: input.companyId,
      userId: input.userId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      details: JSON.stringify(input.details ?? {}),
    },
  });
}
