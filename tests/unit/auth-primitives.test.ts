import { describe, it, expect, vi, afterEach } from 'vitest';
import { loginSchema } from '@/server/validation/auth';
import { hashSessionToken, generateSessionToken, hashPassword, verifyPassword } from '@/server/auth/crypto';
import { getSessionCookieOptions } from '@/server/auth/cookies';
import { assertCsrfSafe } from '@/server/http/csrf';
import type { NextRequest } from 'next/server';

describe('Phase 1 Auth & Security Primitives', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('validates login input strictly (rejects unknown fields, empty password, invalid email)', () => {
    expect(loginSchema.safeParse({ email: 'Admin@Nukhba.local', password: 'secret' }).success).toBe(true);
    // Normalizes email
    const ok = loginSchema.parse({ email: '  Admin@Nukhba.local ', password: 'secret' });
    expect(ok.email).toBe('admin@nukhba.local');

    // Rejects extra fields (mass assignment / forged role or companyId)
    expect(
      loginSchema.safeParse({
        email: 'admin@nukhba.local',
        password: 'secret',
        role: 'ADMIN',
        companyId: 'cmp_other',
      }).success
    ).toBe(false);

    expect(loginSchema.safeParse({ email: 'bad-email', password: 'secret' }).success).toBe(false);
    expect(loginSchema.safeParse({ email: 'a@b.com', password: '' }).success).toBe(false);
  });

  it('hashes passwords with bcrypt and verifies securely', async () => {
    const hash = await hashPassword('AqarTest!2026');
    expect(hash).not.toBe('AqarTest!2026');
    expect(hash.startsWith('$2')).toBe(true);
    expect(await verifyPassword('AqarTest!2026', hash)).toBe(true);
    expect(await verifyPassword('WrongPass', hash)).toBe(false);
  });

  it('generates unique 64-char hex session tokens and hashes them deterministically', () => {
    const t1 = generateSessionToken();
    const t2 = generateSessionToken();
    expect(t1).toHaveLength(64);
    expect(t1).not.toBe(t2);
    expect(hashSessionToken(t1)).toHaveLength(64);
    expect(hashSessionToken(t1)).not.toBe(t1);
    expect(hashSessionToken(t1)).toBe(hashSessionToken(t1));
  });

  it('enforces HttpOnly, SameSite=Lax, Path=/ and Secure in production', () => {
    const exp = new Date(Date.now() + 3600_000);
    vi.stubEnv('NODE_ENV', 'development');
    expect(getSessionCookieOptions(exp)).toMatchObject({
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      secure: false,
    });

    vi.stubEnv('NODE_ENV', 'production');
    expect(getSessionCookieOptions(exp)).toMatchObject({
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      secure: true,
    });
  });

  it('blocks mismatched Origin, cross-site Sec-Fetch-Site, and cookie-auth requests missing Origin/Referer', () => {
    const badReq = {
      method: 'POST',
      headers: new Headers({
        host: 'localhost:3000',
        origin: 'https://evil.example.com',
      }),
    } as unknown as NextRequest;

    expect(() => assertCsrfSafe(badReq)).toThrow();

    const crossSiteFetch = {
      method: 'POST',
      headers: new Headers({
        host: 'localhost:3000',
        'sec-fetch-site': 'cross-site',
        cookie: 'aqar_session=abc',
      }),
    } as unknown as NextRequest;

    expect(() => assertCsrfSafe(crossSiteFetch)).toThrow();

    const missingOriginWithCookie = {
      method: 'POST',
      headers: new Headers({
        host: 'localhost:3000',
        cookie: 'aqar_session=abc',
      }),
    } as unknown as NextRequest;

    expect(() => assertCsrfSafe(missingOriginWithCookie)).toThrow();

    const sameOriginFetchNoOrigin = {
      method: 'POST',
      headers: new Headers({
        host: 'localhost:3000',
        'sec-fetch-site': 'same-origin',
        cookie: 'aqar_session=abc',
      }),
    } as unknown as NextRequest;

    expect(() => assertCsrfSafe(sameOriginFetchNoOrigin)).not.toThrow();

    const goodReq = {
      method: 'POST',
      headers: new Headers({
        host: 'localhost:3000',
        origin: 'http://localhost:3000',
        cookie: 'aqar_session=abc',
      }),
    } as unknown as NextRequest;

    expect(() => assertCsrfSafe(goodReq)).not.toThrow();
  });
});
