# TEST_REPORT.md

All test executions and verification checks are recorded here with exact commands and observed outputs.

---

## Recovery Baseline Check — 2026-11-11

| Check / Test | Type | Command | Expected | Actual | Status | Fix / Next Step |
|--------------|------|---------|----------|--------|--------|-----------------|
| `.env` git ignore | Security | `git check-ignore -v .env` | Excluded | `.gitignore:27:.env` | PASS | — |
| Package tree | Integrity | `npm ls --depth=0` | Exit 0 | Exit 0 (all packages installed) | PASS | — |
| Prisma schema validate | Schema | `npx prisma validate` | Valid schema | Error P1012 (`url` in `schema.prisma` unsupported in Prisma 7) | FAIL | Add `prisma.config.ts` & `@prisma/adapter-pg` |
| TypeScript check | Static | `npm run typecheck` | 0 errors | TS2305 in `src/lib/prisma.ts`, `src/server/auth/session.ts` (`@prisma/client` not generated) | FAIL | Fix Prisma 7 config & run `prisma generate` |
| ESLint | Lint | `npm run lint` | 0 errors | Failed (`next lint` invalid in Next.js 16) | FAIL | Configure `eslint.config.mjs` and update script to `eslint .` |
| Vitest unit suite | Unit | `npm test` | All pass | Exited 1: No test files found | FAIL | Create Sprint 0.5 domain tests |

## Phase 0 & Phase 1 Verification — 2026-11-11

| Check / Test | Type | Command | Expected | Actual | Status |
|--------------|------|---------|----------|--------|--------|
| Phase 0 + 1 Unit Tests | Unit | `npm test` | All pass | 5 files, 42/42 passed | PASS |
| Prisma Schema Validate | Schema | `npx prisma validate` | Valid | Valid (`prisma.config.ts`) | PASS |
| Prisma Generate | Codegen | `npx prisma generate` | Client generated | Generated v7.10.1 | PASS |
| TypeScript Strict | Static | `npm run typecheck` | 0 errors | Exit 0 (0 errors) | PASS |
| ESLint | Lint | `npm run lint` | 0 errors | Exit 0 (0 errors, 0 warnings) | PASS |
| Production Build | Build | `npm run build` | Compiled | Exit 0 | PASS |
| Live DB Migrate / Seed / Integration | Integration | `npm run test:integration` | Pass on Postgres | Not run — Docker daemon not running / no Postgres on 5432 | BLOCKED |

## Final Verification Run — 2026-11-11

| Check / Test | Type | Command | Expected | Actual | Status |
|--------------|------|---------|----------|--------|--------|
| Prisma Validate | Schema | `npx prisma validate` | Valid | Valid | PASS |
| ESLint | Lint | `npm run lint` | 0 errors | 0 errors, 0 warnings | PASS |
| TypeScript Strict | Static | `npm run typecheck` | 0 errors | 0 errors | PASS |
| Unit Tests | Unit | `npm test` | All pass | 8 files, 51/51 passed | PASS |
| Production Build | Build | `npm run build` | Compiled | Exit 0 | PASS |
| Dependency Audit | Security | `npm audit --audit-level=high` | 0 High/Critical | Exit 0 (0 High/Critical) | PASS |
| Forbidden Pattern Scan | Security/Quality | `Select-String` (`any`, `@ts-ignore`, `dangerouslySetInnerHTML`, `localStorage`) | 0 matches | 0 matches | PASS |
| Integration Suite | Integration | `npm run test:integration` | Pass on Postgres | Docker Desktop not running | BLOCKED |
| Playwright E2E | E2E | `npm run test:e2e` | Pass in browser | Docker Desktop / Postgres not running | BLOCKED |
| Docker Clean Run | DevOps | `docker compose up` | Healthy app + DB | Docker Desktop not running | BLOCKED |

## Live Docker, PostgreSQL, Security & E2E Verification — 2026-11-11

| Check / Test | Type | Command | Expected | Actual | Status |
|--------------|------|---------|----------|--------|--------|
| Docker Compose Up | DevOps | `docker compose up --build -d` (`POSTGRES_PORT=5433`) | Healthy DB + App | `aqar-elite-postgres` healthy, `aqar-elite-app` healthy | PASS |
| App Healthcheck | Runtime | `Invoke-RestMethod http://localhost:3000/api/health` | `ok / connected` | `ok / connected` | PASS |
| Seed Idempotency (x2) | DB | `docker compose exec -T app npm run db:seed` (x2) | `2/8/5/4` rows | `2 companies, 8 users, 5 units, 4 clients` | PASS |
| ESLint | Lint | `npm run lint` | 0 errors | Exit 0 (0 errors, 0 warnings) | PASS |
| TypeScript Strict | Static | `npm run typecheck` | 0 errors | Exit 0 (0 errors) | PASS |
| Unit Tests | Unit | `npm test` | All pass | 8 files, 51/51 passed | PASS |
| PostgreSQL Integration | Integration | `npm run test:integration` | All pass on Postgres | 4 files, 14/14 passed | PASS |
| Playwright E2E | E2E | `npm run test:e2e` | Full workflow + RTL + 360px–1440px | 1/1 passed (11.7s) | PASS |
| Live HTTP Security Audit | Security | `node -e "..."` vs `http://localhost:3000` | 10/10 checks pass | 10/10 passed (`401/403/404/200`) | PASS |
| Production Build | Build | `npm run build` | Exit 0 | Exit 0 | PASS |

## Post-Audit Medium Remediation Regression — 2026-11-11

| Check / Test | Type | Command | Expected | Actual | Status |
|--------------|------|---------|----------|--------|--------|
| Docker App Rebuild & Health | DevOps | `docker compose up --build -d app` + `/api/health` | Healthy + `ok/connected` | `aqar-elite-app` healthy, `ok/connected` | PASS |
| Production Compose Config | Config | `docker compose -f docker-compose.yml -f docker-compose.prod.yml config` | Fail-fast if unset; `COOKIE_SECURE="true"` | Failed on missing vars; `"true"` when set | PASS |
| Backup & Restore Runbook | Operational | `pg_dump -Fc` + `pg_restore --single-transaction` into `aqar_restore_verify` | Restores 2 companies & 3 triggers | `companies=2, triggers=3`, scratch DB dropped | PASS |
| ESLint | Lint | `npm run lint` | 0 errors | Exit 0 (0 errors, 0 warnings) | PASS |
| TypeScript Strict | Static | `npm run typecheck` | 0 errors | Exit 0 (0 errors) | PASS |
| Unit Tests | Unit | `npm test` | All pass | 10 files, 55/55 passed | PASS |
| PostgreSQL Integration | Integration | `npm run test:integration` | All pass on Postgres | 4 files, 15/15 passed | PASS |
| Playwright E2E | E2E | `npm run test:e2e` | Both flows pass | 2/2 passed (including `randomUUID=undefined` LAN HTTP test) | PASS |
| Live HTTP Security Audit | Security | `node -e "..."` vs `http://localhost:3000` | 12/12 pass | 12/12 passed (CSRF missing-Origin `403`, `TRUST_PROXY=false` `429`) | PASS |
| Dependency Audit | Security | `npm audit --audit-level=high` | 0 High/Critical | Exit 0 (0 High/Critical) | PASS |
| Production Build | Build | `npm run build` | Exit 0 | Exit 0 | PASS |
