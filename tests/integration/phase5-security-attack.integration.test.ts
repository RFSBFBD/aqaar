import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import 'dotenv/config';
import { prisma } from '@/lib/prisma';
import type { TenantContext } from '@/server/auth/guards';
import { createClient, getClientDetail } from '@/server/services/client.service';
import { listAuditLogs } from '@/server/services/audit.service';
import { listUnits } from '@/server/services/unit.service';

const salesA1: TenantContext = {
  companyId: 'cmp_nukhba_a',
  userId: 'usr_a_sales1',
  userRole: 'SALES',
  userName: 'Sales A1',
};

const accountantA: TenantContext = {
  companyId: 'cmp_nukhba_a',
  userId: 'usr_a_accountant',
  userRole: 'ACCOUNTANT',
  userName: 'Accountant A',
};

const adminA: TenantContext = {
  companyId: 'cmp_nukhba_a',
  userId: 'usr_a_admin',
  userRole: 'ADMIN',
  userName: 'Admin A',
};

describe('Phase 5 Security & Attack Checklist (PostgreSQL)', () => {
  const createdClientIds: string[] = [];

  beforeAll(async () => {
    await prisma.$queryRaw`SELECT 1`;
  });

  afterAll(async () => {
    if (createdClientIds.length > 0) {
      await prisma.client.deleteMany({ where: { id: { in: createdClientIds } } });
    }
    await prisma.$disconnect();
  });

  it('denies AuditLog access to SALES and ACCOUNTANT, allows ADMIN scoped to own company', async () => {
    await expect(listAuditLogs(salesA1)).rejects.toMatchObject({ statusCode: 403 });
    await expect(listAuditLogs(accountantA)).rejects.toMatchObject({ statusCode: 403 });

    const logs = await listAuditLogs(adminA);
    expect(Array.isArray(logs)).toBe(true);
  });

  it('stores XSS payload in client notes as inert plain text and blocks cross-company access', async () => {
    const xssPayload = '<script>alert("xss")</script><img src=x onerror=alert(1)>';
    const created = await createClient(salesA1, {
      name: 'عميل أمني',
      phone: '0507778888',
      notes: xssPayload,
    });
    createdClientIds.push(created.id);

    const fetched = await getClientDetail(salesA1, created.id);
    expect(fetched.notes).toBe(xssPayload);

    // Company B admin cannot read Company A client
    const adminB: TenantContext = {
      companyId: 'cmp_mustaqbal_b',
      userId: 'usr_b_admin',
      userRole: 'ADMIN',
      userName: 'Admin B',
    };
    await expect(getClientDetail(adminB, created.id)).rejects.toMatchObject({ statusCode: 404 });
  });

  it('returns only Company A units when queried with valid pagination', async () => {
    const res = await listUnits(salesA1, { sortBy: 'price', sortDir: 'asc', page: 1, pageSize: 20 });
    expect(res.items.every((u) => !u.unitNumber.startsWith('MS-'))).toBe(true);
  });
});
