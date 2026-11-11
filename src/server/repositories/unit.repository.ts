import { Prisma, type Unit, type UnitStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';

export interface UnitListParams {
  companyId: string;
  status?: UnitStatus;
  minPrice?: bigint;
  maxPrice?: bigint;
  sortBy: 'price' | 'area';
  sortDir: 'asc' | 'desc';
  page: number;
  pageSize: number;
}

export async function findUnitsByCompany(params: UnitListParams): Promise<{
  items: Unit[];
  total: number;
}> {
  const where: Prisma.UnitWhereInput = {
    companyId: params.companyId,
    ...(params.status ? { status: params.status } : {}),
    ...(params.minPrice !== undefined || params.maxPrice !== undefined
      ? {
          price: {
            ...(params.minPrice !== undefined ? { gte: params.minPrice } : {}),
            ...(params.maxPrice !== undefined ? { lte: params.maxPrice } : {}),
          },
        }
      : {}),
  };

  const orderBy: Prisma.UnitOrderByWithRelationInput =
    params.sortBy === 'area'
      ? { area: params.sortDir }
      : { price: params.sortDir };

  const skip = (params.page - 1) * params.pageSize;

  const [items, total] = await Promise.all([
    prisma.unit.findMany({
      where,
      orderBy: [orderBy, { id: 'asc' }],
      skip,
      take: params.pageSize,
    }),
    prisma.unit.count({ where }),
  ]);

  return { items, total };
}

export async function findUnitById(
  companyId: string,
  unitId: string,
  tx?: Prisma.TransactionClient
): Promise<Unit | null> {
  const client = tx ?? prisma;
  return client.unit.findFirst({
    where: {
      id: unitId,
      companyId,
    },
  });
}

export async function createUnitRecord(data: {
  companyId: string;
  projectName: string;
  unitNumber: string;
  type: string;
  area: number;
  rooms: number;
  price: bigint;
}): Promise<Unit> {
  return prisma.unit.create({
    data: {
      companyId: data.companyId,
      projectName: data.projectName,
      unitNumber: data.unitNumber,
      type: data.type,
      area: data.area,
      rooms: data.rooms,
      price: data.price,
      status: 'AVAILABLE',
    },
  });
}
