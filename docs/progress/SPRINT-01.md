# SPRINT-01 — Phase 1: Project Foundation, PostgreSQL Schema & Authentication

**Date:** 2026-11-11  
**Gate Status:** PARTIAL / BLOCKED ON LIVE POSTGRESQL (Code, migrations, seed, unit tests, typecheck, lint, build = PASS; live DB migration/seed/integration execution = BLOCKED because Docker Desktop daemon is not running)

## Scope
- Sprint 1.1: Prisma 7 config (`prisma.config.ts`, `@prisma/adapter-pg`), ESLint flat config (`eslint.config.mjs`), Next.js 16 security headers, App Router skeleton & `/api/health`.
- Sprint 1.2: Updated `prisma/schema.prisma` (global email uniqueness, explicit `Contract.approvedBy` and `Payment.recordedBy` FKs), generated real migration `prisma/migrations/20261111000000_init/migration.sql` with PostgreSQL `CHECK` constraints, partial unique index `reservations_one_active_per_unit`, and append-only/immutability triggers.
- Sprint 1.3: Idempotent `prisma/seed.ts` (2 companies, 8 users across ADMIN/ACCOUNTANT/SALES, 5 units, 4 clients).
- Sprint 1.4 & 1.5: Authentication (`/api/auth/login`, `/api/auth/logout`, `/api/auth/me`), hashed DB sessions, rate limiting, CSRF origin validation, `getCurrentSession`, `requireAuthenticatedUser`, `requireRole`, `getTenantContext`, `AuditLog` service.

## Files Created / Modified
- `prisma.config.ts`, `prisma/schema.prisma`, `prisma/migrations/migration_lock.toml`, `prisma/migrations/20261111000000_init/migration.sql`, `prisma/seed.ts`
- `src/lib/prisma.ts`, `next.config.ts`, `eslint.config.mjs`, `postcss.config.mjs`, `package.json`, `tsconfig.json`
- `src/server/auth/crypto.ts`, `src/server/auth/cookies.ts`, `src/server/auth/session.ts`, `src/server/auth/service.ts`
- `src/server/http/csrf.ts`, `src/server/http/errors.ts`, `src/server/validation/auth.ts`, `src/server/services/audit.service.ts`
- `src/app/layout.tsx`, `src/app/globals.css`, `src/app/page.tsx`, `src/app/api/health/route.ts`, `src/app/api/auth/{login,logout,me}/route.ts`
- `docker-compose.yml`, `vitest.integration.config.mts`
- `tests/unit/auth-primitives.test.ts`, `tests/integration/phase1-auth.integration.test.ts`

## Tests Executed
- `npx prisma validate` → PASS
- `npx prisma generate` → PASS
- `npm test` → **5 test files, 42/42 tests passed**
- `npm run typecheck` → PASS (0 errors)
- `npm run lint` → PASS (0 errors, 0 warnings)
- `npm run build` → PASS (verified prior to extracting `crypto.ts`; re-verified after)
- `npm run test:integration` / `prisma migrate deploy` / `db:seed` → **BLOCKED** (Docker daemon not running / no PostgreSQL on localhost:5432)

## QA Review Notes
- Verified no signup or user-management routes exist.
- Verified `loginSchema` uses `.strict()` so forged `role` or `companyId` in request body is rejected with 400.
- Verified `loginWithCredentials` uses a dummy bcrypt verification when user email is absent and returns identical 401 message.
- Verified `Session` stores SHA-256 `tokenHash`, never raw token.
- Verified PostgreSQL migration includes DB-level CHECK constraints and triggers for payment append-only and approved contract immutability.
