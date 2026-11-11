# Security Review Report — Aqar Elite (Phase 5)

**Date:** 2026-11-11  
**Reviewer Role:** Independent Security Engineer  
**Scope:** Full-stack audit assuming an authenticated attacker holding a valid company account (`SALES`, `ACCOUNTANT`, or `ADMIN`).

---

## 1. Threat & Control Verification Matrix

| Area | Control Implemented | Code / DB Evidence | Residual Risk / Boundary |
|------|--------------------|--------------------|--------------------------|
| **Authentication & Session Lifecycle** | 256-bit CSPRNG token (`crypto.randomBytes(32)`), SHA-256 `tokenHash` stored in PostgreSQL `sessions`, `HttpOnly` + `SameSite=Lax` + `Path=/` cookie (`Secure` in production), server-side invalidation on logout, expiry cleanup. | `src/server/auth/{crypto.ts,session.ts,cookies.ts}`, `src/app/api/auth/{login,logout}/route.ts` | Local HTTP Docker (`http://localhost:3000`) requires `COOKIE_SECURE=false` if non-localhost HTTP clients (e.g., curl) are used; HTTPS reverse proxy recommended in internet-facing prod. |
| **Brute-Force / Rate Limiting** | PostgreSQL-backed `login_attempts` table throttles both IP and email after 5 failed attempts per 15-minute window. Dummy bcrypt comparison when email is unknown mitigates timing enumeration. Uniform 401 message. | `src/server/auth/{rate-limit.ts,service.ts}` | `x-forwarded-for` spoofing is possible if deployed behind an untrusted proxy; configure trusted proxy stripping at ingress. |
| **CSRF Protection** | `SameSite=Lax` cookies + explicit `Origin` / `Referer` host verification (`assertCsrfSafe`) on all mutating routes (`POST`/`PATCH`). | `src/server/http/csrf.ts` | Requests without `Origin`/`Referer` (e.g., server-to-server scripts) rely on session cookie presence; browsers always send `Origin` on mutating cross-origin fetches. |
| **Tenant Isolation & IDOR** | `companyId` derived exclusively from `getTenantContext()` (server-side session). Every repository query includes `companyId` in `WHERE`. Cross-tenant IDs return uniform `404` without confirming existence. | `src/server/auth/guards.ts`, `src/server/repositories/*.ts`, `src/server/services/*.ts` | Logical isolation (shared schema); PostgreSQL RLS is not enabled as an extra DB layer (mitigated by strict repository parameter enforcement). |
| **Role Escalation & Mass Assignment** | Strict `.strict()` Zod schemas reject unexpected keys (`role`, `companyId`, `agentId`, `status`, `approvedById`). Service layer enforces role per operation. | `src/server/validation/*.ts`, `src/server/services/*.ts` | None known at API boundary. |
| **Cross-Agent Isolation** | `SALES` agents restricted to `agentId = ctx.userId` on clients, reservations, and contract drafts. | `src/server/services/{client,reservation,contract}.service.ts` | `ADMIN` and `ACCOUNTANT` intentionally read all company clients per `ASSUMPTIONS.md`. |
| **SQL Injection** | Prisma ORM parameterized queries; raw locking/conditional updates strictly use tagged `Prisma.sql` templates (zero string concatenation). Sorting uses explicit Zod enum allowlist (`price` \| `area`). | `src/server/services/{reservation,contract,payment,unit,reservation-expiry}.service.ts`, `src/server/validation/unit.ts` | None known. |
| **XSS (`notes` & Free Text)** | React JSX auto-escaping; zero `dangerouslySetInnerHTML`; `Content-Security-Policy` header blocks inline/external scripts (`frame-ancestors 'none'`). | `next.config.ts`, `src/components/clients/ClientDetailWorkspace.tsx` | None known. |
| **Concurrency & Financial Integrity** | Integer `BigInt` minor units throughout; `FOR UPDATE` row locks + conditional `UPDATE` + partial unique index `reservations_one_active_per_unit`; DB triggers `payments_append_only`, `payment_allocations_append_only`, `contracts_immutable_after_approval`; `(companyId, idempotencyKey)` unique constraint. | `src/domain/*.ts`, `prisma/migrations/20261111000000_init/migration.sql` | Requires live PostgreSQL execution to verify trigger & lock behavior (blocked until Docker/PostgreSQL is started). |
| **Audit Log Integrity** | Append-only writes inside service transactions; `GET /api/audit-logs` & `/audit-logs` restricted to `ADMIN` role. | `src/server/services/audit.service.ts`, `src/app/api/audit-logs/route.ts` | No separate DB-level `BEFORE UPDATE/DELETE` trigger on `audit_logs` yet (service exposes create/read only). |
| **Secrets & Bundle** | `.env` excluded in `.gitignore`; no secrets in `NEXT_PUBLIC_*`; server errors logged without request bodies/passwords/tokens. | `.gitignore`, `src/server/http/errors.ts` | Ensure `SESSION_SECRET` and DB credentials are rotated in production. |

---

## 2. Static & Dependency Audit Status
- `npm audit`: Executed in Phase 5 regression check (see `TEST_REPORT.md`).
- **Pending Live Execution:** Attacker integration test suite (`tests/integration/phase5-security-attack.integration.test.ts`) and Playwright E2E (`tests/e2e/aqar-workflow.spec.ts`) require a running PostgreSQL instance.
