# SPRINT-02 — Phase 2: Tenant Isolation, Units, Clients & Reservations

**Date:** 2026-11-11  
**Gate Status:** PARTIAL / BLOCKED ON LIVE POSTGRESQL (Code, validation unit tests, typecheck, lint, build = PASS; real PostgreSQL concurrency/isolation integration suite = BLOCKED pending Docker/Postgres)

## Scope
- Sprint 2.1: Mandatory `TenantContext` on all repositories/services, uniform 404 on cross-tenant IDs, strict Zod DTOs.
- Sprint 2.2: Units CRUD (ADMIN only), server-side filtering (`status`, `minPrice`, `maxPrice`), pagination, allowlisted sorting (`price`, `area`), price edit lock on `RESERVED`/`SOLD` with `FOR UPDATE` serialization, `AuditLog` on price changes.
- Sprint 2.3: Clients CRUD (SALES creates/edits own clients only; ADMIN/ACCOUNTANT read-only).
- Sprint 2.4: 72-hour Reservations with atomic conditional `UPDATE`, DB partial unique index safety net, lazy expiration + idempotent `expireOverdueReservations()` job.

## Tests Executed
- `npm test`: **6 files, 47/47 tests passed**.
- `npm run typecheck`: PASS.
- `npm run lint`: PASS.
- `npm run build`: verified via `task-319`.
- `tests/integration/phase2-tenancy-units-clients-reservations.integration.test.ts`: written, **BLOCKED** (no running PostgreSQL).
