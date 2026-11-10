/**
 * State machine definitions for domain entities.
 * These enforce valid state transitions and prevent invalid ones.
 */

// ─── UNIT STATUS ──────────────────────────────────────────
export type UnitStatusType = 'AVAILABLE' | 'RESERVED' | 'SOLD';

const VALID_UNIT_TRANSITIONS: Record<UnitStatusType, UnitStatusType[]> = {
  AVAILABLE: ['RESERVED'],
  RESERVED: ['AVAILABLE', 'SOLD'],
  SOLD: [], // Terminal state
};

export function canTransitionUnit(from: UnitStatusType, to: UnitStatusType): boolean {
  return VALID_UNIT_TRANSITIONS[from]?.includes(to) ?? false;
}

export function assertUnitTransition(from: UnitStatusType, to: UnitStatusType): void {
  if (!canTransitionUnit(from, to)) {
    throw new Error(`انتقال غير صالح للوحدة: ${from} → ${to}`);
  }
}

// ─── RESERVATION STATUS ───────────────────────────────────
export type ReservationStatusType = 'ACTIVE' | 'EXPIRED' | 'CONVERTED';

const VALID_RESERVATION_TRANSITIONS: Record<ReservationStatusType, ReservationStatusType[]> = {
  ACTIVE: ['EXPIRED', 'CONVERTED'],
  EXPIRED: [], // Terminal state
  CONVERTED: [], // Terminal state
};

export function canTransitionReservation(from: ReservationStatusType, to: ReservationStatusType): boolean {
  return VALID_RESERVATION_TRANSITIONS[from]?.includes(to) ?? false;
}

export function assertReservationTransition(from: ReservationStatusType, to: ReservationStatusType): void {
  if (!canTransitionReservation(from, to)) {
    throw new Error(`انتقال غير صالح للحجز: ${from} → ${to}`);
  }
}

// ─── CONTRACT STATUS ──────────────────────────────────────
export type ContractStatusType = 'DRAFT' | 'APPROVED';

const VALID_CONTRACT_TRANSITIONS: Record<ContractStatusType, ContractStatusType[]> = {
  DRAFT: ['APPROVED'],
  APPROVED: [], // Terminal state — immutable
};

export function canTransitionContract(from: ContractStatusType, to: ContractStatusType): boolean {
  return VALID_CONTRACT_TRANSITIONS[from]?.includes(to) ?? false;
}

export function assertContractTransition(from: ContractStatusType, to: ContractStatusType): void {
  if (!canTransitionContract(from, to)) {
    throw new Error(`انتقال غير صالح للعقد: ${from} → ${to}`);
  }
}

// ─── INSTALLMENT STATUS ───────────────────────────────────
export type InstallmentStatusType = 'PENDING' | 'PARTIAL' | 'PAID' | 'OVERDUE';

import { isInstallmentOverdue } from './dates';

/**
 * Determines the correct status for an installment based on its financial state and due date.
 * PAID overrides OVERDUE — a fully paid installment is never overdue.
 * Uses UTC date-only comparison via isInstallmentOverdue so an installment is not marked
 * overdue before its due date calendar day has elapsed.
 */
export function deriveInstallmentStatus(
  amount: bigint,
  paidAmount: bigint,
  dueDate: Date,
  now: Date = new Date()
): InstallmentStatusType {
  if (paidAmount >= amount) return 'PAID';
  if (isInstallmentOverdue(dueDate, amount, paidAmount, now)) {
    return 'OVERDUE';
  }
  return paidAmount > 0n ? 'PARTIAL' : 'PENDING';
}
