# Domain Rules & Specifications

**Project:** Aqar Elite — Multi-Tenant Real Estate Installment Sales System  
**Document ID:** RA-HR-2026-1110-DOMAIN  
**Version:** 1.0  
**Last Updated:** 2026-11-11

---

## 1. Domain Entities & Tenant Boundaries

Every business entity (except `Session` which inherits tenant via `User`, and `Installment`/`PaymentAllocation` which inherit tenant via `Contract`/`Payment`) carries a non-nullable `companyId` derived exclusively from the authenticated server-side session.

| Entity | Tenant Scoped | Owner / Access Scope | Immutability / Delete Policy |
|--------|---------------|----------------------|------------------------------|
| `Company` | Root Tenant | System-level | `Restrict` on children |
| `User` | `companyId` | Roles: `ADMIN`, `SALES`, `ACCOUNTANT` | Unique `(email, companyId)` |
| `Session` | via `user.companyId` | Owning user | Deleted on logout/expiry |
| `Unit` | `companyId` | Managed by `ADMIN`; readable by all company roles | Unique `(companyId, unitNumber)`. Price immutable when `RESERVED` or `SOLD`. |
| `Client` | `companyId`, `agentId` | Created/edited by owning `SALES` agent; `SALES` sees only own clients; `ADMIN`/`ACCOUNTANT` read-only across company | `Restrict` on reservations/contracts |
| `Reservation` | `companyId`, `agentId` | Created by `SALES` for own client + `AVAILABLE` unit | 72-hour TTL; no manual cancel/extend |
| `Contract` | `companyId`, `createdById` | Drafted by `SALES` from active reservation; approved by `ACCOUNTANT` | Immutable once `APPROVED` |
| `Installment` | via `Contract.companyId` | Generated on contract approval | Balances updated atomically via `Payment` only |
| `Payment` | `companyId` | Recorded by `ACCOUNTANT` only | **Append-only**: no UPDATE or DELETE ever |
| `PaymentAllocation` | via `Payment.companyId` | Created with `Payment` | **Append-only** |
| `AuditLog` | `companyId` | Read-only for `ADMIN` | **Append-only** |

---

## 2. State Machines

### 2.1 Unit State Machine
```
AVAILABLE ──(create reservation)──▶ RESERVED
RESERVED  ──(72h expiry)──────────▶ AVAILABLE
RESERVED  ──(approve contract)────▶ SOLD
```
- **Allowed transitions:**
  - `AVAILABLE → RESERVED`
  - `RESERVED → AVAILABLE`
  - `RESERVED → SOLD`
- **Forbidden:** Direct status updates via generic unit edit endpoints; any transition out of `SOLD`; `AVAILABLE → SOLD` skipping reservation.

### 2.2 Reservation State Machine
```
ACTIVE ──(72h elapsed)─────────▶ EXPIRED
ACTIVE ──(contract approved)───▶ CONVERTED
```
- **TTL:** Exactly 72 hours (`expiresAt = createdAt + 72 * 60 * 60 * 1000` ms in UTC).
- **Allowed transitions:**
  - `ACTIVE → EXPIRED` (returns Unit from `RESERVED` to `AVAILABLE`)
  - `ACTIVE → CONVERTED` (when Contract is approved and Unit becomes `SOLD`)
- **Constraint:** At most **one** `ACTIVE` reservation may exist per `unitId` at any point in time (enforced via PostgreSQL partial unique index `WHERE status = 'ACTIVE'` AND transactional row-level locking).

### 2.3 Contract State Machine
```
DRAFT ──(accountant approves)──▶ APPROVED (immutable)
```
- **Allowed transitions:** `DRAFT → APPROVED` only (by `ACCOUNTANT`).
- **Immutability:** Once `APPROVED`, no field on `Contract` may be modified, and `approve` cannot be run twice.

### 2.4 Installment Status Lifecycle
Stored base status: `PENDING` | `PARTIAL` | `PAID` (and `OVERDUE` if persisted, or derived).
- `PAID`: `paidAmount >= amount` (takes precedence over `OVERDUE` — a paid installment is NEVER overdue).
- `OVERDUE`: `paidAmount < amount` AND current UTC calendar date `> dueDate` UTC calendar date.
- `PARTIAL`: `0 < paidAmount < amount` AND not overdue.
- `PENDING`: `paidAmount === 0` AND not overdue.

---

## 3. Financial Rules (Integer Minor Units Only)

All monetary amounts use `BigInt` representing minor currency units (e.g., 100 minor units = 1.00 major unit). Floating-point (`number`) arithmetic is strictly forbidden. API JSON responses serialize `BigInt` amounts as decimal strings.

1. **Discount Cap (5%):**
   - `0 <= discount <= (unitPrice * 5n) / 100n`
   - Equivalently, `finalPrice >= unitPrice - (unitPrice * 5n) / 100n` and `finalPrice <= unitPrice`.
   - Example: `unitPrice = 100_000n` → `maxDiscount = 5_000n` (5.00%). `5_001n` (5.001%) is rejected.
2. **Final Price:**
   - `finalPrice = unitPrice - discount`
3. **Down Payment Bounds:**
   - `0n <= downPayment <= finalPrice`
4. **Remaining Amount:**
   - `remainingAmount = finalPrice - downPayment`
5. **Installment Generation & Deterministic Remainder Distribution:**
   - Given `remainingAmount >= 0n` and `count > 0`:
   - `base = remainingAmount / BigInt(count)` (integer division)
   - `remainder = Number(remainingAmount % BigInt(count))`
   - Installments `1..remainder` receive `base + 1n`; installments `(remainder+1)..count` receive `base`.
   - **Invariant:** `sum(installment.amount) === remainingAmount` always.
   - Example: `100_000n` across `3` installments → `[33_334n, 33_333n, 33_333n]`, sum = `100_000n`.
6. **Payment Validation & Allocation (FIFO):**
   - `paymentAmount > 0n`
   - `paymentAmount <= totalContractRemaining` (sum of `amount - paidAmount` across all installments of the contract). Overpayments are rejected.
   - Allocation iterates installments ordered by `sequenceNumber ASC` (oldest unpaid first), allocating `min(remainingPayment, installmentUnpaid)` to each until `remainingPayment === 0n`.
   - **Invariant:** `sum(allocations.amount) === payment.amount`.
7. **Idempotency:**
   - Every payment request requires an `idempotencyKey`. Unique constraint `(companyId, idempotencyKey)` guarantees replay requests return the original payment result without creating a second payment.

---

## 4. Date Rules (Jan 31 Clamping Policy)

All contract start dates and installment due dates are evaluated in **UTC** at date granularity.

- **Policy:** Monthly anniversary anchored to `baseDay = startDate.getUTCDate()`.
- For installment index `k` (`1..count`), advance `k` calendar months from `(startYear, startMonth)` and set `day = Math.min(baseDay, daysInMonth(targetYear, targetMonth))`.
- Because `baseDay` is never overwritten by a clamped month, the anchor recovers in longer months:
  - Start `2025-01-31` → `#1: 2025-02-28`, `#2: 2025-03-31`, `#3: 2025-04-30`, `#4: 2025-05-31`.
  - Start `2024-01-31` (leap year) → `#1: 2024-02-29`, `#2: 2024-03-31`, `#3: 2024-04-30`.
  - Start `2025-12-31` → `#1: 2026-01-31`, `#2: 2026-02-28`.

---

## 5. Concurrency & Atomicity Design

### 5.1 Concurrent Reservations
- Single PostgreSQL transaction:
  1. **Lazy expiry** for the target `unitId`: if an `ACTIVE` reservation exists with `expiresAt <= now`, atomically mark it `EXPIRED` and reset unit `RESERVED -> AVAILABLE`.
  2. **Row-level lock + conditional update:** Lock unit row (`SELECT ... FROM units WHERE id = $1 AND company_id = $2 FOR UPDATE`) and verify `status = 'AVAILABLE'`, or execute conditional `UPDATE units SET status = 'RESERVED' WHERE id = $1 AND company_id = $2 AND status = 'AVAILABLE'` checking affected row count === 1.
  3. Insert `Reservation` (`status = 'ACTIVE'`, `expiresAt = now + 72h`).
  4. **DB Safety Net:** Partial unique index `CREATE UNIQUE INDEX reservations_one_active_per_unit ON reservations (unit_id) WHERE status = 'ACTIVE';`.
- Result: Under 10 parallel requests for the same unit, exactly 1 succeeds and 9 fail cleanly with `409 Conflict`.

### 5.2 Contract Approval Atomicity
- Single PostgreSQL transaction locking the `Contract` (`FOR UPDATE`), `Reservation`, and `Unit`:
  - Re-verify `contract.status === 'DRAFT'`, `reservation.status === 'ACTIVE' && reservation.expiresAt > now`, `unit.status === 'RESERVED'`.
  - Generate and insert all `Installment` records.
  - Update `contract` → `APPROVED` (with `approvedById`, `approvedAt`), `reservation` → `CONVERTED`, `unit` → `SOLD`, and write `AuditLog`.
  - Any failure rolls back the entire transaction.

### 5.3 Concurrent Payments
- Single PostgreSQL transaction:
  1. Check existing payment by `(companyId, idempotencyKey)`; if found, return existing payment + allocations idempotently.
  2. Lock the `Contract` row (`SELECT id FROM contracts WHERE id = $1 AND company_id = $2 FOR UPDATE`) to serialize concurrent payments on the same contract.
  3. Re-read contract installments, compute `totalRemaining`, reject if `amount > totalRemaining`.
  4. Handle PostgreSQL unique violation (`23505`) on `(companyId, idempotencyKey)` safely in case of simultaneous identical key requests.
  5. Insert `Payment`, `PaymentAllocation`s, update `Installment.paidAmount`/`status`, and insert `AuditLog`.

### 5.4 Reservation Expiry Worker & Lazy Expiry
- **Lazy Expiry:** Executed before unit listing/detail reads, reservation creation, contract drafting, and contract approval so expired reservations never block operations even if a background ticker is delayed.
- **Idempotent Expiry Job:** Can be invoked repeatedly (`expireOverdueReservations()`), using conditional updates inside a transaction (`UPDATE reservations SET status = 'EXPIRED' WHERE status = 'ACTIVE' AND expires_at <= now` returning `unitId`s, then updating those units `WHERE status = 'RESERVED'` to `'AVAILABLE'`).

---

## 6. Tenant Isolation & Authorization Matrix

`companyId` is always taken from `getTenantContext()` (server-side session). Client-supplied `companyId`, `userId`, `agentId`, `role`, or `approvedById` are rejected/ignored.

| Operation | ADMIN | SALES | ACCOUNTANT |
|-----------|-------|-------|------------|
| View Units | Company | Company | Company |
| Create / Edit Unit / Price | Yes (price edit only if `AVAILABLE`) | No (403) | No (403) |
| View Clients | Company | Own (`agentId = userId`) only | Company |
| Create / Edit Client | No (403) | Yes (own only) | No (403) |
| Create Reservation | No (403) | Yes (own client, company unit) | No (403) |
| Create Contract Draft | No (403) | Yes (own active reservation) | No (403) |
| Approve Contract | No (403) | No (403) | Yes (403 others) |
| Record Payment | No (403) | No (403) | Yes (403 others) |
| View Audit Log | Company | No (403) | No (403) |
