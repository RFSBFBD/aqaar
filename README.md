# Aqar Elite (عقار إيليت)

A multi-tenant real estate installment sales management system built to specification **RA-HR-2026-1110**, featuring an Arabic RTL interface, exact integer financial arithmetic (`BigInt` minor units with zero floating-point math), atomic PostgreSQL reservation and payment concurrency controls, and server-enforced multi-tenant isolation.

---

## 1. Project Overview

Aqar Elite manages the end-to-end real estate installment sales lifecycle for multiple isolated companies within a single deployment:

- **Authentication & Multi-Tenancy:** Database-backed `HttpOnly` cookie sessions (`ADMIN`, `SALES`, `ACCOUNTANT`) with strict `companyId` isolation derived solely from the authenticated server session.
- **Units Inventory (`Units`):** Company Managers (`ADMIN`) create and update units; all roles browse inventory with server-side filtering (`status`, `minPrice`, `maxPrice`), allowlisted sorting (`price`, `area`), and pagination. Prices cannot be modified once a unit is `RESERVED` or `SOLD`, and every price change creates an `AuditLog` entry.
- **Clients (`Clients`):** Sales Representatives (`SALES`) create and edit their own clients (name, phone, free-text notes) and cannot view or mutate clients belonging to other agents or companies. `ADMIN` and `ACCOUNTANT` have company-scoped read-only visibility.
- **72-Hour Reservations (`Reservations`):** `SALES` agents atomically reserve `AVAILABLE` units for `72 hours` for their own clients. Concurrent attempts for the same unit allow at most one winner via PostgreSQL conditional `UPDATE` + partial unique index (`reservations_one_active_per_unit`). Expired reservations automatically release the unit back to `AVAILABLE`.
- **Contracts & Installments (`Contracts` & `Installments`):** `SALES` agents create draft contracts from active reservations with a maximum discount of **5%**. `ACCOUNTANT` users atomically approve contracts in a single database transaction that marks the unit `SOLD`, locks the contract against edits (enforced by a PostgreSQL trigger), and generates the monthly installment schedule using integer division and end-of-month date clamping (`Jan 31` policy).
- **FIFO Payments (`Payments`):** `ACCOUNTANT` users record immutable, append-only payments (`idempotencyKey` + `SELECT ... FOR UPDATE` contract locking) automatically allocated to the oldest unpaid installments first (`PENDING` / `PARTIAL`, with `OVERDUE` derived from UTC due date).
- **Audit Trail (`AuditLog`):** Read-only company audit trail for `ADMIN`, recording `LOGIN`, `LOGIN_FAILED` (for existing accounts), `UNIT_CREATED`, `UNIT_PRICE_CHANGED`, `RESERVATION_CREATED`, `CONTRACT_CREATED`, `CONTRACT_APPROVED`, and `PAYMENT_RECORDED`.

---

## 2. Technology Choices and Rejected Alternatives

| Choice | Selected | Rejected Alternatives & Rationale |
|---|---|---|
| **Web Framework & Language** | **Next.js 16 (App Router) + TypeScript (`strict: true`)** | **Rejected:** Separate React SPA + Express backend (adds deployment complexity and split auth/cookie proxies) and Remix (smaller ecosystem). Next.js App Router provides SSR for RTL Arabic pages, Route Handlers, and a single Docker deployable. |
| **Database & ORM** | **PostgreSQL 16 + Prisma 7 (`@prisma/adapter-pg`)** | **Rejected:** MySQL (weaker partial unique index support for `WHERE status = 'ACTIVE'`), SQLite (no production concurrency locking `FOR UPDATE` or triggers), and raw SQL throughout (higher boilerplate without type-safe queries). PostgreSQL provides `CHECK` constraints, partial unique indexes, `FOR UPDATE` row locking, and PL/pgSQL immutability triggers alongside Prisma migrations. |
| **Financial Arithmetic** | **Native TypeScript `BigInt` + PostgreSQL `BIGINT` (minor units)** | **Rejected:** JavaScript IEEE 754 `number` (precision drift such as `0.1 + 0.2 !== 0.3`) and heavy decimal libraries where unnecessary. `BigInt` minor units guarantee zero rounding error across contract totals, remainder distribution, and FIFO allocations. |
| **Validation** | **Zod v4 (`.strict()`)** | **Rejected:** Manual `if/typeof` checks (error-prone and inconsistent) or unstrict schemas (vulnerable to mass assignment of `companyId`, `role`, or `agentId`). |
| **Password Hashing & Sessions** | **bcryptjs (cost 12) + PostgreSQL SHA-256 Session Tokens** | **Rejected:** `localStorage` JWTs (XSS token theft risk and lack of instant server-side logout invalidation). Note: `bcryptjs` was chosen over native `argon2` for zero native-addon build friction on Alpine Docker while still meeting the assessment's bcrypt/Argon2id requirement. |
| **Testing** | **Vitest (Unit + PostgreSQL Integration) + Playwright (E2E)** | **Rejected:** Jest (slower ESM/TS config) and unit-only mocked DB suites (cannot verify real `FOR UPDATE` row locks, triggers, or parallel reservation races). |

---

## 3. Architecture Explanation

The codebase enforces strict separation of concerns across four layers:

1. **Presentation & App Router (`src/app/`, `src/components/`):**
   - Server Components (`src/app/(app)/*/page.tsx`) enforce session authentication via `requirePageUser()` and load `AppShell`.
   - Client workspaces (`src/components/*`) handle Arabic RTL forms, field-level validation rendering, loading/empty/error states, and API calls without embedding domain or financial math.
2. **HTTP Boundary (`src/app/api/`, `src/server/http/`, `src/server/validation/`):**
   - Route Handlers enforce `assertCsrfSafe()` on mutations, extract `TenantContext` solely from the session via `getTenantContext()`, enforce role checks before parsing inputs, validate with `.strict()` Zod schemas, and normalize errors through `handleApiError()` without leaking stack traces or SQL.
3. **Application Services & Repositories (`src/server/services/`, `src/server/repositories/`, `src/server/auth/`):**
   - Services implement transactional workflows (`prisma.$transaction`), row locking (`FOR UPDATE`), lazy reservation expiration, and atomic `AuditLog` entries.
   - Repositories require `companyId` (and `agentId` for `SALES` client access) on every query.
4. **Pure Domain Layer (`src/domain/`):**
   - `financial.ts`: `BigInt` discount cap (`<= 5%`), final price, remaining balance, integer installment split with `+1` remainder distribution, FIFO payment allocation, and overpayment checks.
   - `dates.ts`: UTC monthly due-date schedule preserving base day with end-of-month clamping and `OVERDUE` derivation.
   - `state-machines.ts`: Explicit allowed transitions for units, reservations, contracts, and installments.

---

## 4. Clean-Machine Installation and Docker Startup

### Prerequisites
- **Docker** and **Docker Compose** (v2+)
- Or for local host development without Docker app container: **Node.js 22+** and **PostgreSQL 16**

### Option A: Clean-Machine Docker Compose Startup (Recommended for Evaluation)

No `.env` file, `node_modules`, or local build artifacts are required:

```bash
git clone https://github.com/RFSBFBD/Aqar-Elite.git
cd Aqar-Elite
docker compose up
```

What `docker compose up` does automatically:
1. Starts `postgres:16-alpine` (bound strictly to loopback `127.0.0.1:${POSTGRES_PORT:-5432}:5432`, never exposed publicly) and waits until `pg_isready` passes.
2. Builds the Next.js production container, applies Prisma migrations (`npx prisma migrate deploy`), runs the idempotent evaluation seed (`RUN_SEED=true` in `docker-compose.yml`), and starts Next.js on **http://localhost:3000**.
3. Health endpoint: `GET http://localhost:3000/api/health` → `{"status":"ok","database":"connected"}`.
4. Login page: **http://localhost:3000/login**.

*(Note: If port `5432` is already occupied on your local machine by another PostgreSQL instance, run `POSTGRES_PORT=5433 docker compose up`.)*

### Option B: Production Deployment Overlay

For production deployments over HTTPS, use the production overlay (`docker-compose.prod.yml`), which enforces `COOKIE_SECURE="true"`, `TRUST_PROXY="true"`, `RUN_SEED="false"` (never seeds default accounts), and fails fast if `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, or a 32+ character `SESSION_SECRET` are omitted:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

See [`docs/PRODUCTION_RUNBOOK.md`](docs/PRODUCTION_RUNBOOK.md) for PostgreSQL backup (`pg_dump`), restore (`pg_restore`), and TLS reverse-proxy setup.

### Option C: Local Host Development (Node.js 22+)

```bash
git clone https://github.com/RFSBFBD/Aqar-Elite.git
cd Aqar-Elite
cp .env.example .env
# Update DATABASE_URL and SESSION_SECRET in .env
npm ci
npx prisma generate
npm run db:migrate
npm run db:seed
npm run dev
```

### Verification & Test Commands

```bash
npm run lint              # ESLint
npm run typecheck         # TypeScript strict check (tsc --noEmit)
npm test                  # Vitest pure unit tests
npm run test:integration  # Vitest integration & concurrency tests against PostgreSQL
npm run test:e2e          # Playwright end-to-end browser workflow (requires running app)
npm run build             # Next.js production build
npm audit --omit=dev      # Production dependency vulnerability audit
```

---

## 5 & 6. Verified Seed Accounts (Assessment / Development Only)

> **Security Warning:** These accounts and password (`AqarElite!2026`, or `SEED_DEFAULT_PASSWORD` if overridden during `db:seed`) are **strictly for local development and assessment evaluation**. Production deployments set `RUN_SEED=false` and must never expose default credentials.

All 8 accounts below are seeded idempotently by [`prisma/seed.ts`](prisma/seed.ts) and verified via live `POST /api/auth/login` authentication:

| Company | Role | Email | Password *(Dev/Assessment Only)* | Permissions Summary |
|---|---|---|---|---|
| **شركة النخبة العقارية (Company A)** | Company Manager (`ADMIN`) | `admin.a@nukhba.local` | `AqarElite!2026` | Create/edit units & available unit prices, view all Company A clients/reservations/contracts, read-only `AuditLog`. Blocked (`403`) from creating clients, reservations, contracts, or payments. |
| **شركة النخبة العقارية (Company A)** | Accountant (`ACCOUNTANT`) | `accountant.a@nukhba.local` | `AqarElite!2026` | View Company A units/clients/reservations/contracts, approve draft contracts, record append-only FIFO payments. Blocked (`403`) from editing units/clients, reserving, drafting contracts, or reading `AuditLog`. |
| **شركة النخبة العقارية (Company A)** | Sales Rep 1 (`SALES`) | `sales1.a@nukhba.local` | `AqarElite!2026` | Create/edit **own** clients only, create 72h reservations & draft contracts for own clients. Blocked (`403`) from units write, approval, payments, `AuditLog`, and other agents' clients (`404`). |
| **شركة النخبة العقارية (Company A)** | Sales Rep 2 (`SALES`) | `sales2.a@nukhba.local` | `AqarElite!2026` | Same `SALES` scope within Company A, isolated from `sales1.a`'s clients and from Company B. |
| **شركة دار المستقبل للتطوير (Company B)** | Company Manager (`ADMIN`) | `admin.b@mustaqbal.local` | `AqarElite!2026` | Same `ADMIN` permissions scoped strictly to Company B (`cmp_mustaqbal_b`). Cross-company IDs return `404`. |
| **شركة دار المستقبل للتطوير (Company B)** | Accountant (`ACCOUNTANT`) | `accountant.b@mustaqbal.local` | `AqarElite!2026` | Same `ACCOUNTANT` permissions scoped strictly to Company B (`cmp_mustaqbal_b`). |
| **شركة دار المستقبل للتطوير (Company B)** | Sales Rep 1 (`SALES`) | `sales1.b@mustaqbal.local` | `AqarElite!2026` | Same `SALES` scope within Company B (`cmp_mustaqbal_b`). |
| **شركة دار المستقبل للتطوير (Company B)** | Sales Rep 2 (`SALES`) | `sales2.b@mustaqbal.local` | `AqarElite!2026` | Same `SALES` scope within Company B (`cmp_mustaqbal_b`). |

---

## 7. Business Assumptions and Ambiguous Rules

Full details are documented in [`docs/ASSUMPTIONS.md`](docs/ASSUMPTIONS.md) and [`docs/DOMAIN_RULES.md`](docs/DOMAIN_RULES.md):

1. **Monetary Precision & Currency:** All monetary figures are represented in integer minor units (`100 = 1.00`, stored as PostgreSQL `BIGINT` and serialized as numeric strings in JSON). Single currency per deployment.
2. **Installment Remainder Distribution:** When `remainingAmount` is not evenly divisible by `installmentCount`, `base = remaining / count` and `remainder = remaining % count` adds `+1` minor unit to each of the first `remainder` installments so `sum(installments) + downPayment === finalPrice` is always exact.
3. **January 31 & End-of-Month Date Policy:** Monthly installment due dates are computed in UTC from the original `startDate` base day, clamping only when a target month has fewer days while preserving the base day for subsequent months (`Jan 31 → Feb 28/29 → Mar 31 → Apr 30 → May 31`). Note: Installment #1 starts one month after `startDate` (or from `startDate`'s month sequence as implemented in `generateDueDates(startDate, count)` — `2026-01-31` + 3 installments yields `2026-02-28`, `2026-03-31`, `2026-04-30`).
4. **Reservation Expiry:** No manual cancellation or extension exists. Expiry (`72 hours`) is enforced automatically via **lazy expiration** before any unit read/edit, reservation creation, or contract draft/approval, supplemented by `src/server/jobs/expire-reservations.ts` for scheduled sweeps.
5. **Derived `OVERDUE` Installment Status:** Stored statuses are `PENDING`, `PARTIAL`, and `PAID`. `OVERDUE` is derived dynamically at read time using UTC date comparison when `dueDate < todayUtc` and `paidAmount < amount` (never overriding `PAID`).
6. **Discount Cap:** Maximum discount is `floor(unitPrice * 5 / 100)` (`5%`), enforced in domain logic, Zod validation, and PostgreSQL `CHECK` constraint `contracts_discount_bounds`.
7. **Audit Log Failed Logins:** Every failed login updates `login_attempts` (for IP + email rate limiting), and failed attempts against an existing account also record `LOGIN_FAILED` in the tenant's `audit_logs` table (since `audit_logs` has required `company_id` and `user_id` foreign keys).

---

## 8. Three Most Important Security Risks and Their Mitigations

1. **Cross-Tenant IDOR & Privilege Escalation (Company A ↔ Company B / Role Forgery):**
   - *Mitigation:* `companyId`, `userId`, and `userRole` are derived solely server-side from the hashed `Session` cookie via [`getTenantContext()`](src/server/auth/guards.ts). All Zod input schemas use `.strict()` to reject forged `companyId`/`role`/`agentId` fields, every repository query constrains `WHERE company_id = ...`, and cross-tenant lookups return a uniform `404` to prevent resource enumeration.
2. **Concurrent Double-Reservation & Overpayment Race Conditions:**
   - *Mitigation:* Reservations execute an atomic conditional `UPDATE "units" ... WHERE "status" = 'AVAILABLE'` inside a transaction backed by the PostgreSQL partial unique index `reservations_one_active_per_unit` (`WHERE status = 'ACTIVE'`). Payments lock the contract row with `SELECT ... FOR UPDATE`, enforce `(companyId, idempotencyKey)` uniqueness, reject amounts exceeding remaining balance, and rely on PostgreSQL `BEFORE UPDATE OR DELETE` triggers (`payments_append_only`, `payment_allocations_append_only`, `contracts_immutable_after_approval`).
3. **CSRF, Session Hijacking, Brute Force & Stored XSS:**
   - *Mitigation:* Session tokens are 32 random bytes stored as SHA-256 hashes in PostgreSQL and sent only in `HttpOnly`, `SameSite=Lax`, `Path=/` cookies (`Secure=true` in production; zero tokens in `localStorage`). Cookie-authenticated mutations validate `Sec-Fetch-Site` and `Origin`/`Referer` via [`assertCsrfSafe()`](src/server/http/csrf.ts). Login brute force is throttled per IP (`TRUST_PROXY`-guarded) and per email. React JSX escaping and strict HTTP security headers (`Content-Security-Policy`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`) neutralize stored XSS in client notes.

---

## 9. What Was Not Implemented and How It Could Be Implemented With More Time

- **Intentionally Excluded Out-of-Scope Assessment Items:** Self-registration, user management UI, password reset, analytics dashboards, CSV/PDF exports, CRM pipelines, file uploads, and contract cancellation were intentionally excluded per specification RA-HR-2026-1110.
- **Future Hardening Opportunities:**
  1. **Nonce-based CSP:** Replace `'unsafe-inline' 'unsafe-eval'` in `next.config.ts` with per-request cryptographic nonces in Next.js middleware.
  2. **Scheduled Maintenance Worker:** Add a lightweight cron/worker service in production Compose to run `src/server/jobs/expire-reservations.ts`, `cleanupExpiredSessions()`, and aged `login_attempts` pruning periodically.
  3. **AuditLog Append-Only Trigger & External Log Sink:** Add a PostgreSQL `BEFORE UPDATE OR DELETE` trigger on `audit_logs` alongside structured JSON request logging.

---

## 10. AI Tools Usage Disclosure

AI coding assistants were used during project discovery, scaffolding, documentation drafting, and test generation. All financial math (`BigInt` minor units, remainder distribution, FIFO allocation), UTC end-of-month date clamping, PostgreSQL locking/triggers, multi-tenant authorization boundaries, security controls, and Docker workflows were manually reviewed, audited, and verified against live PostgreSQL integration tests, Playwright E2E browser tests, and clean-clone Docker execution.
