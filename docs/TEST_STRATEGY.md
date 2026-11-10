# Test Strategy

**Project:** Aqar Elite — Multi-Tenant Real Estate Installment Sales System  
**Document ID:** RA-HR-2026-1110-TEST  
**Version:** 1.0  
**Last Updated:** 2026-11-11

---

## 1. Testing Pyramid & Tooling

| Layer | Tool | Target | Database | Command |
|-------|------|--------|----------|---------|
| **Unit Tests** | Vitest (`vitest.config.ts`) | Pure domain logic (`src/domain/*`), Zod schemas (`src/server/validation/*`), helpers | None (pure) | `npm test` |
| **Integration Tests** | Vitest (`vitest.integration.config.ts`) | Services, Repositories, Auth/Session, Concurrency, Transactions, DB Constraints | Real PostgreSQL (never mocks for DB behavior) | `npm run test:integration` |
| **E2E & Visual QA** | Playwright (`playwright.config.ts`) | Full browser flows across roles, RTL layout, responsive viewports (360–1440px), security flows | Real Next.js + Real PostgreSQL | `npm run test:e2e` |
| **Static Checks** | TypeScript & ESLint | Strict types (no `any`), lint rules | N/A | `npm run typecheck`, `npm run lint` |

---

## 2. Critical Test Scenarios

### 2.1 Financial & Date Pure Domain Tests (`tests/unit/`)
- Discount cap: 0%, 5.00% accepted; 5.01%, negative, > unitPrice rejected.
- Final price = `unitPrice - discount`.
- Down payment: 0, partial, full `finalPrice` accepted; negative or `> finalPrice` rejected.
- Installment generation: `100000n / 3` → `[33334n, 33333n, 33333n]`, exact sum invariant across arbitrary primes/counts.
- Date policy: Jan 31 → Feb 28 (non-leap) / Feb 29 (leap) → Mar 31 → Apr 30 → May 31; Dec 31 year rollover; century non-leap 2100.
- Overdue status: UTC date-only boundary; `PAID` never becomes `OVERDUE`; `PARTIAL` past due becomes `OVERDUE`.
- Payment allocation: FIFO oldest unpaid first across multiple installments, partial fill, exact completion, overpayment rejection, zero/negative rejection.
- BigInt string serialization round-trip without precision loss above `Number.MAX_SAFE_INTEGER`.

### 2.2 Auth, Security & Isolation Integration Tests (`tests/integration/`)
- Login valid/invalid credentials with uniform error message (`401`).
- Password hash never returned in responses.
- Session cookie flags (`HttpOnly`, `SameSite=Lax`, `Secure` in production).
- Logout invalidates session in DB; replay of old cookie fails (`401`).
- Expired session rejected (`401`).
- Rate limiting blocks excessive failed attempts.
- Tenant isolation: Company A cannot read/mutate Company B Units, Clients, Reservations, Contracts, Payments, AuditLogs (returns 404/403 without leaking existence).
- Role enforcement & mass assignment / forged `companyId`/`role`/`ownerId` rejection.
- SALES Agent A cannot read/edit/reserve for SALES Agent B's clients.

### 2.3 Concurrency & Transaction Integration Tests (`tests/integration/`)
- **Concurrent Reservations:** 10 simultaneous `Promise.all` reservation attempts for 1 `AVAILABLE` unit → exactly 1 succeeds, 9 fail; DB has 1 `ACTIVE` reservation.
- **Reservation Expiry:** Expired 72h reservation lazily and via expiry job returns unit to `AVAILABLE`; repeated expiry job runs are idempotent.
- **Contract Approval Atomicity:** Approval updates Contract (`APPROVED`), Reservation (`CONVERTED`), Unit (`SOLD`), creates N Installments, writes AuditLog in one transaction; double approval rejected; expired reservation rejected; approved contract immutable.
- **Concurrent Payments & Idempotency:** Duplicate `idempotencyKey` returns original payment without creating duplicate rows; 2 concurrent payments totaling > remaining balance result in at most 1 succeeding (no negative remaining balance).
- **Payment Append-Only:** Service/DB prevents modification or deletion of recorded payments.

### 2.4 Playwright E2E Workflow (`tests/e2e/`)
- Complete end-to-end journey:
  1. Login as SALES agent → create client → reserve available unit (72h shown) → create draft contract.
  2. Logout → login as ACCOUNTANT → approve contract → verify unit becomes `SOLD` and installment schedule appears with exact sum.
  3. Record payment → verify FIFO allocation to oldest installments and updated remaining balance.
- Negative E2E checks: SALES cannot approve contract or record payment; ADMIN can edit unit price + view audit log; RTL `dir="rtl"` and zero horizontal overflow on 360px/390px/768px/1280px/1440px.
