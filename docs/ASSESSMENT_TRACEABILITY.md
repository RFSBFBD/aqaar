# Aqar Elite — Assessment Compliance Traceability Matrix

**Specification:** `RA-HR-2026-1110`  
**Audit Date:** 2026-11-11  
**Note on Source Document:** The external 8-page PDF file (`RA-HR-2026-1110`) is not stored inside the workspace directory; this matrix maps every itemized requirement from the RA-HR-2026-1110 compliance specification and `Aqar_Elite_AI_Agent_Prompt_Pack/` directly to the verified codebase, database migrations, and executed tests.

---

## 1. Functional Requirements

### 1.1 Authentication & Seed Accounts

| Requirement | Implementation Files | Test Files | Result | Evidence |
|---|---|---|---|---|
| Login and logout only (no signup, no user management, no password recovery) | `src/app/login/page.tsx`, `src/app/api/auth/login/route.ts`, `src/app/api/auth/logout/route.ts`, `src/app/api/auth/me/route.ts`, `src/components/AppShell.tsx` | `tests/integration/phase1-auth.integration.test.ts`, `tests/e2e/aqar-workflow.spec.ts` | **PASS** | Verified route tree contains only `/login`, `/api/auth/{login,logout,me}`; unauthenticated `/units` redirects to `/login`; logout invalidates server session. |
| Two companies in seed data, each with 1 Manager (`ADMIN`), 1 Accountant (`ACCOUNTANT`), 2 Sales Reps (`SALES`) — 8 verified accounts | `prisma/seed.ts`, `prisma/schema.prisma` | `tests/integration/phase1-auth.integration.test.ts`, live HTTP test across all 8 accounts | **PASS** | `cmp_nukhba_a` & `cmp_mustaqbal_b` seeded idempotently; all 8 accounts authenticated (`200 OK`) against clean Docker build with `AqarElite!2026`. |

### 1.2 Units

| Requirement | Implementation Files | Test Files | Result | Evidence |
|---|---|---|---|---|
| Server-side filtering (`status`, `minPrice`, `maxPrice`), server-side pagination, allowlisted sorting (`price`, `area`) | `src/app/api/units/route.ts`, `src/server/validation/unit.ts`, `src/server/repositories/unit.repository.ts`, `src/server/services/unit.service.ts` | `tests/unit/phase2-validation.test.ts`, `tests/integration/phase5-security-attack.integration.test.ts`, `tests/e2e/aqar-workflow.spec.ts` | **PASS** | `unitQuerySchema` validates `status`, `BigInt` price bounds, `sortBy: z.enum(['price','area'])`, `page`/`pageSize`; repository runs Prisma `skip`/`take` & `count`. |
| `ADMIN` creates & edits units (`projectName`, `unitNumber`, `type`, `area`, `rooms`, `price`) | `src/app/api/units/route.ts`, `src/app/api/units/[id]/route.ts`, `src/server/services/unit.service.ts`, `src/components/units/UnitsWorkspace.tsx` | `tests/integration/phase2-tenancy-units-clients-reservations.integration.test.ts`, `tests/e2e/aqar-workflow.spec.ts` | **PASS** | `SALES`/`ACCOUNTANT` receive `403` on `POST /api/units` and `PATCH /api/units/[id]`. |
| Only 3 states (`AVAILABLE`, `RESERVED`, `SOLD`) and allowed transitions only | `prisma/schema.prisma`, `src/domain/state-machines.ts`, `src/server/services/reservation.service.ts`, `src/server/services/reservation-expiry.service.ts`, `src/server/services/contract.service.ts` | `tests/unit/state-machines.test.ts`, `tests/integration/phase2-tenancy-units-clients-reservations.integration.test.ts`, `tests/integration/phase3-contracts-payments.integration.test.ts` | **PASS** | `UnitStatus` enum has 3 states; transitions execute only via reservation, expiry release, and contract approval. |
| `RESERVED` or `SOLD` unit prices cannot be changed; every price change creates `AuditLog` | `src/server/services/unit.service.ts` (`updateUnit` row lock `FOR UPDATE`, `UNIT_PRICE_CHANGED`) | `tests/integration/phase2-tenancy-units-clients-reservations.integration.test.ts` | **PASS** | Returns `409` when editing price of `RESERVED`/`SOLD` unit; logs `UNIT_PRICE_CHANGED` with `oldPrice` & `newPrice`. |

### 1.3 Clients

| Requirement | Implementation Files | Test Files | Result | Evidence |
|---|---|---|---|---|
| `SALES` creates & edits own clients (`name`, `phone`, `notes`); sees only own clients; notes appear on client detail page | `src/app/api/clients/route.ts`, `src/app/api/clients/[id]/route.ts`, `src/server/services/client.service.ts`, `src/server/repositories/client.repository.ts`, `src/components/clients/ClientsWorkspace.tsx`, `src/components/clients/ClientDetailWorkspace.tsx` | `tests/integration/phase2-tenancy-units-clients-reservations.integration.test.ts`, `tests/integration/phase5-security-attack.integration.test.ts`, `tests/e2e/aqar-workflow.spec.ts` | **PASS** | `SALES` queries filter `agentId = ctx.userId`; cross-agent IDs return `404`; `ADMIN`/`ACCOUNTANT` get `403` on mutations; `ClientDetailWorkspace.tsx` displays & edits `notes`. |

### 1.4 Reservations

| Requirement | Implementation Files | Test Files | Result | Evidence |
|---|---|---|---|---|
| Exact 72-hour reservation duration; automatic expiry release without manual intervention | `src/server/services/reservation.service.ts` (`RESERVATION_TTL_MS`), `src/server/services/reservation-expiry.service.ts`, `src/server/jobs/expire-reservations.ts` | `tests/integration/phase2-tenancy-units-clients-reservations.integration.test.ts` | **PASS** | `expiresAt = now + 72h`; lazy expiry runs before reads/writes and is idempotent; returns unit to `AVAILABLE`. |
| Concurrent reservation attempts allow only 1 success and return clear error to losers | `src/server/services/reservation.service.ts` (`UPDATE ... WHERE status = 'AVAILABLE'`), `prisma/migrations/20261111000000_init/migration.sql` (`reservations_one_active_per_unit`) | `tests/integration/phase2-tenancy-units-clients-reservations.integration.test.ts` | **PASS** | Parallel `Promise.all` of 10 attempts yields exactly 1 fulfillment and 9 `409` rejections. |

### 1.5 Contracts & Installments

| Requirement | Implementation Files | Test Files | Result | Evidence |
|---|---|---|---|---|
| `SALES` creates draft from active reservation; `ACCOUNTANT` approves; approval sets unit `SOLD` & approved contracts cannot be edited | `src/server/services/contract.service.ts`, `src/app/api/contracts/**`, `prisma/migrations/20261111000000_init/migration.sql` (`contracts_immutable_after_approval` trigger) | `tests/integration/phase3-contracts-payments.integration.test.ts`, `tests/e2e/aqar-workflow.spec.ts` | **PASS** | Atomic approval transaction updates contract/reservation/unit and inserts installments; `updateContractDraft` locks with `FOR UPDATE` and returns `409`; DB trigger blocks direct `UPDATE`/`DELETE`. |
| Max 5% discount; automatic installments; `downPayment + sum(installments) === finalPrice`; `BigInt` minor units only; Jan 31 clamping policy | `src/domain/financial.ts`, `src/domain/dates.ts`, `src/lib/format.ts`, `prisma/migrations/20261111000000_init/migration.sql` (`contracts_*` `CHECK` constraints) | `tests/unit/financial.test.ts`, `tests/unit/dates.test.ts`, `tests/unit/domain-proof.test.ts`, `tests/integration/phase3-contracts-payments.integration.test.ts` | **PASS** | `100000 / 3 → [33334, 33333, 33333]`; `2026-01-31` → `2026-02-28`, `2026-03-31`, `2026-04-30`; zero floating-point monetary arithmetic. |
| Contract page displays installment schedule, status, and remaining balance | `src/components/contracts/ContractDetailWorkspace.tsx`, `src/components/StatusBadge.tsx` | `tests/e2e/aqar-workflow.spec.ts` | **PASS** | Displays summary cards (`outstandingBalance`), schedule table (`sequenceNumber`, `dueDate`, `amount`, `paidAmount`, `remainingAmount`, `status`), and payment history. |

### 1.6 Payments

| Requirement | Implementation Files | Test Files | Result | Evidence |
|---|---|---|---|---|
| `ACCOUNTANT` records payments; FIFO to oldest unpaid installments; `PARTIAL`/`PAID`; `OVERDUE` derived from due date; capped at remaining balance; idempotency; append-only (no edit/delete) | `src/server/services/payment.service.ts`, `src/domain/financial.ts`, `src/domain/dates.ts`, `src/app/api/payments/route.ts`, `prisma/migrations/20261111000000_init/migration.sql` (`payments_company_id_idempotency_key_key`, `payments_append_only`, `payment_allocations_append_only`) | `tests/unit/financial.test.ts`, `tests/unit/dates.test.ts`, `tests/integration/phase3-contracts-payments.integration.test.ts`, `tests/e2e/aqar-workflow.spec.ts` | **PASS** | FIFO splits verified; replay returns original payment (`replayed: true`); concurrent overpayment race blocked via `FOR UPDATE`; DB triggers raise `P0001` on update/delete. |

### 1.7 User Interface

| Requirement | Implementation Files | Test Files | Result | Evidence |
|---|---|---|---|---|
| Arabic UI, RTL (`dir="rtl"`), responsive (360px–1440px), loading/empty/error states, field-level validation messages | `src/app/layout.tsx`, `src/app/login/page.tsx`, `src/components/AppShell.tsx`, `src/components/*/*.tsx` | `tests/e2e/aqar-workflow.spec.ts` | **PASS** | `html[lang="ar"][dir="rtl"]`; 0 horizontal overflow across `360/390/768/1280/1440px`; field-level errors wired to Login, Units, Clients, Client Detail, Draft Contract, and Payment forms. |

---

## 2. Security, Infrastructure & Quality Requirements

| Requirement | Implementation Files | Test Files / Verification | Result | Evidence |
|---|---|---|---|---|
| Password hashing (`bcrypt` cost 12), zero password/hash logs/responses | `src/server/auth/crypto.ts`, `src/server/auth/service.ts` | `tests/unit/auth-primitives.test.ts`, `tests/integration/phase1-auth.integration.test.ts` | **PASS** | `bcryptjs` hash verified; `user` DTO selects explicit safe fields only. |
| Cookie `HttpOnly`, `SameSite=Lax`, `Secure` (production), zero `localStorage` tokens, server logout invalidation | `src/server/auth/cookies.ts`, `src/server/auth/session.ts`, `src/app/api/auth/logout/route.ts`, `docker-compose.prod.yml` | `tests/unit/auth-primitives.test.ts`, `tests/integration/phase1-auth.integration.test.ts`, `tests/e2e/aqar-workflow.spec.ts`, live HTTP test | **PASS** | SHA-256 `tokenHash` stored in `sessions`; `localStorage` keys `[]`; post-logout `/api/auth/me` returns `401`. *(Note: `docker-compose.yml` sets `COOKIE_SECURE=false` strictly for local HTTP Docker evaluation; `docker-compose.prod.yml` enforces `COOKIE_SECURE=true`.)* |
| Brute-force rate limiting & generic login error message | `src/server/auth/rate-limit.ts`, `src/server/http/client-ip.ts`, `src/server/auth/service.ts` | `tests/unit/client-ip.test.ts`, `tests/integration/phase1-auth.integration.test.ts` | **PASS** | 5 attempts / 900s per IP+email (`429` on 6th); `TRUST_PROXY` guards `X-Forwarded-For`; identical `401` message for bad email vs bad password. |
| Tenant isolation (`companyId` from session only), RBAC, `.strict()` validation, CSRF, Security Headers | `src/server/auth/guards.ts`, `src/server/http/csrf.ts`, `src/server/validation/*.ts`, `next.config.ts` | `tests/unit/auth-primitives.test.ts`, `tests/integration/phase2...`, `tests/integration/phase5...`, live HTTP check | **PASS** | All queries scoped by `ctx.companyId`; cross-company `404`; CSRF rejects mismatched `Origin` and missing `Origin`/`Referer` on cookie mutations; security headers verified `200`. |
| `AuditLog` records failed logins, price changes, approvals, payments | `src/server/services/audit.service.ts`, `src/server/auth/service.ts`, `src/server/services/unit.service.ts`, `src/server/services/contract.service.ts`, `src/server/services/payment.service.ts` | `tests/integration/phase1-auth.integration.test.ts`, `tests/integration/phase2...`, `tests/integration/phase3...`, live HTTP check | **PASS** | `LOGIN_FAILED` (for existing users), `UNIT_PRICE_CHANGED`, `CONTRACT_APPROVED`, `PAYMENT_RECORDED` persisted in `audit_logs`. *(Unknown emails are logged in `login_attempts` since `audit_logs` has required tenant/user foreign keys.)* |
| `npm audit` zero High/Critical; TypeScript `strict: true` with zero `any` | `package.json`, `package-lock.json`, `tsconfig.json` | `npm audit --omit=dev`, `npm audit --audit-level=high`, `npm run typecheck`, `npm run lint` | **PASS** | `npm audit --omit=dev`: `0` vulnerabilities; `--audit-level=high`: `0` High/Critical; `tsc --noEmit`: 0 errors; `eslint`: 0 errors; zero `any` / `@ts-ignore`. |
| Favicon replacement (real-estate building icon, no conflicting tags) | `src/app/icon.svg`, `src/app/favicon.ico`, `src/app/layout.tsx` | Live HTTP check against production Docker build | **PASS** | `/icon.svg` (`200`, `image/svg+xml`) and `/favicon.ico` (`200`, `image/x-icon`) render crisp building icon with non-conflicting Next.js `<link>` metadata. |
| Clean-machine `git clone && docker compose up` + non-public PostgreSQL + CI workflow | `Dockerfile`, `docker-compose.yml`, `docker-compose.prod.yml`, `.github/workflows/ci.yml` | Live clean `git clone` build & boot in temp folder (`aqar-clean`) | **PASS** | Clean clone with zero `.env`/`node_modules`/`.next` booted Postgres (`127.0.0.1` loopback-only), ran `prisma migrate deploy`, auto-seeded 8 users, passed `/api/health`, all 8 logins, and Playwright E2E. |
