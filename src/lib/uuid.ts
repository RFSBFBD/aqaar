/**
 * Generates a UUID v4 idempotency key that works in all browser contexts,
 * including plain non-localhost HTTP LAN IP addresses where crypto.randomUUID
 * is restricted to Secure Contexts.
 */
export function generateIdempotencyKey(): string {
  const cryptoObj = globalThis.crypto;

  if (typeof cryptoObj?.randomUUID === 'function') {
    return cryptoObj.randomUUID();
  }

  if (typeof cryptoObj?.getRandomValues === 'function') {
    const bytes = new Uint8Array(16);
    cryptoObj.getRandomValues(bytes);
    // Set RFC 4122 version 4 and variant 10xx bits
    bytes[6] = (bytes[6]! & 0x0f) | 0x40;
    bytes[8] = (bytes[8]! & 0x3f) | 0x80;

    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }

  throw new Error('Secure random generator is unavailable in this environment');
}
