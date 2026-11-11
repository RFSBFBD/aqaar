# Production Deployment Readiness Assessment — Aqar Elite

**Assessment Date:** 2026-11-11  
**Verified Commits:** `b6f8c1f`, `96b1fd7`  
**Assessment Mode:** Read-only inspection (no source, schema, migration, or config modifications)  
**Overall Deployment Status:** **NOT YET DEPLOYED TO PRODUCTION — READY FOR STAGING / PRE-PRODUCTION ONLY AFTER RESOLVING OPERATIONAL GAPS BELOW**

> **Honesty Statement:** The application has been built, migrated, seeded, and verified in a **local Docker Compose HTTP environment** (`http://localhost:3000`, `COOKIE_SECURE=false`, `TRUST_PROXY=false`). It has **not** yet been deployed behind a live TLS/HTTPS reverse proxy in a production-like environment.

---

## Summary Scorecard

| # | Area | Status | Summary |
|---|------|--------|---------|
| 1 | Production Environment Variables & Secret Requirements | **PARTIAL** | `docker-compose.prod.yml` fails fast on missing DB/session secrets, but numeric env vars lack `NaN`/bounds guards and `SESSION_SECRET` is not entropy-checked at runtime. |
| 2 | HTTPS, Reverse Proxy, Secure Cookies & `TRUST_PROXY` | **PARTIAL** | `COOKIE_SECURE="true"` & `TRUST_PROXY=true` enforced in `docker-compose.prod.yml` and unit/config-tested, but no TLS proxy is bundled and live HTTPS proxy behavior is **NOT VERIFIED**. |
| 3 | Docker Production Deployment Procedure | **PARTIAL** | Multi-stage `Dockerfile` runs non-root (`nextjs:nodejs`) with healthchecks; however `devDependencies` remain in `runner` and `docker-compose.yml` binds ports on `0.0.0.0`. |
| 4 | PostgreSQL Persistence, Backup, Restore & Recovery | **PASS** | `aqar_pgdata` named volume + online `pg_dump -Fc` / atomic `pg_restore --single-transaction` verified live against `aqar_restore_verify`; off-host automated backup cron is manual. |
| 5 | Database Migration Procedure During Deployment | **PASS** | `Dockerfile` executes `npx prisma migrate deploy` after `postgres: service_healthy`; verified in container logs (`20261111000000_init`). |
| 6 | Initial Admin Account Provisioning & Credential Security | **FAIL** | `PRODUCTION_RUNBOOK.md` forbids `db:seed` in production, yet no production provisioning CLI script or SQL snippet exists to create the initial company and `ADMIN` user. |
| 7 | Logging, Monitoring, Health Checks & Incident Diagnosis | **PARTIAL** | `/api/health` (`SELECT 1`), Docker healthchecks, safe `handleApiError`, and `AuditLog` exist; lacks structured JSON logs, request IDs, and alerting/log aggregation. |
| 8 | Reservation Expiration Job Scheduling | **PARTIAL** | Functional correctness guaranteed via lazy expiration on all critical paths; `src/server/jobs/expire-reservations.ts` exists but has no active cron/scheduler container. |
| 9 | Session & Login-Attempt Cleanup Scheduling | **FAIL** | `cleanupExpiredSessions()` (`session.ts:100-105`) has no CLI runner/schedule, and `login_attempts` has no cleanup logic or schedule at all (unbounded growth). |
| 10 | Deployment Rollback Strategy | **FAIL** | No documented image-tag rollback or DB pre-migration restore rollback procedure exists in `docs/PRODUCTION_RUNBOOK.md` or `README.md`. |
| 11 | Network Exposure & Firewall Requirements | **FAIL** | `docker-compose.yml` exposes `5432:5432` and `3000:3000` on `0.0.0.0` instead of `127.0.0.1` / internal network, with no documented firewall rules or port override in `docker-compose.prod.yml`. |
| 12 | Outstanding Low-Priority Findings | **PARTIAL** | Intentionally deferred from `INDEPENDENT_ACCEPTANCE_AUDIT.md` §9 (`UnitsWorkspace` filter fetch, `Dockerfile` slimming, `audit_logs` DB trigger, trace doc sync). |

---

## Detailed Findings & Evidence

### 1. Production Environment Variables & Secret Requirements — **PARTIAL**
- **Evidence:**
  - `docker-compose.prod.yml` lines 7–18 use `${VAR:?...}` required interpolation for `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, and `SESSION_SECRET`. Verified via `docker compose -f docker-compose.yml -f docker-compose.prod.yml config` failing fast when unset.
  - `.env.example` lines 1–18 lists all 9 configuration variables (`DATABASE_URL`, `SESSION_SECRET`, `SESSION_MAX_AGE_SECONDS`, `LOGIN_MAX_ATTEMPTS`, `LOGIN_WINDOW_SECONDS`, `TRUST_PROXY`, `COOKIE_SECURE`, `NODE_ENV`, `NEXT_PUBLIC_APP_NAME`).
- **Gaps:**
  - `SESSION_SECRET` is not referenced by `src/server/auth/session.ts` (sessions use CSPRNG `randomBytes(32)` + SHA-256 `tokenHash`), so setting a weak `SESSION_SECRET` is not rejected at app boot.
  - `SESSION_MAX_AGE_SECONDS` (`src/server/auth/session.ts:12`), `LOGIN_MAX_ATTEMPTS`, and `LOGIN_WINDOW_SECONDS` (`src/server/auth/rate-limit.ts:3-4`) use `parseInt(..., 10)` without `Number.isFinite` / `> 0` fallback guards (an invalid non-numeric env string would produce `NaN` expiration dates).

### 2. HTTPS, Reverse Proxy, Secure Cookies & `TRUST_PROXY` — **PARTIAL**
- **Evidence:**
  - `src/server/auth/cookies.ts:1-16` and `src/app/api/auth/logout/route.ts:18-24` share `isSecureCookie()`, enforcing `secure: true` when `COOKIE_SECURE="true"` or `NODE_ENV=production`.
  - `docker-compose.prod.yml:17-18` forces `COOKIE_SECURE: "true"` and defaults `TRUST_PROXY: ${TRUST_PROXY:-true}`.
  - `src/server/http/client-ip.ts:9-24` ignores `X-Forwarded-For` / `X-Real-IP` unless `TRUST_PROXY === 'true'`, verified in `tests/unit/client-ip.test.ts` and live HTTP `429` spoofing test (`TRUST_PROXY=false`).
- **Gaps / Not Verified Live:**
  - No TLS reverse proxy service (Caddy/Nginx/Traefik) is included in Compose; live `HTTPS → proxy → app:3000` with `COOKIE_SECURE=true` and `TRUST_PROXY=true` has **NOT VERIFIED** end-to-end in a production-like environment.

### 3. Docker Production Deployment Procedure — **PARTIAL**
- **Evidence:**
  - `Dockerfile` lines 1–38 use Node 22 Alpine multi-stage build, `npm ci` from lockfile, non-root `nextjs:nodejs` (UID/GID 1001), `EXPOSE 3000`, and `docs/PRODUCTION_RUNBOOK.md` lines 38–52 document deployment steps.
  - Live `aqar-elite-app` (`aqarelite-app`) and `aqar-elite-postgres` (`postgres:16-alpine`) containers observed `Up (healthy)`.
- **Gaps:**
  - `Dockerfile:28` copies all `node_modules` (including `devDependencies`: `typescript`, `eslint`, `vitest`, `@playwright/test`) into the production `runner` stage.
  - `docker-compose.prod.yml` does not override `ports:` from `docker-compose.yml` (see Item 11).

### 4. PostgreSQL Persistence, Backup, Restore & Recovery — **PASS**
- **Evidence:**
  - `docker-compose.yml:11-12,45-46` persists PostgreSQL data in named Docker volume `aqar_pgdata` (`/var/lib/postgresql/data`).
  - `docs/PRODUCTION_RUNBOOK.md:55-91` documents online `pg_dump -Fc` and atomic `pg_restore --no-owner --single-transaction`.
  - Executed live against `aqar-elite-postgres` into scratch DB `aqar_restore_verify`, confirming clean restore of data (`companies=2`) and all 3 active triggers (`triggers=3`), then dropped scratch DB cleanly.
- **Operational Note:** Automated scheduled backups and off-host backup replication remain the operator's responsibility.

### 5. Database Migration Procedure During Deployment — **PASS**
- **Evidence:**
  - `Dockerfile:38` executes `npx prisma migrate deploy && npm run start` after `depends_on: postgres: condition: service_healthy` (`docker-compose.yml:24-26`).
  - Observed in container logs: `Applying migration 20261111000000_init` on first boot and `No pending migrations to apply` on subsequent restarts.
- **Operational Note:** Suitable for single-instance Docker Compose; multi-replica scaling would require moving `prisma migrate deploy` to an external pre-deploy job.

### 6. Initial Admin Account Provisioning & Credential Security — **FAIL**
- **Evidence:**
  - `docs/PRODUCTION_RUNBOOK.md:51` states: *"Do NOT run `npm run db:seed` in production; provision real company/user accounts directly with unique strong passwords."*
  - `prisma/seed.ts:16-143` is hardcoded for local dev evaluation (`SEED_DEFAULT_PASSWORD ?? 'AqarElite!2026'`) and creates demo companies/units/clients.
- **Defect:**
  - No standalone CLI script (e.g., `create-tenant-admin`) or documented SQL/Node provisioning procedure exists to bootstrap the first real `Company` and `ADMIN` / `SALES` / `ACCOUNTANT` accounts in an empty production database.

### 7. Logging, Monitoring, Health Checks & Incident Diagnosis — **PARTIAL**
- **Evidence:**
  - `src/app/api/health/route.ts:6-16` executes `SELECT 1` and returns `200 { status: 'ok', database: 'connected' }` or `503`.
  - `docker-compose.yml:13-17,38-43` configures healthchecks for both `postgres` and `app`.
  - `src/server/http/errors.ts:51-58` logs unexpected errors server-side without exposing internal details to clients; `src/server/services/audit.service.ts` persists business audit trails.
- **Gaps:**
  - Logs are unstructured `console.error` text without timestamps, JSON formatting, request correlation IDs, or log rotation/aggregation configuration (`logging:` driver not set in Compose).

### 8. Reservation Expiration Job Scheduling — **PARTIAL**
- **Evidence:**
  - `src/server/services/reservation-expiry.service.ts` implements atomic, idempotent expiration (`expireOverdueReservations`) invoked lazily before `listUnits`, `getUnitDetail`, `updateUnit`, `listReservations`, `createReservation`, `createContractDraft`, and `approveContract`.
  - `src/server/jobs/expire-reservations.ts:1-24` provides a standalone CLI worker entrypoint.
- **Gap:**
  - Neither `docker-compose.yml` nor `docker-compose.prod.yml` schedules `expire-reservations.ts` (and `src/server/jobs/` is only copied under `src/` without a compiled runner or cron sidecar).

### 9. Session & Login-Attempt Cleanup Scheduling — **FAIL**
- **Evidence:**
  - `src/server/auth/session.ts:100-105` defines `cleanupExpiredSessions()`, and `validateSession()` (`lines 71-74`) lazily deletes an expired session only if that exact token is re-presented.
  - `src/server/auth/rate-limit.ts:9-21` inserts rows into `login_attempts` on every login attempt.
- **Defect:**
  - `cleanupExpiredSessions()` has **zero callers** across the codebase, and `login_attempts` has **no cleanup function or scheduled purge**, causing indefinite table growth in production.

### 10. Deployment Rollback Strategy — **FAIL**
- **Evidence:**
  - Inspected `docs/PRODUCTION_RUNBOOK.md` and `README.md`.
- **Defect:**
  - No rollback procedure exists documenting immutable Docker image tagging (`aqarelite-app:<git-sha>`), pre-deploy database snapshot requirement, or restoring a pre-migration dump if a schema migration fails/regresses.

### 11. Network Exposure & Firewall Requirements — **FAIL**
- **Evidence:**
  - `docker-compose.yml:9-10` binds `- "${POSTGRES_PORT:-5432}:5432"` and `lines 36-37` bind `- "${APP_PORT:-3000}:3000"`, which Docker binds on `0.0.0.0` (all network interfaces) by default.
  - `docker-compose.prod.yml` does not override `ports:` to `127.0.0.1:3000:3000` or remove public host exposure of PostgreSQL `5432`.
- **Defect:**
  - Deploying `docker-compose.yml` + `docker-compose.prod.yml` onto a cloud VM without external host firewall rules exposes PostgreSQL (`5432`) and plain HTTP Next.js (`3000`, where `TRUST_PROXY=true` trusts `X-Forwarded-For`!) directly to the public network. Firewall requirements (allow only `80`/`443` publicly; bind `app` to `127.0.0.1:3000` and remove public `5432` mapping) are not yet enforced or documented.

### 12. Outstanding Low-Priority Findings — **PARTIAL**
- **Evidence:** `docs/INDEPENDENT_ACCEPTANCE_AUDIT.md` §9 records the deferred Low-priority items (`UnitsWorkspace` keystroke filter queries, `Dockerfile` `devDependencies` pruning, `audit_logs` DB immutability trigger, `REQUIREMENTS_TRACEABILITY.md` status sync, plus `SEC-03` nonce CSP). These remain intentionally unimplemented per approved scope.

---

## Prioritized Pre-Production Remediation Checklist (Awaiting Approval)

1. **[Critical/High Ops]** Restrict network bindings in `docker-compose.prod.yml` (bind `app` to `127.0.0.1:3000:3000`, disable host port `5432` exposure with `ports: !reset []`, and document firewall rules allowing only `80/443`).
2. **[High Ops]** Add a safe production provisioning script (`prisma/provision.ts` or documented interactive script) to create real companies and initial `ADMIN`/`SALES`/`ACCOUNTANT` users without `db:seed`.
3. **[Medium Ops]** Add a scheduled maintenance job/script (invoking `cleanupExpiredSessions()`, `login_attempts` TTL cleanup, and `expireOverdueReservations()`).
4. **[Medium Ops]** Document image-tag versioning + pre-migration backup + rollback procedure in `docs/PRODUCTION_RUNBOOK.md`.
5. **[Medium Hardening]** Add `NaN` / positive-integer bounds checks for numeric env vars (`SESSION_MAX_AGE_SECONDS`, `LOGIN_MAX_ATTEMPTS`, `LOGIN_WINDOW_SECONDS`), and verify live staging deployment behind an HTTPS reverse proxy (e.g., Caddy/Nginx) with `COOKIE_SECURE=true` and `TRUST_PROXY=true`.
6. **[Low]** Address deferred Low-priority items from `INDEPENDENT_ACCEPTANCE_AUDIT.md` §9.
