# SPRINT-00 — Phase 0: Discovery, Domain Logic & Test-First Proof

**Date:** 2026-11-11  
**Gate Status:** PASS

## Scope
Complete Phase 0 requirements:
- Sprint 0.1: Requirements Traceability, Assumptions, Architecture Decisions, Threat Model, Domain Rules, Test Strategy.
- Sprint 0.2: Domain entities and state machines (Unit, Reservation, Contract, Installment, Payment).
- Sprint 0.3: Financial rules (BigInt minor units, 5% discount cap, deterministic remainder distribution, FIFO allocation) and Jan 31 UTC date clamping policy.
- Sprint 0.4: Concurrency, locking, and multi-tenant isolation design.
- Sprint 0.5: Test-first pure domain proof (`tests/unit/*.test.ts`).

## Files Created / Modified
- `docs/REQUIREMENTS_TRACEABILITY.md` (verified)
- `docs/ASSUMPTIONS.md` (verified)
- `docs/ARCHITECTURE_DECISIONS.md` (verified)
- `docs/THREAT_MODEL.md` (verified)
- `docs/DOMAIN_RULES.md` (created)
- `docs/TEST_STRATEGY.md` (created)
- `src/domain/financial.ts` (added unitPrice > 0 & overpayment invariant guards)
- `src/domain/state-machines.ts` (fixed BUG-004: UTC date-only overdue comparison)
- `vitest.config.mts` (created)
- `tests/unit/financial.test.ts` (created, 20 tests)
- `tests/unit/dates.test.ts` (created, 6 tests)
- `tests/unit/state-machines.test.ts` (created, 8 tests)
- `tests/unit/domain-proof.test.ts` (created, 3 tests)

## Decisions & Assumptions
- REC-001: Recovered interrupted Phase 0 before proceeding with Phase 1 repairs.
- REC-002: Standardized password hashing on `bcryptjs` (cost factor 12) as allowed by Master Orchestrator.
- UTC date-only comparison used consistently across `isInstallmentOverdue` and `deriveInstallmentStatus`.

## Tests Executed
- `npm test` (`vitest run`): **4 test files passed, 37/37 tests passed**.

## Independent QA Findings
- Discovered BUG-004 (`deriveInstallmentStatus` used timestamp `now > dueDate` instead of UTC date-only comparison). Fixed and covered by `tests/unit/state-machines.test.ts`.
- Discovered `allocatePayment` did not throw if caller passed amount exceeding total unpaid installments; added explicit post-loop invariant check.
- Confirmed zero float usage in domain financial modules; all monetary amounts are `BigInt`.

## Remaining Risks
- PostgreSQL integration & concurrency behavior (e.g., `FOR UPDATE` locking, partial unique index, Prisma 7 adapter) will be proven on real PostgreSQL in Phases 1–3.
