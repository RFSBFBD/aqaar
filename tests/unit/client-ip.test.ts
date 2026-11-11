import { describe, it, expect, vi, afterEach } from 'vitest';
import type { NextRequest } from 'next/server';
import { getClientIp } from '@/server/http/client-ip';

function mockReq(headers: Record<string, string>): NextRequest {
  return {
    headers: new Headers(headers),
  } as unknown as NextRequest;
}

describe('Client IP Extraction & TRUST_PROXY Hardening', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('ignores spoofed X-Forwarded-For and X-Real-IP headers when TRUST_PROXY is disabled (default)', () => {
    vi.stubEnv('TRUST_PROXY', 'false');
    const req1 = mockReq({ 'x-forwarded-for': '203.0.113.10', 'x-real-ip': '198.51.100.20' });
    const req2 = mockReq({ 'x-forwarded-for': '203.0.113.99' });

    expect(getClientIp(req1)).toBe('direct-client');
    expect(getClientIp(req2)).toBe('direct-client');
  });

  it('honors X-Forwarded-For and X-Real-IP only when TRUST_PROXY=true', () => {
    vi.stubEnv('TRUST_PROXY', 'true');
    const reqXff = mockReq({ 'x-forwarded-for': '203.0.113.10, 10.0.0.1' });
    const reqReal = mockReq({ 'x-real-ip': '198.51.100.20' });

    expect(getClientIp(reqXff)).toBe('203.0.113.10');
    expect(getClientIp(reqReal)).toBe('198.51.100.20');
  });
});
