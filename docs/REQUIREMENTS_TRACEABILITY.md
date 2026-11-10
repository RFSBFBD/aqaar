# Requirements Traceability Matrix

**Document ID:** RA-HR-2026-1110  
**Project:** Aqar Elite — Multi-Tenant Real Estate Installment Sales System  
**Version:** 1.0  
**Last Updated:** 2026-11-10  
**Status:** Phase 0 — Planning

---

## Purpose

This document maps every functional and non-functional requirement from specification **RA-HR-2026-1110** to its implementation artifact and test artifact. It serves as the single source of truth for requirement coverage throughout the project lifecycle.

## Status Legend

| Status | Meaning |
|--------|---------|
| **Pending** | Not yet started |
| **In Progress** | Implementation underway |
| **Implemented** | Code complete, awaiting tests |
| **Tested** | Implementation complete with passing tests |
| **Verified** | Reviewed and accepted |

---

## Core System Requirements

| ID | Requirement | Category | Priority | Implementation File | Test File | Status |
|----|------------|----------|----------|---------------------|-----------|--------|
| REQ-001 | Multi-tenant system — each company isolated with separate data boundaries | Core | Mandatory | `src/lib/auth/session.ts`, `prisma/schema.prisma` | `tests/integration/tenant-isolation.test.ts` | Pending |
| REQ-002 | Role-based access control: ADMIN, SALES, ACCOUNTANT roles with distinct permissions | Core | Mandatory | `src/lib/auth/rbac.ts`, `src/middleware.ts` | `tests/unit/rbac.test.ts`, `tests/e2e/role-access.spec.ts` | Pending |

## Authentication Requirements

| ID | Requirement | Category | Priority | Implementation File | Test File | Status |
|----|------------|----------|----------|---------------------|-----------|--------|
| REQ-003 | Login/Logout only — no signup flow, no user management UI | Auth | Mandatory | `src/app/login/page.tsx`, `src/app/api/auth/login/route.ts`, `src/app/api/auth/logout/route.ts` | `tests/e2e/auth.spec.ts` | Pending |
| REQ-004 | Password hashing with Argon2id (primary) or bcrypt (fallback) | Auth | Mandatory | `src/lib/auth/password.ts` | `tests/unit/password.test.ts` | Pending |
| REQ-005 | Session cookies: HttpOnly, Secure, SameSite=Lax | Auth | Mandatory | `src/lib/auth/session.ts` | `tests/integration/session-cookies.test.ts` | Pending |
| REQ-006 | No tokens stored in localStorage — cookie-only authentication | Auth | Mandatory | `src/lib/auth/session.ts` | `tests/e2e/no-localstorage-tokens.spec.ts` | Pending |
| REQ-007 | Session expiration with configurable TTL and server-side invalidation on logout | Auth | Mandatory | `src/lib/auth/session.ts`, `src/app/api/auth/logout/route.ts` | `tests/integration/session-expiry.test.ts` | Pending |
| REQ-008 | Generic login error messages — do not reveal whether email exists | Auth | Mandatory | `src/app/api/auth/login/route.ts` | `tests/integration/login-errors.test.ts` | Pending |
| REQ-009 | Rate limiting for login attempts — per-IP and per-account throttling | Auth | Mandatory | `src/lib/auth/rate-limiter.ts`, `src/app/api/auth/login/route.ts` | `tests/integration/rate-limiting.test.ts` | Pending |

## Security Requirements

| ID | Requirement | Category | Priority | Implementation File | Test File | Status |
|----|------------|----------|----------|---------------------|-----------|--------|
| REQ-010 | CSRF protection on all state-mutating requests | Security | Mandatory | `src/middleware.ts`, `src/lib/csrf.ts` | `tests/integration/csrf.test.ts` | Pending |
| REQ-054 | Tenant isolation: companyId derived exclusively from server session, never from client input | Security | Mandatory | `src/lib/auth/session.ts`, `src/server/context.ts` | `tests/integration/tenant-isolation.test.ts` | Pending |
| REQ-055 | All database queries scoped by companyId — no unscoped data access | Security | Mandatory | `src/server/repositories/*.ts` | `tests/integration/query-scoping.test.ts` | Pending |
| REQ-056 | Ownership verification for nested/related resources (e.g., installment → contract → company) | Security | Mandatory | `src/server/services/*.ts` | `tests/integration/ownership-verification.test.ts` | Pending |

## Unit Management Requirements

| ID | Requirement | Category | Priority | Implementation File | Test File | Status |
|----|------------|----------|----------|---------------------|-----------|--------|
| REQ-011 | Units CRUD operations restricted to ADMIN role only | Units | Mandatory | `src/server/services/unit.service.ts`, `src/app/api/units/route.ts` | `tests/integration/unit-crud.test.ts`, `tests/e2e/unit-management.spec.ts` | Pending |
| REQ-012 | Unit fields: projectName, unitNumber, type, area (m²), rooms, price (BigInt minor units) | Units | Mandatory | `prisma/schema.prisma`, `src/server/schemas/unit.schema.ts` | `tests/unit/unit-validation.test.ts` | Pending |
| REQ-013 | Unit status lifecycle: available → reserved → sold | Units | Mandatory | `src/domain/unit-status.ts` | `tests/unit/unit-status.test.ts` | Pending |
| REQ-014 | Server-side filtering by status (enum) and price range (min/max BigInt) | Units | Mandatory | `src/server/repositories/unit.repository.ts` | `tests/integration/unit-filtering.test.ts` | Pending |
| REQ-015 | Server-side pagination with cursor-based or offset-based strategy | Units | Mandatory | `src/server/repositories/unit.repository.ts` | `tests/integration/unit-pagination.test.ts` | Pending |
| REQ-016 | Sorting restricted to allowlisted columns only: price, area | Units | Mandatory | `src/server/schemas/unit.schema.ts`, `src/server/repositories/unit.repository.ts` | `tests/unit/unit-sort-allowlist.test.ts` | Pending |
| REQ-017 | Price editing prohibited on units with status reserved or sold | Units | Mandatory | `src/server/services/unit.service.ts` | `tests/unit/unit-price-lock.test.ts` | Pending |
| REQ-018 | Audit log entry created for every unit price change (old value, new value, actor, timestamp) | Units | Mandatory | `src/server/services/unit.service.ts`, `src/server/services/audit.service.ts` | `tests/integration/price-audit.test.ts` | Pending |
| REQ-019 | Unit status transitions only via domain operations (reservation, contract approval), never direct UPDATE | Units | Mandatory | `src/domain/unit-status.ts`, `src/server/services/unit.service.ts` | `tests/unit/unit-status-transitions.test.ts` | Pending |

## Client Management Requirements

| ID | Requirement | Category | Priority | Implementation File | Test File | Status |
|----|------------|----------|----------|---------------------|-----------|--------|
| REQ-020 | Clients created exclusively by users with SALES role | Clients | Mandatory | `src/server/services/client.service.ts`, `src/app/api/clients/route.ts` | `tests/integration/client-creation.test.ts` | Pending |
| REQ-021 | Client fields: name (string, required), phone (string, required), notes (text, optional) | Clients | Mandatory | `prisma/schema.prisma`, `src/server/schemas/client.schema.ts` | `tests/unit/client-validation.test.ts` | Pending |
| REQ-022 | SALES agent visibility restricted to own clients only (agentId filter) | Clients | Mandatory | `src/server/repositories/client.repository.ts` | `tests/integration/client-visibility.test.ts` | Pending |
| REQ-023 | ACCOUNTANT role has read-only access to clients — no create, update, or delete | Clients | Mandatory | `src/server/services/client.service.ts` | `tests/integration/accountant-client-readonly.test.ts` | Pending |

## Reservation Requirements

| ID | Requirement | Category | Priority | Implementation File | Test File | Status |
|----|------------|----------|----------|---------------------|-----------|--------|
| REQ-024 | 72-hour reservation created by SALES agent, linking client and available unit | Reservations | Mandatory | `src/server/services/reservation.service.ts` | `tests/integration/reservation-creation.test.ts` | Pending |
| REQ-025 | Auto-expiry: expired reservations return unit status to available (cron or lazy evaluation) | Reservations | Mandatory | `src/server/services/reservation.service.ts`, `src/server/jobs/reservation-expiry.ts` | `tests/integration/reservation-expiry.test.ts` | Pending |
| REQ-026 | Concurrent reservation prevention — only one concurrent attempt per unit succeeds | Reservations | Mandatory | `src/server/services/reservation.service.ts` | `tests/integration/concurrent-reservation.test.ts` | Pending |
| REQ-027 | Reservation creation is atomic: reservation record + unit status change in single transaction | Reservations | Mandatory | `src/server/services/reservation.service.ts` | `tests/integration/reservation-atomicity.test.ts` | Pending |
| REQ-028 | No duplicate active reservations per unit — database constraint or application check | Reservations | Mandatory | `prisma/schema.prisma`, `src/server/services/reservation.service.ts` | `tests/integration/duplicate-reservation.test.ts` | Pending |

## Contract Requirements

| ID | Requirement | Category | Priority | Implementation File | Test File | Status |
|----|------------|----------|----------|---------------------|-----------|--------|
| REQ-029 | Contract draft created from active reservation by SALES agent | Contracts | Mandatory | `src/server/services/contract.service.ts` | `tests/integration/contract-draft.test.ts` | Pending |
| REQ-030 | Discount capped at maximum 5% of the unit price | Contracts | Mandatory | `src/domain/financial.ts`, `src/server/schemas/contract.schema.ts` | `tests/unit/discount-cap.test.ts` | Pending |
| REQ-031 | Final price calculated as: unitPrice − discount (in minor units) | Contracts | Mandatory | `src/domain/financial.ts` | `tests/unit/final-price.test.ts` | Pending |
| REQ-032 | Down payment constrained: 0 ≤ downPayment ≤ finalPrice | Contracts | Mandatory | `src/domain/financial.ts`, `src/server/schemas/contract.schema.ts` | `tests/unit/down-payment.test.ts` | Pending |
| REQ-033 | Contract approval restricted to ACCOUNTANT role only | Contracts | Mandatory | `src/server/services/contract.service.ts` | `tests/integration/contract-approval-role.test.ts` | Pending |
| REQ-034 | Approval is atomic: contract→approved + unit→sold + generate installments in single transaction | Contracts | Mandatory | `src/server/services/contract.service.ts` | `tests/integration/contract-approval-atomic.test.ts` | Pending |
| REQ-035 | Approved contracts are immutable — no field modifications after approval | Contracts | Mandatory | `src/server/services/contract.service.ts` | `tests/integration/contract-immutability.test.ts` | Pending |
| REQ-036 | Double approval prevention — already-approved contracts cannot be approved again | Contracts | Mandatory | `src/server/services/contract.service.ts` | `tests/integration/double-approval.test.ts` | Pending |

## Installment Requirements

| ID | Requirement | Category | Priority | Implementation File | Test File | Status |
|----|------------|----------|----------|---------------------|-----------|--------|
| REQ-037 | Installment generation: amount = remaining ÷ count (integer division), remainder distributed to first N installments (+1 each) | Installments | Mandatory | `src/domain/installment-generator.ts` | `tests/unit/installment-generation.test.ts` | Pending |
| REQ-038 | Invariant: sum of all installment amounts = remaining amount (exactly, zero error) | Installments | Mandatory | `src/domain/installment-generator.ts` | `tests/unit/installment-sum-invariant.test.ts` | Pending |
| REQ-039 | Monthly due dates with end-of-month clamping — base day preserved across months (Jan 31 → Feb 28/29 → Mar 31 → Apr 30) | Installments | Mandatory | `src/domain/date-utils.ts` | `tests/unit/date-generation.test.ts` | Pending |

## Financial Calculation Requirements

| ID | Requirement | Category | Priority | Implementation File | Test File | Status |
|----|------------|----------|----------|---------------------|-----------|--------|
| REQ-040 | No IEEE 754 float or JavaScript `number` type for financial calculations — integer arithmetic only | Financial | Mandatory | `src/domain/financial.ts` | `tests/unit/financial-no-float.test.ts` | Pending |
| REQ-041 | All monetary amounts stored and computed as BigInt in minor units (fils/cents) | Financial | Mandatory | `prisma/schema.prisma`, `src/domain/financial.ts` | `tests/unit/bigint-amounts.test.ts` | Pending |

## Payment Requirements

| ID | Requirement | Category | Priority | Implementation File | Test File | Status |
|----|------------|----------|----------|---------------------|-----------|--------|
| REQ-042 | Payment recording restricted to ACCOUNTANT role only | Payments | Mandatory | `src/server/services/payment.service.ts` | `tests/integration/payment-role.test.ts` | Pending |
| REQ-043 | Payment amount must be positive and must not exceed the remaining contract balance | Payments | Mandatory | `src/server/schemas/payment.schema.ts`, `src/server/services/payment.service.ts` | `tests/unit/payment-validation.test.ts` | Pending |
| REQ-044 | Payment allocation follows FIFO: allocated to oldest unpaid/partial installments first | Payments | Mandatory | `src/domain/payment-allocator.ts` | `tests/unit/payment-allocation.test.ts` | Pending |
| REQ-045 | Installment status lifecycle: pending → partial → paid; overdue derived from due date | Payments | Mandatory | `src/domain/installment-status.ts` | `tests/unit/installment-status.test.ts` | Pending |
| REQ-046 | Payments are append-only — no UPDATE or DELETE operations permitted | Payments | Mandatory | `src/server/services/payment.service.ts`, `src/server/repositories/payment.repository.ts` | `tests/integration/payment-append-only.test.ts` | Pending |
| REQ-047 | Payment recording is atomic: payment + allocation + installment balance update in single transaction | Payments | Mandatory | `src/server/services/payment.service.ts` | `tests/integration/payment-atomicity.test.ts` | Pending |
| REQ-048 | Idempotency key on payment creation to prevent duplicate submissions | Payments | Mandatory | `src/server/services/payment.service.ts`, `prisma/schema.prisma` | `tests/integration/payment-idempotency.test.ts` | Pending |
| REQ-049 | Concurrent payment handling — database-level locking prevents overpayment race conditions | Payments | Mandatory | `src/server/services/payment.service.ts` | `tests/integration/concurrent-payment.test.ts` | Pending |

## Audit Requirements

| ID | Requirement | Category | Priority | Implementation File | Test File | Status |
|----|------------|----------|----------|---------------------|-----------|--------|
| REQ-050 | Audit log for important events: login, price change, reservation, approval, payment | Audit | Mandatory | `src/server/services/audit.service.ts`, `prisma/schema.prisma` | `tests/integration/audit-logging.test.ts` | Pending |

## UI Requirements

| ID | Requirement | Category | Priority | Implementation File | Test File | Status |
|----|------------|----------|----------|---------------------|-----------|--------|
| REQ-051 | Arabic RTL responsive frontend with proper bidirectional text support | UI | Mandatory | `src/app/layout.tsx`, `src/app/globals.css` | `tests/e2e/rtl-layout.spec.ts` | Pending |

## DevOps Requirements

| ID | Requirement | Category | Priority | Implementation File | Test File | Status |
|----|------------|----------|----------|---------------------|-----------|--------|
| REQ-052 | Docker Compose deployment: app + PostgreSQL + optional services | DevOps | Mandatory | `docker-compose.yml`, `Dockerfile` | `tests/e2e/docker-deployment.spec.ts` | Pending |
| REQ-053 | GitHub private repo with comprehensive README covering setup, architecture, and usage | DevOps | Mandatory | `README.md` | Manual review | Pending |

## Out of Scope

| ID | Requirement | Category | Priority | Implementation File | Test File | Status |
|----|------------|----------|----------|---------------------|-----------|--------|
| REQ-057 | Explicitly excluded: CRM features, dashboard statistics, data export, file upload, user management UI, password recovery, contract cancellation | Out of Scope | N/A | N/A | N/A | N/A |

---

## Traceability Summary

| Category | Total | Pending | In Progress | Implemented | Tested | Verified |
|----------|-------|---------|-------------|-------------|--------|----------|
| Core | 2 | 2 | 0 | 0 | 0 | 0 |
| Auth | 7 | 7 | 0 | 0 | 0 | 0 |
| Security | 4 | 4 | 0 | 0 | 0 | 0 |
| Units | 9 | 9 | 0 | 0 | 0 | 0 |
| Clients | 4 | 4 | 0 | 0 | 0 | 0 |
| Reservations | 5 | 5 | 0 | 0 | 0 | 0 |
| Contracts | 8 | 8 | 0 | 0 | 0 | 0 |
| Installments | 3 | 3 | 0 | 0 | 0 | 0 |
| Financial | 2 | 2 | 0 | 0 | 0 | 0 |
| Payments | 8 | 8 | 0 | 0 | 0 | 0 |
| Audit | 1 | 1 | 0 | 0 | 0 | 0 |
| UI | 1 | 1 | 0 | 0 | 0 | 0 |
| DevOps | 2 | 2 | 0 | 0 | 0 | 0 |
| Out of Scope | 1 | — | — | — | — | — |
| **Total** | **57** | **56** | **0** | **0** | **0** | **0** |

---

## Change Log

| Date | Version | Author | Description |
|------|---------|--------|-------------|
| 2026-11-10 | 1.0 | System Architect | Initial requirements traceability matrix |
