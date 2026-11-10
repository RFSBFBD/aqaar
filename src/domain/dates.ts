/**
 * Date utilities for installment due date generation.
 * 
 * Policy: Monthly anniversary with end-of-month clamping.
 * The base day is preserved across months.
 * 
 * Examples (base day = 31):
 * - Jan 31 → Feb 28 (or 29 in leap year) → Mar 31 → Apr 30 → May 31
 * 
 * All dates are calculated in UTC.
 */

/**
 * Checks if a year is a leap year.
 */
export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
}

/**
 * Returns the number of days in a given month (1-indexed).
 */
export function daysInMonth(year: number, month: number): number {
  // month is 1-indexed: 1=Jan, 2=Feb, etc.
  const days = [0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (month === 2 && isLeapYear(year)) {
    return 29;
  }
  return days[month]!;
}

/**
 * Generates monthly due dates with end-of-month clamping.
 * 
 * @param startDate - The contract start date (determines base day)
 * @param count - Number of installments
 * @returns Array of due dates (Date objects, UTC)
 */
export function generateDueDates(startDate: Date, count: number): Date[] {
  if (count <= 0) {
    throw new Error('عدد الأقساط يجب أن يكون أكبر من صفر');
  }

  // Extract the base day from the start date (the "original" day to preserve)
  const baseDay = startDate.getUTCDate();
  let currentYear = startDate.getUTCFullYear();
  let currentMonth = startDate.getUTCMonth() + 1; // 1-indexed

  const dates: Date[] = [];

  for (let i = 0; i < count; i++) {
    // Advance one month
    currentMonth += 1;
    if (currentMonth > 12) {
      currentMonth = 1;
      currentYear += 1;
    }

    // Clamp the day to the last day of the target month
    const maxDay = daysInMonth(currentYear, currentMonth);
    const day = Math.min(baseDay, maxDay);

    dates.push(new Date(Date.UTC(currentYear, currentMonth - 1, day)));
  }

  return dates;
}

/**
 * Determines if an installment is overdue based on due date and unpaid balance.
 * An installment is overdue if:
 * - Its due date has passed (is before the current date)
 * - It has unpaid balance (paidAmount < amount)
 * 
 * A fully paid installment is NEVER overdue.
 */
export function isInstallmentOverdue(
  dueDate: Date,
  amount: bigint,
  paidAmount: bigint,
  now: Date = new Date()
): boolean {
  if (paidAmount >= amount) {
    return false; // Fully paid, never overdue
  }
  // Compare dates only (not time)
  const dueDateOnly = new Date(Date.UTC(
    dueDate.getUTCFullYear(),
    dueDate.getUTCMonth(),
    dueDate.getUTCDate()
  ));
  const nowDateOnly = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate()
  ));
  return nowDateOnly > dueDateOnly;
}
