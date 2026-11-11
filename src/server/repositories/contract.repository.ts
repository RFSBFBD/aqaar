import { prisma } from '@/lib/prisma';

export async function findContractsScoped(params: {
  companyId: string;
  createdById?: string;
}) {
  return prisma.contract.findMany({
    where: {
      companyId: params.companyId,
      ...(params.createdById ? { createdById: params.createdById } : {}),
    },
    include: {
      unit: { select: { id: true, projectName: true, unitNumber: true, status: true } },
      client: { select: { id: true, name: true, phone: true } },
      createdBy: { select: { id: true, name: true } },
      approvedBy: { select: { id: true, name: true } },
      installments: {
        select: { amount: true, paidAmount: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function findContractDetailScoped(params: {
  companyId: string;
  contractId: string;
  createdById?: string;
}) {
  return prisma.contract.findFirst({
    where: {
      id: params.contractId,
      companyId: params.companyId,
      ...(params.createdById ? { createdById: params.createdById } : {}),
    },
    include: {
      unit: true,
      client: true,
      reservation: true,
      createdBy: { select: { id: true, name: true } },
      approvedBy: { select: { id: true, name: true } },
      installments: {
        orderBy: { sequenceNumber: 'asc' },
      },
      payments: {
        orderBy: { createdAt: 'desc' },
        include: {
          recordedBy: { select: { id: true, name: true } },
          allocations: {
            include: {
              installment: { select: { sequenceNumber: true } },
            },
          },
        },
      },
    },
  });
}
