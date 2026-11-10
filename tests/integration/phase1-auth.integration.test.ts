import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import 'dotenv/config';
import { prisma } from '@/lib/prisma';
import { loginWithCredentials } from '@/server/auth/service';
import { validateSession, invalidateSession, hashSessionToken } from '@/server/auth/session';
import { AuthError } from '@/server/auth/guards';

describe('Phase 1 Integration Tests — Auth, Sessions & Seed Isolation (PostgreSQL)', () => {
  beforeAll(async () => {
    await prisma.$queryRaw`SELECT 1`;
  });

  afterAll(async () => {
    await prisma.loginAttempt.deleteMany({
      where: { ipAddress: { startsWith: 'test-192.' } },
    });
    await prisma.$disconnect();
  });

  it('has seeded 2 distinct companies with ADMIN, ACCOUNTANT, and 2 SALES users each', async () => {
    const companies = await prisma.company.findMany({ include: { users: true } });
    expect(companies.length).toBeGreaterThanOrEqual(2);

    const nukhba = companies.find((c) => c.id === 'cmp_nukhba_a');
    const mustaqbal = companies.find((c) => c.id === 'cmp_mustaqbal_b');
    expect(nukhba).toBeDefined();
    expect(mustaqbal).toBeDefined();
    expect(nukhba?.users).toHaveLength(4);
    expect(mustaqbal?.users).toHaveLength(4);
  });

  it('logs in with valid credentials, hashes session token in DB, and never leaks passwordHash', async () => {
    const result = await loginWithCredentials(
      'sales1.a@nukhba.local',
      process.env.SEED_DEFAULT_PASSWORD ?? 'AqarElite!2026',
      'test-192.0.2.1'
    );

    expect(result.user.companyId).toBe('cmp_nukhba_a');
    expect(result.user.role).toBe('SALES');
    expect((result.user as unknown as Record<string, unknown>).passwordHash).toBeUndefined();

    // DB stores hash, not raw token
    const dbSession = await prisma.session.findUnique({
      where: { tokenHash: hashSessionToken(result.token) },
    });
    expect(dbSession).not.toBeNull();
    expect(dbSession?.tokenHash).not.toBe(result.token);

    const validated = await validateSession(result.token);
    expect(validated?.user.id).toBe(result.user.id);

    // Logout invalidates session; replay fails
    await invalidateSession(result.token);
    const afterLogout = await validateSession(result.token);
    expect(afterLogout).toBeNull();
  });

  it('returns identical error message for nonexistent email and wrong password', async () => {
    let unknownErr: AuthError | null = null;
    let wrongPassErr: AuthError | null = null;

    try {
      await loginWithCredentials('nonexistent@nukhba.local', 'Wrong123!', 'test-192.0.2.2');
    } catch (e) {
      unknownErr = e as AuthError;
    }

    try {
      await loginWithCredentials('admin.a@nukhba.local', 'Wrong123!', 'test-192.0.2.3');
    } catch (e) {
      wrongPassErr = e as AuthError;
    }

    expect(unknownErr).toBeInstanceOf(AuthError);
    expect(wrongPassErr).toBeInstanceOf(AuthError);
    expect(unknownErr?.message).toBe(wrongPassErr?.message);
    expect(unknownErr?.statusCode).toBe(401);
  });

  it('rejects expired sessions', async () => {
    const token = 'expired_test_token_' + Date.now();
    await prisma.session.create({
      data: {
        tokenHash: hashSessionToken(token),
        userId: 'usr_a_admin',
        expiresAt: new Date(Date.now() - 60_000),
      },
    });

    const validated = await validateSession(token);
    expect(validated).toBeNull();
  });

  it('enforces rate limiting after repeated failed login attempts', async () => {
    const ip = 'test-192.0.2.99';
    const email = 'ratelimit.test@nukhba.local';

    for (let i = 0; i < 5; i++) {
      await expect(loginWithCredentials(email, 'BadPass!', ip)).rejects.toMatchObject({
        statusCode: 401,
      });
    }

    await expect(loginWithCredentials(email, 'BadPass!', ip)).rejects.toMatchObject({
      statusCode: 429,
    });
  });
});
