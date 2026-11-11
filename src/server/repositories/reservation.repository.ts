import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

export async function findReservationsScoped(params: {
  companyId: string;
  agentId?: string;
}) {
  return prisma.reservation.findMany({
    where: {
      companyId: params.companyId,
      ...(params.agentId ? { agentId: params.agentId } : {}),
    },
    include: {
      unit: {
        select: {
          id: true,
          projectName: true,
          unitNumber: true,
          price: true,
          status: true,
        },
      },
      client: {
        select: {
          id: true,
          name: true,
          phone: true,
        },
      },
      agent: {
        select: {
          id: true,
          name: true,
        },
      },
      contracts: {
        select: {
          id: true,
          status: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function findReservationByIdScoped(params: {
  companyId: string;
  reservationId: string;
  agentId?: string;
  tx?: Prisma.TransactionClient;
}) {
  const client = params.tx ?? prisma;
  return client.reservation.findFirst({
    where: {
      id: params.reservationId,
      companyId: params.companyId,
      ...(params.agentId ? { agentId: params.agentId } : {}),
    },
    include: {
      unit: true,
      client: true,
      agent: { select: { id: true, name: true } },
    },
  });
}
