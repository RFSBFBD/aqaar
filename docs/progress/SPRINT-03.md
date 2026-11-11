# SPRINT-03 — Phase 3: Contracts, Installments & Payments

**Date:** 2026-11-11  
**Gate Status:** PARTIAL / BLOCKED ON LIVE POSTGRESQL (Code, unit/validation tests, typecheck, lint, build = PASS; real PostgreSQL transaction/concurrency/immutability integration suite = BLOCKED pending Docker/Postgres)

## Scope
- Sprint 3.1: Financial domain proofs & strict Zod contract/payment schemas.
- Sprint 3.2: Draft Contract creation (SALES, active reservation ownership, 5% discount cap, down payment bounds).
- Sprint 3.3 & 3.4: Atomic Contract Approval (ACCOUNTANT only, row locks, installment schedule with deterministic remainder & Jan 31 UTC clamping, `Unit -> SOLD`, `Reservation -> CONVERTED`, `AuditLog`). Immutability enforced in service & PostgreSQL trigger.
- Sprint 3.5: Append-only Payments & FIFO Allocation (ACCOUNTANT only, contract row lock, idempotency key replay handling, overpayment rejection, derived `OVERDUE` status).

## Tests Executed
- `npm test`: **7 files, 49/49 tests passed**.
- `npm run typecheck`: PASS.
- `npm run lint`: PASS.
- `npm run build`: verified in `task-346`.
- `tests/integration/phase3-contracts-payments.integration.test.ts`: written, **BLOCKED** (no running PostgreSQL).
