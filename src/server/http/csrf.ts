import type { NextRequest } from 'next/server';
import { AuthError } from '@/server/auth/guards';

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Verifies Origin / Referer on state-mutating requests as defense-in-depth
 * alongside SameSite=Lax session cookies.
 */
export function assertCsrfSafe(request: NextRequest): void {
  if (!MUTATING_METHODS.has(request.method.toUpperCase())) {
    return;
  }

  const origin = request.headers.get('origin');
  const referer = request.headers.get('referer');
  const host = request.headers.get('host');

  // Allow non-browser / integration test requests where neither Origin nor Referer is sent
  // ONLY if explicitly absent? Wait: browsers ALWAYS send Origin on POST/PATCH/DELETE.
  // If an Origin header IS present, it MUST match the host.
  if (origin) {
    try {
      const originUrl = new URL(origin);
      if (host && originUrl.host !== host) {
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
      if (host && refererUrl.host !== host) {
        throw new AuthError('طلب غير مصرح به (CSRF)', 403);
      }
    } catch (err) {
      if (err instanceof AuthError) throw err;
      throw new AuthError('طلب غير مصرح به (CSRF)', 403);
    }
  }
}
