import type { NextRequest } from 'next/server';
import { AuthError, SESSION_COOKIE_NAME } from '@/server/auth/guards';

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function hasSessionCookie(request: NextRequest): boolean {
  const fromCookies = request.cookies?.get?.(SESSION_COOKIE_NAME)?.value;
  if (fromCookies) return true;
  const rawCookie = request.headers.get('cookie') ?? '';
  return rawCookie.split(';').some((part) => part.trim().startsWith(`${SESSION_COOKIE_NAME}=`));
}

/**
 * Verifies Origin / Referer / Sec-Fetch-Site on state-mutating requests as
 * defense-in-depth alongside SameSite=Lax session cookies.
 * Cookie-authenticated requests with missing Origin and Referer (and without
 * Sec-Fetch-Site: same-origin) are rejected with 403.
 */
export function assertCsrfSafe(request: NextRequest): void {
  if (!MUTATING_METHODS.has(request.method.toUpperCase())) {
    return;
  }

  const secFetchSite = request.headers.get('sec-fetch-site')?.toLowerCase();
  if (secFetchSite && secFetchSite !== 'same-origin') {
    throw new AuthError('طلب غير مصرح به (CSRF)', 403);
  }

  const origin = request.headers.get('origin');
  const referer = request.headers.get('referer');
  const host = request.headers.get('host');

  if (origin) {
    try {
      const originUrl = new URL(origin);
      if (!host || originUrl.host !== host) {
        throw new AuthError('طلب غير مصرح به (CSRF)', 403);
      }
    } catch (err) {
      if (err instanceof AuthError) throw err;
      throw new AuthError('طلب غير مصرح به (CSRF)', 403);
    }
    return;
  }

  if (referer) {
    try {
      const refererUrl = new URL(referer);
      if (!host || refererUrl.host !== host) {
        throw new AuthError('طلب غير مصرح به (CSRF)', 403);
      }
    } catch (err) {
      if (err instanceof AuthError) throw err;
      throw new AuthError('طلب غير مصرح به (CSRF)', 403);
    }
    return;
  }

  if (secFetchSite === 'same-origin') {
    return;
  }

  if (hasSessionCookie(request)) {
    throw new AuthError('طلب غير مصرح به: ترويسة المصدر مطلوبة (CSRF)', 403);
  }
}
