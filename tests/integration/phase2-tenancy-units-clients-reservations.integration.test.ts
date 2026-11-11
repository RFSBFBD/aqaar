import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import 'dotenv/config';
import { prisma } from '@/lib/prisma';
import type { TenantContext } from '@/server/auth/guards';
import { listUnits, createUnit, updateUnit, getUnitDetail } from '@/server/services/unit.service';
import { listClients, getClientDetail, createClient, updateClient } from '@/server/services/client.service';
import { createReservation } from '@/server/services/reservation.service';
import { expireOverdueReservations } from '@/server/services/reservation-expiry.service';

const adminA: TenantContext = {
  companyId: 'cmp_nukhba_a',
  userId: 'usr_a_admin',
  userRole: 'ADMIN',
  userName: 'Admin A',
};

const accountantA: TenantContext = {
  companyId: 'cmp_nukhba_a',
  userId: 'usr_a_accountant',
  userRole: 'ACCOUNTANT',
  userName: 'Accountant A',
};

const salesA1: TenantContext = {
  companyId: 'cmp_nukhba_a',
  userId: 'usr_a_sales1',
  userRole: 'SALES',
  userName: 'Sales A1',
};

const salesA2: TenantContext = {
  companyId: 'cmp_nukhba_a',
  userId: 'usr_a_sales2',
  userRole: 'SALES',
  userName: 'Sales A2',
};

const adminB: TenantContext = {
  companyId: 'cmp_mustaqbal_b',
  userId: 'usr_b_admin',
  userRole: 'ADMIN',
  userName: 'Admin B',
};

describe('Phase 2 Integration Tests — Tenant Isolation, Units, Clients & Concurrent Reservations', () => {
  const createdUnitIds: string[] = [];
  const createdClientIds: string[] = [];

  beforeAll(async () => {
    await prisma.$queryRaw`SELECT 1`;
  });

  afterAll(async () => {
    // Cleanup test-created records in dependency order
    if (createdUnitIds.length > 0) {
      await prisma.reservation.deleteMany({ where: { unitId: { in: createdUnitIds } } });
      await prisma.unit.deleteMany({ where: { id: { in: createdUnitIds } } });
    }
    if (createdClientIds.length > 0) {
      await prisma.client.deleteMany({ where: { id: { in: createdClientIds } } });
    }
    await prisma.$disconnect();
  });

  it('isolates units, clients, and reservations strictly between Company A and Company B', async () => {
    const unitsA = await listUnits(adminA, { sortBy: 'price', sortDir: 'asc', page: 1, pageSize: 50 });
    const unitsB = await listUnits(adminB, { sortBy: 'price', sortDir: 'asc', page: 1, pageSize: 50 });

    const idsA = new Set(unitsA.items.map((u) => u.id));
    expect(unitsB.items.every((u) => !idsA.has(u.id))).toBe(true);

    // Company A cannot view Company B unit (IDOR)
    await expect(getUnitDetail(adminA, 'unit_b_101')).rejects.toMatchObject({ statusCode: 404 });

    // Company A sales cannot reserve Company B unit
    await expect(
      createReservation(salesA1, { unitId: 'unit_b_101', clientId: 'cli_a_1' })
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it('enforces SALES agent client isolation and restricts ACCOUNTANT from editing clients/units', async () => {
    const clientsSales1 = await listClients(salesA1);
    expect(clientsSales1.every((c) => c.agentId === salesA1.userId)).toBe(true);

    // Sales A1 cannot read or update Sales A2's client
    await expect(getClientDetail(salesA1, 'cli_a_2')).rejects.toMatchObject({ statusCode: 404 });
    await expect(
      updateClient(salesA1, 'cli_a_2', { notes: 'hacked' })
    ).rejects.toMatchObject({ statusCode: 404 });

    // Accountant cannot create/edit clients or units
    await expect(
      createClient(accountantA, { name: 'X', phone: '0500000000', notes: '' })
    ).rejects.toMatchObject({ statusCode: 403 });
    await expect(
      updateClient(accountantA, 'cli_a_1', { name: 'Y' })
    ).rejects.toMatchObject({ statusCode: 403 });
    await expect(
      updateUnit(accountantA, 'unit_a_101', { price: 90_000_000n })
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('allows only ADMIN to create/edit units and logs AuditLog on price change', async () => {
    await expect(
      createUnit(salesA1, {
        projectName: 'X',
        unitNumber: 'X-1',
        type: 'شقة',
        area: 100,
        rooms: 2,
        price: 50_000_000n,
      })
    ).rejects.toMatchObject({ statusCode: 403 });

    const created = await createUnit(adminA, {
      projectName: 'مشروع الاختبار',
      unitNumber: `TST-${Date.now()}`,
      type: 'شقة',
      area: 130,
      rooms: 3,
      price: 60_000_000n,
    });
    createdUnitIds.push(created.id);

    const updated = await updateUnit(adminA, created.id, { price: 65_000_000n });
    expect(updated.price).toBe('65000000');

    const audit = await prisma.auditLog.findFirst({
      where: {
        companyId: adminA.companyId,
        entityId: created.id,
        action: 'UNIT_PRICE_CHANGED',
      },
      orderBy: { createdAt: 'desc' },
    });
    expect(audit).not.toBeNull();
    expect(audit?.details).toContain('60000000');
    expect(audit?.details).toContain('65000000');
  });

  it('allows ONLY 1 winner out of 10 concurrent reservation attempts and blocks price edits when RESERVED', async () => {
    const unit = await createUnit(adminA, {
      projectName: 'مشروع التزامن',
      unitNumber: `CONC-${Date.now()}`,
      type: 'فيلا',
      area: 250,
      rooms: 5,
      price: 120_000_000n,
    });
    createdUnitIds.push(unit.id);

    const c1 = await createClient(salesA1, { name: 'عميل سباق 1', phone: '0500001111', notes: '' });
    const c2 = await createClient(salesA2, { name: 'عميل سباق 2', phone: '0500002222', notes: '' });
    createdClientIds.push(c1.id, c2.id);

    const attempts = Array.from({ length: 10 }, (_, idx) => {
      const ctx = idx % 2 === 0 ? salesA1 : salesA2;
      const clientId = idx % 2 === 0 ? c1.id : c2.id;
      return createReservation(ctx, { unitId: unit.id, clientId });
    });

    const settled = await Promise.allSettled(attempts);
    const fulfilled = settled.filter((r) => r.status === 'fulfilled');
    const rejected = settled.filter((r) => r.status === 'rejected');

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(9);

    const activeCount = await prisma.reservation.count({
      where: { unitId: unit.id, status: 'ACTIVE' },
    });
    expect(activeCount).toBe(1);

    // Price edit on RESERVED unit must be rejected
    await expect(
      updateUnit(adminA, unit.id, { price: 130_000_000n })
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it('expires 72-hour reservations idempotently and returns unit to AVAILABLE', async () => {
    const unit = await createUnit(adminA, {
      projectName: 'مشروع انتهاء الحجز',
      unitNumber: `EXP-${Date.now()}`,
      type: 'شقة',
      area: 110,
      rooms: 2,
      price: 55_000_000n,
    });
    createdUnitIds.push(unit.id);

    const pastTime = new Date(Date.now() - 73 * 60 * 60 * 1000);
    const res = await createReservation(salesA1, { unitId: unit.id, clientId: 'cli_a_1' }, pastTime);
    expect(res.status).toBe('ACTIVE');

    const expired1 = await expireOverdueReservations({ companyId: adminA.companyId, unitId: unit.id });
    expect(expired1).toBe(1);

    // Idempotent second call
    const expired2 = await expireOverdueReservations({ companyId: adminA.companyId, unitId: unit.id });
    expect(expired2).toBe(0);

    const refreshedUnit = await getUnitDetail(adminA, unit.id);
    expect(refreshedUnit.status).toBe('AVAILABLE');
  });
});
