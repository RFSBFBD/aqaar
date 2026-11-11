import type { NextRequest } from 'next/server';

/**
 * Resolves the client IP address for rate limiting.
 * Forwarded headers (X-Forwarded-For, X-Real-IP) are ONLY trusted when
 * TRUST_PROXY=true is explicitly configured; otherwise untrusted client headers
 * are ignored to prevent IP-spoofing rate-limit bypasses.
 */
export function getClientIp(request: NextRequest): string {
  const trustProxy = process.env.TRUST_PROXY === 'true';

  if (trustProxy) {
    const forwarded = request.headers.get('x-forwarded-for');
    if (forwarded) {
      const first = forwarded.split(',')[0]?.trim();
      if (first) return first;
    }
    const realIp = request.headers.get('x-real-ip')?.trim();
    if (realIp) return realIp;
  }

  const runtimeIp = (request as NextRequest & { ip?: string }).ip;
  return runtimeIp || 'direct-client';
}
