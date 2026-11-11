import type { Unit } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { bigIntToString } from '@/domain';
import { AuthError, DomainError, type TenantContext } from '@/server/auth/guards';
import type { CreateUnitInput, UpdateUnitInput, UnitQueryInput } from '@/server/validation/unit';
import { createUnitRecord, findUnitById, findUnitsByCompany } from '@/server/repositories/unit.repository';
import { expireOverdueReservations } from '@/server/services/reservation-expiry.service';
import { recordAuditLog } from '@/server/services/audit.service';

export interface UnitDto {
  id: string;
  projectName: string;
  unitNumber: string;
  type: string;
  area: number;
  rooms: number;
  price: string;
  status: 'AVAILABLE' | 'RESERVED' | 'SOLD';
  createdAt: string;
  updatedAt: string;
}

export function toUnitDto(unit: Unit): UnitDto {
  return {
    id: unit.id,
    projectName: unit.projectName,
    unitNumber: unit.unitNumber,
    type: unit.type,
    area: unit.area,
    rooms: unit.rooms,
    price: bigIntToString(unit.price),
    status: unit.status,
    createdAt: unit.createdAt.toISOString(),
    updatedAt: unit.updatedAt.toISOString(),
  };
}

export async function listUnits(
  ctx: TenantContext,
  query: UnitQueryInput
): Promise<{
  items: UnitDto[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}> {
  // Lazy expiry before reading unit inventory
  await expireOverdueReservations({ companyId: ctx.companyId });

  const { items, total } = await findUnitsByCompany({
    companyId: ctx.companyId,
    status: query.status,
    minPrice: query.minPrice,
    maxPrice: query.maxPrice,
    sortBy: query.sortBy,
    sortDir: query.sortDir,
    page: query.page,
    pageSize: query.pageSize,
  });

  return {
    items: items.map(toUnitDto),
    total,
    page: query.page,
    pageSize: query.pageSize,
    totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
  };
}

export async function getUnitDetail(ctx: TenantContext, unitId: string): Promise<UnitDto> {
  await expireOverdueReservations({ companyId: ctx.companyId, unitId });

  const unit = await findUnitById(ctx.companyId, unitId);
  if (!unit) {
    throw new DomainError('الوحدة غير موجودة', 404);
  }
  return toUnitDto(unit);
}

export async function createUnit(ctx: TenantContext, input: CreateUnitInput): Promise<UnitDto> {
  if (ctx.userRole !== 'ADMIN') {
    throw new AuthError('إضافة الوحدات متاحة للمدير فقط', 403);
  }

  const unit = await createUnitRecord({
    companyId: ctx.companyId,
    projectName: input.projectName,
    unitNumber: input.unitNumber,
    type: input.type,
    area: input.area,
    rooms: input.rooms,
    price: input.price,
  });

  await recordAuditLog({
    companyId: ctx.companyId,
    userId: ctx.userId,
    action: 'UNIT_CREATED',
    entityType: 'Unit',
    entityId: unit.id,
    details: { unitNumber: unit.unitNumber, price: bigIntToString(unit.price) },
  });

  return toUnitDto(unit);
}

export async function updateUnit(
  ctx: TenantContext,
  unitId: string,
  input: UpdateUnitInput
): Promise<UnitDto> {
  if (ctx.userRole !== 'ADMIN') {
    throw new AuthError('تعديل الوحدات متاح للمدير فقط', 403);
  }

  const updated = await prisma.$transaction(async (tx) => {
    await expireOverdueReservations({ companyId: ctx.companyId, unitId, tx });

    // Lock the unit row to serialize price edits against concurrent reservations
    await tx.$queryRaw`
      SELECT "id" FROM "units"
      WHERE "id" = ${unitId} AND "company_id" = ${ctx.companyId}
      FOR UPDATE
    `;

    const existing = await findUnitById(ctx.companyId, unitId, tx);
    if (!existing) {
      throw new DomainError('الوحدة غير موجودة', 404);
    }

    const isPriceChanged = input.price !== undefined && input.price !== existing.price;

    if (isPriceChanged && existing.status !== 'AVAILABLE') {
      throw new DomainError('لا يمكن تعديل سعر وحدة محجوزة أو مباعة', 409);
    }

    const result = await tx.unit.update({
      where: { id: existing.id },
      data: {
        ...(input.projectName !== undefined ? { projectName: input.projectName } : {}),
        ...(input.unitNumber !== undefined ? { unitNumber: input.unitNumber } : {}),
        ...(input.type !== undefined ? { type: input.type } : {}),
        ...(input.area !== undefined ? { area: input.area } : {}),
        ...(input.rooms !== undefined ? { rooms: input.rooms } : {}),
        ...(input.price !== undefined ? { price: input.price } : {}),
      },
    });

    if (isPriceChanged && input.price !== undefined) {
      await recordAuditLog(
        {
          companyId: ctx.companyId,
          userId: ctx.userId,
          action: 'UNIT_PRICE_CHANGED',
          entityType: 'Unit',
          entityId: existing.id,
          details: {
            unitNumber: result.unitNumber,
            oldPrice: bigIntToString(existing.price),
            newPrice: bigIntToString(input.price),
          },
        },
        tx
      );
    }

    return result;
  });

  return toUnitDto(updated);
}
