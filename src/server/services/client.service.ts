import { prisma } from '@/lib/prisma';
import { AuthError, DomainError, type TenantContext } from '@/server/auth/guards';
import type { CreateClientInput, UpdateClientInput } from '@/server/validation/client';
import { findClientByIdScoped, findClientsScoped } from '@/server/repositories/client.repository';
import { recordAuditLog } from '@/server/services/audit.service';

export interface ClientDto {
  id: string;
  name: string;
  phone: string;
  notes: string;
  agentId: string;
  agentName: string;
  createdAt: string;
  updatedAt: string;
}

export async function listClients(ctx: TenantContext): Promise<ClientDto[]> {
  // SALES sees only their own clients; ADMIN & ACCOUNTANT see all company clients
  const agentId = ctx.userRole === 'SALES' ? ctx.userId : undefined;
  const rows = await findClientsScoped({
    companyId: ctx.companyId,
    agentId,
  });

  return rows.map((c) => ({
    id: c.id,
    name: c.name,
    phone: c.phone,
    notes: c.notes,
    agentId: c.agentId,
    agentName: c.agent.name,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  }));
}

export async function getClientDetail(ctx: TenantContext, clientId: string): Promise<ClientDto> {
  const agentId = ctx.userRole === 'SALES' ? ctx.userId : undefined;
  const c = await findClientByIdScoped({
    companyId: ctx.companyId,
    clientId,
    agentId,
  });

  if (!c) {
    throw new DomainError('العميل غير موجود', 404);
  }

  return {
    id: c.id,
    name: c.name,
    phone: c.phone,
    notes: c.notes,
    agentId: c.agentId,
    agentName: c.agent.name,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  };
}

export async function createClient(ctx: TenantContext, input: CreateClientInput): Promise<ClientDto> {
  if (ctx.userRole !== 'SALES') {
    throw new AuthError('إضافة العملاء متاحة لمندوب المبيعات فقط', 403);
  }

  const created = await prisma.client.create({
    data: {
      companyId: ctx.companyId,
      agentId: ctx.userId,
      name: input.name,
      phone: input.phone,
      notes: input.notes,
    },
    include: {
      agent: { select: { id: true, name: true } },
    },
  });

  await recordAuditLog({
    companyId: ctx.companyId,
    userId: ctx.userId,
    action: 'CLIENT_CREATED',
    entityType: 'Client',
    entityId: created.id,
    details: { name: created.name },
  });

  return {
    id: created.id,
    name: created.name,
    phone: created.phone,
    notes: created.notes,
    agentId: created.agentId,
    agentName: created.agent.name,
    createdAt: created.createdAt.toISOString(),
    updatedAt: created.updatedAt.toISOString(),
  };
}

export async function updateClient(
  ctx: TenantContext,
  clientId: string,
  input: UpdateClientInput
): Promise<ClientDto> {
  if (ctx.userRole !== 'SALES') {
    throw new AuthError('تعديل بيانات العميل متاح لمندوب المبيعات فقط', 403);
  }

  // Ownership check: SALES can only edit their own client inside their company
  const existing = await findClientByIdScoped({
    companyId: ctx.companyId,
    clientId,
    agentId: ctx.userId,
  });

  if (!existing) {
    throw new DomainError('العميل غير موجود', 404);
  }

  const updated = await prisma.client.update({
    where: { id: existing.id },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.phone !== undefined ? { phone: input.phone } : {}),
      ...(input.notes !== undefined ? { notes: input.notes } : {}),
    },
    include: {
      agent: { select: { id: true, name: true } },
    },
  });

  return {
    id: updated.id,
    name: updated.name,
    phone: updated.phone,
    notes: updated.notes,
    agentId: updated.agentId,
    agentName: updated.agent.name,
    createdAt: updated.createdAt.toISOString(),
    updatedAt: updated.updatedAt.toISOString(),
  };
}
