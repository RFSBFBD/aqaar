# BUGS_AND_FIXES.md

Tracks discovered bugs, configuration defects, root causes, fixes, and regression verification.

---

## BUG-001: Prisma 7 `schema.prisma` datasource `url` validation error (P1012)
- **Discovered:** 2026-11-11 during recovery verification (`npx prisma validate`)
- **Root Cause:** Project installed `prisma@7.10.1` and `@prisma/client@7.10.1`, where Prisma 7 removed `url = env("DATABASE_URL")` from `schema.prisma` and requires `prisma.config.ts` + a driver adapter (`@prisma/adapter-pg` + `pg`) for `PrismaClient`.
- **Fix:** Created `prisma.config.ts`, installed `@prisma/adapter-pg@7.10.1`, `pg@8.23.1`, `dotenv@18.0.10`, removed `url` from `prisma/schema.prisma`, updated `src/lib/prisma.ts` to use `PrismaPg` lazily.
- **Status:** FIXED & VERIFIED (`npx prisma validate` and `npx prisma generate` exit 0).

## BUG-002: `npm run lint` fails under Next.js 16
- **Discovered:** 2026-11-11 during recovery verification (`npm run lint`)
- **Root Cause:** `package.json` uses `"lint": "next lint"`, which in Next.js 16 is no longer a subcommand (`Invalid project directory provided: D:\Aqar Elite\lint`). Also no `eslint.config.mjs` exists.
- **Fix:** Created `eslint.config.mjs` with `eslint-config-next/core-web-vitals` + `eslint-config-next/typescript` and updated `package.json` script to `"lint": "eslint ."`.
- **Status:** FIXED & VERIFIED (`npm run lint` exits 0).

## BUG-003: TypeScript compilation fails on `@prisma/client` imports
- **Discovered:** 2026-11-11 during recovery verification (`npm run typecheck`)
- **Root Cause:** `prisma generate` had not been executed yet because `schema.prisma` failed validation (BUG-001).
- **Fix:** Fixed BUG-001 and ran `npx prisma generate`.
- **Status:** FIXED & VERIFIED (`npm run typecheck` exits 0).

## BUG-004: `src/domain/state-machines.ts` `deriveInstallmentStatus` compares exact timestamp vs UTC date
- **Discovered:** 2026-11-11 during code inspection of `src/domain/state-machines.ts` vs `src/domain/dates.ts`
- **Root Cause:** `isInstallmentOverdue` in `dates.ts` compares UTC date-only (so on the due date itself, e.g., 2026-02-28T12:00:00Z when dueDate is 2026-02-28T00:00:00Z, it is NOT overdue until the day passes), whereas `deriveInstallmentStatus` in `state-machines.ts` uses `now > dueDate` (timestamp comparison, which marks an installment overdue at 00:00:01Z on its due date!).
- **Fix:** Updated `deriveInstallmentStatus` to delegate overdue check to `isInstallmentOverdue(dueDate, amount, paidAmount, now)`.
- **Regression Test:** `tests/unit/state-machines.test.ts` (`returns PENDING before due date with 0 paid`, `returns PARTIAL before/on due date with partial payment`, `returns OVERDUE after due date`).
- **Status:** FIXED & VERIFIED (37/37 unit tests passing).

## BUG-005: `src/server/auth/session.ts` vs `docs/REQUIREMENTS_TRACEABILITY.md` path/package mismatch
- **Discovered:** 2026-11-11 during recovery inspection
- **Root Cause:** Interrupted Phase 0 subagent referenced `src/lib/auth/*` and Argon2id, whereas actual code was written to `src/server/auth/*` using `bcryptjs`.
- **Status:** Open (will align documentation in Phase 0 completion).
