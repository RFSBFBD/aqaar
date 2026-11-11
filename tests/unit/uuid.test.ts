import { describe, it, expect, vi, afterEach } from 'vitest';
import { generateIdempotencyKey } from '@/lib/uuid';

const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('UUID Idempotency Key Generator (HTTPS, localhost, and LAN HTTP IP)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('generates valid UUID v4 when crypto.randomUUID is available (HTTPS / localhost)', () => {
    const k1 = generateIdempotencyKey();
    const k2 = generateIdempotencyKey();
    expect(k1).toMatch(UUID_V4_REGEX);
    expect(k2).toMatch(UUID_V4_REGEX);
    expect(k1).not.toBe(k2);
  });

  it('falls back to crypto.getRandomValues when crypto.randomUUID is undefined (non-HTTPS LAN HTTP IP)', () => {
    const realGetRandomValues = globalThis.crypto.getRandomValues.bind(globalThis.crypto);
    vi.stubGlobal('crypto', {
      randomUUID: undefined,
      getRandomValues: realGetRandomValues,
    });

    const k1 = generateIdempotencyKey();
    const k2 = generateIdempotencyKey();
    expect(k1).toMatch(UUID_V4_REGEX);
    expect(k2).toMatch(UUID_V4_REGEX);
    expect(k1).not.toBe(k2);
  });
});
