import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { AuthError, type TenantContext } from '@/server/auth/guards';

export interface AuditEntryInput {
  companyId: string;
  userId: string;
  action: string;
  entityType: string;
  entityId: string;
  details?: Record<string, unknown>;
}

export interface AuditLogDto {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  details: string;
  userName: string;
  userRole: string;
  createdAt: string;
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

/**
 * Lists company audit logs for ADMIN users only (read-only).
 */
export async function listAuditLogs(
  ctx: TenantContext,
  limit: number = 100
): Promise<AuditLogDto[]> {
  if (ctx.userRole !== 'ADMIN') {
    throw new AuthError('عرض سجل التدقيق متاح للمدير فقط', 403);
  }

  const safeLimit = Math.min(Math.max(limit, 1), 200);
  const rows = await prisma.auditLog.findMany({
    where: { companyId: ctx.companyId },
    include: {
      user: { select: { name: true, role: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: safeLimit,
  });

  return rows.map((row) => ({
    id: row.id,
    action: row.action,
    entityType: row.entityType,
    entityId: row.entityId,
    details: row.details,
    userName: row.user.name,
    userRole: row.user.role,
    createdAt: row.createdAt.toISOString(),
  }));
}
