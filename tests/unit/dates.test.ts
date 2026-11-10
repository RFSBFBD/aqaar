import { describe, it, expect } from 'vitest';
import {
  isLeapYear,
  daysInMonth,
  generateDueDates,
  isInstallmentOverdue,
} from '@/domain/dates';

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

describe('Date Policy (Jan 31 Clamping & UTC Overdue)', () => {
  it('identifies leap years correctly', () => {
    expect(isLeapYear(2024)).toBe(true);
    expect(isLeapYear(2025)).toBe(false);
    expect(isLeapYear(2028)).toBe(true);
    expect(isLeapYear(2100)).toBe(false);
    expect(isLeapYear(2000)).toBe(true);
  });

  it('returns exact days in month', () => {
    expect(daysInMonth(2024, 2)).toBe(29);
    expect(daysInMonth(2025, 2)).toBe(28);
    expect(daysInMonth(2025, 4)).toBe(30);
    expect(daysInMonth(2025, 1)).toBe(31);
  });

  it('preserves base day 31 across Feb (non-leap), Mar, Apr, May', () => {
    const start = new Date(Date.UTC(2025, 0, 31)); // 2025-01-31
    const dueDates = generateDueDates(start, 5).map(isoDate);
    expect(dueDates).toEqual([
      '2025-02-28',
      '2025-03-31',
      '2025-04-30',
      '2025-05-31',
      '2025-06-30',
    ]);
  });

  it('preserves base day 31 across leap year Feb 29', () => {
    const start = new Date(Date.UTC(2024, 0, 31)); // 2024-01-31
    const dueDates = generateDueDates(start, 3).map(isoDate);
    expect(dueDates).toEqual([
      '2024-02-29',
      '2024-03-31',
      '2024-04-30',
    ]);
  });

  it('handles base day 29 and 30 in February and year rollover from Dec 31', () => {
    const start29 = new Date(Date.UTC(2025, 0, 29));
    expect(generateDueDates(start29, 2).map(isoDate)).toEqual([
      '2025-02-28',
      '2025-03-29',
    ]);

    const startDec = new Date(Date.UTC(2025, 11, 31)); // 2025-12-31
    expect(generateDueDates(startDec, 3).map(isoDate)).toEqual([
      '2026-01-31',
      '2026-02-28',
      '2026-03-31',
    ]);
  });

  it('evaluates overdue at UTC calendar date granularity and never marks PAID overdue', () => {
    const due = new Date(Date.UTC(2026, 2, 15)); // 2026-03-15
    // Same day even late at night -> NOT overdue
    expect(isInstallmentOverdue(due, 10_000n, 0n, new Date(Date.UTC(2026, 2, 15, 23, 59, 59)))).toBe(false);
    // Next day -> overdue if unpaid
    expect(isInstallmentOverdue(due, 10_000n, 0n, new Date(Date.UTC(2026, 2, 16, 0, 0, 0)))).toBe(true);
    // Next day -> overdue if only partial
    expect(isInstallmentOverdue(due, 10_000n, 5_000n, new Date(Date.UTC(2026, 2, 16, 0, 0, 0)))).toBe(true);
    // Next day -> NEVER overdue if paid
    expect(isInstallmentOverdue(due, 10_000n, 10_000n, new Date(Date.UTC(2026, 2, 16, 0, 0, 0)))).toBe(false);
  });
});
