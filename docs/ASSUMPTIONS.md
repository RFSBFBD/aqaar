# Project Assumptions

**Project:** Aqar Elite — Multi-Tenant Real Estate Installment Sales System  
**Document ID:** RA-HR-2026-1110-ASSUMPTIONS  
**Version:** 1.0  
**Last Updated:** 2026-11-10

---

## Purpose

This document records all assumptions made during the design and implementation of the Aqar Elite system. Each assumption has been reviewed and accepted by the project stakeholders. Any change to these assumptions requires a formal review and may impact the implementation plan.

---

## 1. Date and Time Assumptions

### 1.1 End-of-Month Date Policy (Installment Due Dates)

**Assumption:** Installment due dates follow a monthly anniversary model with end-of-month clamping. The system preserves the original base day from the contract start date and clamps to the last day of the month when the base day exceeds the month's length.

**Rationale:** Real estate installment contracts typically use monthly intervals. A consistent and deterministic date policy avoids ambiguity and ensures all parties agree on payment schedules.

**Examples:**

| Installment # | Base Day = 31 | Base Day = 29 | Base Day = 15 |
|---------------|---------------|---------------|---------------|
| 1 (Jan) | Jan 31 | Jan 29 | Jan 15 |
| 2 (Feb) | Feb 28* | Feb 28* | Feb 15 |
| 3 (Mar) | Mar 31 | Mar 29 | Mar 15 |
| 4 (Apr) | Apr 30 | Apr 29 | Apr 15 |
| 5 (May) | May 31 | May 29 | May 15 |
| 6 (Jun) | Jun 30 | Jun 29 | Jun 15 |

*\* Feb 29 in leap years*

**Key Rule:** The base day is **always preserved** from the original contract start date. The system does not "lose" the base day after clamping. For example, if base day = 31 and February clamps to 28, March still returns to 31.

### 1.2 Leap Year Handling

**Assumption:** The system correctly handles leap years. When the base day is 29 or higher and the month is February:
- **Leap year:** February 29
- **Non-leap year:** February 28

**Rationale:** Standard Gregorian calendar rules apply. The system uses well-tested date arithmetic rather than manual leap year calculations.

### 1.3 Timezone Policy

**Assumption:** All server-side date calculations, storage, and comparisons use UTC. The database stores timestamps in UTC. The frontend may display localized dates for user convenience but all business logic operates on UTC.

**Rationale:** Eliminates daylight saving time ambiguities and ensures consistent date comparisons across all server operations, especially for reservation expiry (72-hour window) and installment overdue checks.

---

## 2. Financial Assumptions

### 2.1 Currency Representation

**Assumption:** All monetary amounts are stored and computed as integers in **minor units** (e.g., fils, cents, piastres). The system does not enforce a specific currency code (e.g., SAR, EGP, AED). A single currency is assumed per deployment — multi-currency is out of scope.

**Rationale:** Integer arithmetic in minor units eliminates floating-point precision errors that are unacceptable in financial applications. The lack of a currency code assumption allows the system to be deployed across different regions without code changes.

### 2.2 No Floating-Point Financial Values

**Assumption:** JavaScript `number` (IEEE 754 double) is never used for financial calculations or storage. All financial arithmetic uses `BigInt` in TypeScript. Prisma maps `Decimal` or `BigInt` columns to TypeScript `BigInt` or string for safe handling.

**Rationale:** IEEE 754 cannot exactly represent many decimal fractions (e.g., `0.1 + 0.2 !== 0.3`). In a system where exact-to-the-fils accounting is required, any rounding error is a correctness bug.

### 2.3 Installment Remainder Distribution

**Assumption:** When the remaining amount after down payment is not evenly divisible by the number of installments, the remainder is distributed by adding +1 minor unit to the **first N installments** (where N = remaining mod count). This is deterministic and always produces a total sum exactly equal to the remaining amount.

**Example:**
- Remaining: 10,007 fils, Count: 3
- Base installment: 10,007 ÷ 3 = 3,335 (integer division)
- Remainder: 10,007 mod 3 = 2
- Result: [3,336 | 3,336 | 3,335] = 10,007 ✓

---

## 3. Authentication and Session Assumptions

### 3.1 No Self-Service User Management

**Assumption:** The system provides **login and logout only**. There is no user registration, no password recovery, no email verification, and no user management UI. Users are provisioned via database seeding or direct database operations by a system administrator.

**Rationale:** The specification explicitly excludes user management features. This keeps the authentication surface minimal and reduces attack vectors.

### 3.2 Seed Passwords

**Assumption:** Seed data includes pre-hashed passwords for testing and development environments only. These passwords (e.g., `Password123!`) are **not suitable for production** and must be changed before any production deployment.

**Rationale:** Seed data enables rapid development and testing. Production deployments require an administrator to set secure passwords via database operations.

### 3.3 Session Storage

**Assumption:** Sessions are stored in the database (PostgreSQL) with hashed session tokens. The raw token is sent to the client as an HttpOnly cookie; only the hash is persisted server-side. This means a database breach does not directly expose session tokens.

**Rationale:** Database-backed sessions allow server-side invalidation (logout, force-expire) and support multi-tenant session scoping. Hashing tokens at rest is a defense-in-depth measure.

---

## 4. Authorization Assumptions

### 4.1 Role Visibility Rules

**Assumption:** The following visibility rules apply to client records:

| Role | Can See | Can Create | Can Edit |
|------|---------|------------|----------|
| **ADMIN** | All clients in their company | No | No |
| **SALES** | Own clients only (agentId = userId) | Yes | Yes (own only) |
| **ACCOUNTANT** | All clients in their company | No | No |

**Rationale:** ADMIN needs full visibility for oversight. SALES agents are sandboxed to their own clients for competitive isolation. ACCOUNTANT needs read access for contract and payment processing but has no business reason to modify client data.

### 4.2 Role Assignment

**Assumption:** User roles are assigned at the database level and cannot be changed through the application UI. Role changes require direct database modification by a system administrator.

**Rationale:** No user management UI is in scope. Role assignment is a privileged administrative operation.

---

## 5. Reservation Assumptions

### 5.1 No Manual Cancellation or Extension

**Assumption:** Reservations cannot be manually cancelled or extended by any user. A reservation either:
1. **Expires** after 72 hours, returning the unit to `available` status, or
2. **Converts** to a contract when the SALES agent creates a draft contract from it.

**Rationale:** The specification does not include reservation cancellation or extension features. This simplifies the state machine and prevents abuse of the reservation system.

### 5.2 Reservation Expiry Mechanism

**Assumption:** Reservation expiry is handled via **lazy evaluation** (checked on access) supplemented by an optional **background job** (cron/scheduled task). The system does not rely solely on a background job for correctness — any query that reads unit status also checks for expired reservations.

**Rationale:** Lazy evaluation ensures correctness even if the background job fails or is delayed. The background job improves user experience by proactively updating stale data.

---

## 6. Installment Overdue Status

### 6.1 Derived Status

**Assumption:** The `overdue` status of an installment is **derived at query time**, not stored as a persistent status in the database. An installment is overdue when:
- Its due date is in the past (compared to current UTC time), AND
- Its remaining balance is greater than zero (not fully paid)

**Rationale:** Storing overdue as a persistent status would require a background job to update it daily, creating a window of inconsistency. Deriving it at query time is always accurate and requires no maintenance.

### 6.2 Installment Status Values

**Assumption:** The stored installment statuses are:
- **pending** — no payment applied, full balance remaining
- **partial** — some payment applied, balance remaining > 0
- **paid** — fully paid, balance = 0

The **overdue** status is a virtual/computed status layered on top of `pending` or `partial` when the due date has passed.

---

## 7. Multi-Tenancy Assumptions

### 7.1 Tenant Isolation Model

**Assumption:** The system uses **shared database, shared schema** multi-tenancy with a `companyId` discriminator column on all tenant-scoped tables. This is a logical isolation model, not physical.

**Rationale:** Shared-schema multi-tenancy is simpler to deploy and maintain than schema-per-tenant or database-per-tenant models. The system enforces isolation at the application and query level.

### 7.2 CompanyId Source

**Assumption:** The `companyId` is **never accepted from client input** (request body, query parameters, URL path, headers). It is always derived from the authenticated user's server-side session record.

**Rationale:** Accepting tenant identifiers from client input is a critical vulnerability that enables cross-tenant data access. Server-side derivation eliminates this attack vector entirely.

---

## 8. Infrastructure Assumptions

### 8.1 Single Database

**Assumption:** The system uses a single PostgreSQL database instance for all tenants, application data, and sessions. There is no read replica, no connection pooling layer (beyond Prisma's built-in), and no caching layer (Redis, etc.) in the initial deployment.

**Rationale:** The specification targets a Docker Compose deployment model. A single-database architecture is appropriate for the expected scale and simplifies deployment.

### 8.2 Docker Compose Deployment

**Assumption:** The production deployment target is Docker Compose with at minimum two services: the Next.js application and PostgreSQL. No external load balancer, reverse proxy, or orchestration platform (Kubernetes) is required.

**Rationale:** Docker Compose is explicitly specified as the deployment mechanism. This assumption may be revisited if scaling requirements change.

### 8.3 Environment Variables

**Assumption:** All secrets and configuration (database URL, session secret, Argon2 parameters) are provided via environment variables or a `.env` file. No external secrets manager is used.

---

## 9. Data Assumptions

### 9.1 No Data Migration

**Assumption:** The system starts with an empty database (plus seed data). There is no requirement to migrate data from an existing system.

### 9.2 Soft Delete

**Assumption:** The system does **not implement soft delete** for any entity unless explicitly required. Deleting a unit in `available` status is a hard delete. Units in `reserved` or `sold` status cannot be deleted.

### 9.3 Audit Log Retention

**Assumption:** Audit log entries are retained indefinitely. There is no archival or purging strategy in the initial implementation.

---

## Change Log

| Date | Version | Author | Description |
|------|---------|--------|-------------|
| 2026-11-10 | 1.0 | System Architect | Initial assumptions document |
