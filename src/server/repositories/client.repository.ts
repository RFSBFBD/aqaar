import { Prisma, type Client } from '@prisma/client';
import { prisma } from '@/lib/prisma';

export async function findClientsScoped(params: {
  companyId: string;
  agentId?: string;
}): Promise<Array<Client & { agent: { id: string; name: string } }>> {
  return prisma.client.findMany({
    where: {
      companyId: params.companyId,
      ...(params.agentId ? { agentId: params.agentId } : {}),
    },
    include: {
      agent: {
        select: { id: true, name: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function findClientByIdScoped(params: {
  companyId: string;
  clientId: string;
  agentId?: string;
  tx?: Prisma.TransactionClient;
}): Promise<(Client & { agent: { id: string; name: string } }) | null> {
  const client = params.tx ?? prisma;
  return client.client.findFirst({
    where: {
      id: params.clientId,
      companyId: params.companyId,
      ...(params.agentId ? { agentId: params.agentId } : {}),
    },
    include: {
      agent: {
        select: { id: true, name: true },
      },
    },
  });
}
