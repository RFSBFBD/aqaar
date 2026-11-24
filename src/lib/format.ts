/**
 * Pure string/BigInt formatting and parsing helpers for minor currency units (100 minor = 1.00 major).
 * Never uses IEEE 754 float arithmetic.
 */

const MINOR_FACTOR = 100n;

/**
 * Formats a minor-unit integer string (e.g., "85000000") into "850,000.00".
 */
export function formatMinorUnits(minorStr: string | bigint): string {
  const val = typeof minorStr === 'bigint' ? minorStr : BigInt(minorStr);
  const negative = val < 0n;
  const abs = negative ? -val : val;
  const major = abs / MINOR_FACTOR;
  const minor = abs % MINOR_FACTOR;

  const majorFormatted = major.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const minorFormatted = minor.toString().padStart(2, '0');
  return `${negative ? '-' : ''}${majorFormatted}.${minorFormatted}`;
}

/**
 * Parses a decimal major-unit input string (e.g., "850000" or "850000.50")
 * directly into a minor-unit integer string ("85000000" / "85000050") without floats.
 * Throws if invalid or has more than 2 decimal places.
 */
export function majorInputToMinorString(input: string): string {
  const trimmed = input.trim().replace(/,/g, '');
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(trimmed);
  if (!match) {
    throw new Error('صيغة المبلغ غير صالحة (مثال صحيح: 150000 أو 150000.50)');
  }
  const whole = match[1]!;
  const frac = (match[2] ?? '').padEnd(2, '0');
  const minor = BigInt(whole) * MINOR_FACTOR + BigInt(frac);
  return minor.toString();
}

/**
 * Converts a minor-unit integer string to an unformatted decimal string for input fields.
 */
export function minorStringToMajorInput(minorStr: string | bigint): string {
  const val = typeof minorStr === 'bigint' ? minorStr : BigInt(minorStr);
  const major = val / MINOR_FACTOR;
  const minor = val % MINOR_FACTOR;
  if (minor === 0n) return major.toString();
  return `${major.toString()}.${minor.toString().padStart(2, '0')}`;
}

export function formatUtcDate(isoOrDate: string): string {
  const d = new Date(isoOrDate);
  if (Number.isNaN(d.getTime())) return isoOrDate;
  return d.toISOString().slice(0, 10);
}

export function formatUtcDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.toISOString().slice(0, 10)} ${d.toISOString().slice(11, 16)} UTC`;
}

export const CURRENCY_LABEL = 'ر.س';

/**
 * Formats a minor-unit integer string into "850,000.00 ر.س".
 */
export function formatCurrency(minorStr: string | bigint): string {
  return `${formatMinorUnits(minorStr)} ${CURRENCY_LABEL}`;
}

/**
 * Formats an ISO timestamp in Saudi Arabia local time (Asia/Riyadh, UTC+3).
 * Output example: "2026-11-24 17:55:00 (توقيت السعودية)"
 */
export function formatSaudiDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;

  // Saudi Arabia is UTC+3 throughout the year
  const riyadhOffsetMs = 3 * 60 * 60 * 1000;
  const ksaDate = new Date(d.getTime() + riyadhOffsetMs);
  const year = ksaDate.getUTCFullYear();
  const month = String(ksaDate.getUTCMonth() + 1).padStart(2, '0');
  const day = String(ksaDate.getUTCDate()).padStart(2, '0');
  const hours = String(ksaDate.getUTCHours()).padStart(2, '0');
  const minutes = String(ksaDate.getUTCMinutes()).padStart(2, '0');
  const seconds = String(ksaDate.getUTCSeconds()).padStart(2, '0');

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds} (توقيت السعودية)`;
}
