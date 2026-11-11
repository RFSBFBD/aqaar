# SPRINT-04 — Phase 4: Arabic RTL Frontend & Human-Centered UX

**Date:** 2026-11-11  
**Gate Status:** PARTIAL / BLOCKED ON LIVE BROWSER + POSTGRESQL (UI build, lint, typecheck, formatting unit tests = PASS; interactive browser screenshots/E2E across 360px–1440px = BLOCKED pending Docker/PostgreSQL)

## Scope
- Sprint 4.1: `docs/UI_DIRECTION.md` (Architectural Limestone & Ledger palette, no default purple/template).
- Sprint 4.2: `AppShell` (RTL right sidebar + mobile drawer, header role/company context, logout), `StatusBadge`, `src/lib/format.ts` (float-free BigInt string display & input parsing).
- Sprint 4.3 & 4.4: All required screens connected to real APIs: `/login`, `/units` (filters, sort, pagination, ADMIN add/edit, SALES 72h reserve), `/clients` & `/clients/[id]` (notes plain-text safe, SALES only edit), `/reservations` (72h expiry + SALES draft contract), `/contracts` & `/contracts/[id]` (ACCOUNTANT approve confirmation, installment schedule, ACCOUNTANT payment form with client-side idempotency key & FIFO allocation feedback), `/audit-logs` (ADMIN read-only).

## Tests Executed
- `npm test`: **8 files, 51/51 tests passed**.
- `npm run typecheck` / `npm run lint` / `npm run build`: verified via `task-387`.
- Live browser visual/responsive QA: **BLOCKED** (requires running DB & server).
