# Architecture Decision Records (ADRs)

**Project:** Aqar Elite — Multi-Tenant Real Estate Installment Sales System  
**Document ID:** RA-HR-2026-1110-ADR  
**Version:** 1.0  
**Last Updated:** 2026-11-10

---

## ADR Index

| ADR | Title | Status |
|-----|-------|--------|
| [ADR-001](#adr-001-nextjs-app-router-with-typescript-strict) | Next.js App Router with TypeScript Strict | Accepted |
| [ADR-002](#adr-002-postgresql-with-prisma-orm) | PostgreSQL with Prisma ORM | Accepted |
| [ADR-003](#adr-003-bigint-minor-units-for-financial-amounts) | BigInt Minor Units for Financial Amounts | Accepted |
| [ADR-004](#adr-004-zod-for-server-side-validation) | Zod for Server-Side Validation | Accepted |
| [ADR-005](#adr-005-database-backed-sessions-with-hashed-tokens) | Database-Backed Sessions with Hashed Tokens | Accepted |
| [ADR-006](#adr-006-layered-architecture) | Layered Architecture (App/Server/Domain Separation) | Accepted |
| [ADR-007](#adr-007-vitest-for-unit-and-integration-tests) | Vitest for Unit and Integration Tests | Accepted |
| [ADR-008](#adr-008-playwright-for-e2e-tests) | Playwright for E2E Tests | Accepted |
| [ADR-009](#adr-009-docker-compose-for-deployment) | Docker Compose for Deployment | Accepted |
| [ADR-010](#adr-010-argon2id-for-password-hashing) | Argon2id for Password Hashing | Accepted |

---

## ADR-001: Next.js App Router with TypeScript Strict

**Status:** Accepted  
**Date:** 2026-11-10

### Context

The Aqar Elite system requires a full-stack web framework that supports:
- Server-side rendering for the Arabic RTL frontend
- API route handlers for backend logic
- A single deployable artifact (monorepo-friendly)
- TypeScript for type safety across the entire codebase
- React ecosystem for component-based UI development

We evaluated several options:
1. **Next.js App Router** — React meta-framework with server components, API routes, built-in SSR
2. **Remix** — React framework with nested routes and server-first approach
3. **Separate SPA + Express API** — Decoupled frontend and backend

### Decision

We will use **Next.js 14+ with the App Router** and **TypeScript in strict mode** (`strict: true` in `tsconfig.json`).

Key configuration:
- `strict: true` — enables all strict type-checking options
- `noUncheckedIndexedAccess: true` — forces null checks on indexed access
- `exactOptionalPropertyTypes: true` — distinguishes `undefined` from missing
- App Router for file-based routing with React Server Components
- Server Actions and Route Handlers for backend API logic

### Consequences

**Positive:**
- Single codebase and deployment artifact — simplifies Docker deployment (REQ-052)
- Server Components reduce client-side JavaScript bundle for better performance
- TypeScript strict mode catches entire categories of bugs at compile time
- Built-in support for `dir="rtl"` and internationalization patterns (REQ-051)
- Server-side rendering ensures crawlable, fast initial paint
- Large ecosystem and community support

**Negative:**
- App Router is more complex than Pages Router — steeper learning curve for some patterns
- Server Components impose constraints on interactivity (requires "use client" boundary)
- TypeScript strict mode may initially slow development due to more verbose type annotations
- Vendor lock-in to the Next.js framework and Vercel's conventions

**Risks:**
- Next.js breaking changes between versions; mitigated by pinning exact dependency versions

---

## ADR-002: PostgreSQL with Prisma ORM

**Status:** Accepted  
**Date:** 2026-11-10

### Context

The system requires a relational database for:
- Multi-tenant data with strong isolation guarantees (companyId-scoped queries)
- Financial data requiring ACID transactions (payment recording, contract approval)
- Complex queries with filtering, sorting, and pagination
- Concurrent access handling (reservation locking, payment race prevention)
- BigInt support for financial amounts in minor units

We evaluated:
1. **PostgreSQL + Prisma** — Type-safe ORM with migration support
2. **PostgreSQL + Drizzle** — Lighter-weight, SQL-closer ORM
3. **PostgreSQL + raw SQL** — Maximum control, no ORM overhead
4. **MySQL** — Alternative RDBMS

### Decision

We will use **PostgreSQL 15+** as the database engine and **Prisma ORM** as the data access layer.

Key aspects:
- Prisma schema as the single source of truth for data models
- Prisma Migrate for version-controlled schema migrations
- Prisma Client for type-safe database queries
- Native PostgreSQL `BigInt` columns mapped to TypeScript `BigInt`
- PostgreSQL advisory locks or `SELECT ... FOR UPDATE` for concurrency control
- Unique constraints and check constraints for data integrity

### Consequences

**Positive:**
- Type-safe queries — Prisma generates TypeScript types from the schema, catching errors at compile time
- Migration history provides auditable schema evolution
- PostgreSQL's robust transaction support (serializable isolation, advisory locks) supports REQ-026, REQ-027, REQ-047, REQ-049
- PostgreSQL natively supports `BIGINT`, `TIMESTAMP WITH TIME ZONE`, and rich indexing
- Prisma's interactive transactions (`$transaction`) simplify multi-step atomic operations

**Negative:**
- Prisma adds a query engine layer with some performance overhead vs. raw SQL
- Complex queries (e.g., correlated subqueries, CTEs) may require `$queryRaw`
- Prisma's BigInt handling requires explicit mapping configuration
- Schema-first approach means database changes require migration generation

**Risks:**
- Prisma version incompatibilities; mitigated by pinning versions
- N+1 query patterns if relations are not explicitly included; mitigated by code review and query monitoring

---

## ADR-003: BigInt Minor Units for Financial Amounts

**Status:** Accepted  
**Date:** 2026-11-10

### Context

The system handles financial calculations including:
- Unit prices (potentially millions in major units)
- Discount calculation (5% cap)
- Down payment and remaining balance
- Installment amount division with remainder distribution
- Payment allocation across multiple installments
- Running balance tracking

JavaScript's `number` type (IEEE 754 double-precision float) has well-documented precision issues with decimal arithmetic:
- `0.1 + 0.2 === 0.30000000000000004` (not `0.3`)
- Precision loss above `Number.MAX_SAFE_INTEGER` (2^53 - 1)

These issues are unacceptable for financial calculations where every minor unit must be accounted for exactly.

### Decision

We will represent all monetary amounts as **BigInt values in minor units** (the smallest indivisible currency unit, e.g., fils, cents, piastres).

Implementation:
- TypeScript: `BigInt` type for all financial arithmetic
- PostgreSQL: `BIGINT` column type for all monetary fields
- Prisma: `BigInt` field type with appropriate mapping
- Serialization: Convert to string for JSON responses (JSON does not support BigInt natively)
- Validation: Zod schemas validate financial inputs as string-encoded integers, converted to BigInt server-side

**Example:**
- Unit price of 500,000.750 SAR → stored as `500000750n` (in millimes) or `50000075n` (in fils, 1/100)
- The actual minor unit granularity is deployment-specific but consistent within a deployment

### Consequences

**Positive:**
- **Zero precision loss** — integer arithmetic is exact by definition
- **Deterministic remainder distribution** — `remaining % count` always produces correct redistribution
- **Database alignment** — PostgreSQL `BIGINT` stores up to 9.2 × 10^18, far exceeding any real estate price
- **Invariant verifiable** — sum of installments can be asserted to exactly equal the remaining amount (REQ-038)

**Negative:**
- BigInt arithmetic operators (`+`, `-`, `*`, `/`, `%`) cannot be mixed with `number` — requires discipline
- JSON serialization requires explicit `BigInt.toString()` conversion
- Some libraries may not support BigInt natively, requiring adapters
- Frontend display requires formatting from minor units to human-readable amounts

**Risks:**
- Developer confusion when mixing BigInt and number; mitigated by TypeScript strict mode and lint rules

---

## ADR-004: Zod for Server-Side Validation

**Status:** Accepted  
**Date:** 2026-11-10

### Context

The system requires robust input validation for:
- Login credentials (email format, password presence)
- Unit creation and updates (field types, price positivity, enum values)
- Contract financial terms (discount percentage, down payment bounds)
- Payment amounts (positive, not exceeding remaining balance)
- Query parameters (pagination, sorting allowlist, filter enums)

Validation must:
- Run server-side (never trust the client)
- Produce structured, user-friendly error messages (in Arabic where applicable)
- Integrate with TypeScript for inferred types
- Support complex validation rules (cross-field validation, BigInt parsing)

### Decision

We will use **Zod** as the single validation library for all server-side input validation.

Key patterns:
- Schema definitions co-located with domain entities in `src/server/schemas/`
- `z.coerce` and custom transformers for BigInt parsing from string inputs
- `.refine()` and `.superRefine()` for cross-field validation (e.g., downPayment ≤ finalPrice)
- Allowlist patterns using `z.enum()` for sort columns (REQ-016)
- Type inference with `z.infer<typeof schema>` for compile-time safety

### Consequences

**Positive:**
- Single source of truth for validation logic and TypeScript types
- Composable schemas (extend, merge, pick, omit) reduce duplication
- Built-in error formatting produces structured error objects
- Strong TypeScript integration — parsed output is fully typed
- Prevents mass assignment by explicitly defining accepted fields

**Negative:**
- Another dependency in the bundle
- Complex cross-field validations can become verbose with `.superRefine()`
- Custom error messages require explicit configuration for Arabic localization
- Runtime validation has a small performance cost (negligible for this application)

---

## ADR-005: Database-Backed Sessions with Hashed Tokens

**Status:** Accepted  
**Date:** 2026-11-10

### Context

The system requires session management that supports:
- Server-side session invalidation (logout terminates session immediately)
- Multi-tenant session scoping (session tied to user tied to company)
- No client-side token storage in localStorage (REQ-006)
- HttpOnly, Secure, SameSite cookie attributes (REQ-005)
- Session expiration with server-side enforcement (REQ-007)

We evaluated:
1. **Database-backed sessions** — session data in PostgreSQL, token in cookie
2. **JWT tokens in HttpOnly cookies** — stateless authentication
3. **Redis-backed sessions** — session data in Redis, token in cookie

### Decision

We will use **database-backed sessions** stored in PostgreSQL with the following scheme:

1. On login: generate a cryptographically random token (32+ bytes), hash it with SHA-256, store the **hash** in the `Session` table along with `userId`, `expiresAt`, `createdAt`
2. Send the **raw token** to the client as an HttpOnly, Secure, SameSite=Lax cookie
3. On each request: read the token from the cookie, hash it, look up the session by hash, verify it hasn't expired
4. On logout: delete the session row from the database

**Session table schema:**
```
Session {
  id          String   @id @default(cuid())
  tokenHash   String   @unique
  userId      String
  expiresAt   DateTime
  createdAt   DateTime @default(now())
}
```

### Consequences

**Positive:**
- **Immediate revocation** — deleting the database row instantly invalidates the session (vs. JWT which cannot be revoked before expiry)
- **Server-side control** — admin can force-expire all sessions for a user or company
- **Token hashing** — a database breach does not expose session tokens (defense in depth)
- **No Redis dependency** — uses the existing PostgreSQL database
- **Multi-tenant scoping** — session → user → company chain is enforced server-side

**Negative:**
- Every authenticated request requires a database query (session lookup)
- Database becomes a bottleneck at high request volume; mitigated by indexing `tokenHash`
- Session table grows over time; mitigated by periodic cleanup of expired sessions

**Risks:**
- Database downtime means no authentication; acceptable for the deployment model

---

## ADR-006: Layered Architecture

**Status:** Accepted  
**Date:** 2026-11-10

### Context

The system needs a clear separation between:
- **Presentation** — React components, pages, forms, RTL layout
- **Application** — API route handlers, request/response mapping, session management
- **Domain** — Business rules, financial calculations, state machines, validation
- **Infrastructure** — Database queries, external service calls

Without clear boundaries, business logic leaks into UI components or API handlers, making the code untestable and the domain rules undiscoverable.

### Decision

We will organize the codebase into three primary layers:

```
src/
├── app/                    # Presentation + Application layer (Next.js App Router)
│   ├── (auth)/             # Auth-required layout group
│   │   ├── units/          # Unit management pages
│   │   ├── clients/        # Client management pages
│   │   ├── contracts/      # Contract management pages
│   │   └── payments/       # Payment management pages
│   ├── login/              # Public login page
│   ├── api/                # API Route Handlers (thin controllers)
│   │   ├── auth/
│   │   ├── units/
│   │   ├── clients/
│   │   ├── contracts/
│   │   └── payments/
│   ├── layout.tsx          # Root layout (RTL, Arabic)
│   └── globals.css         # Global styles
│
├── server/                 # Application + Infrastructure layer
│   ├── services/           # Use cases / business operations orchestration
│   │   ├── unit.service.ts
│   │   ├── client.service.ts
│   │   ├── reservation.service.ts
│   │   ├── contract.service.ts
│   │   ├── payment.service.ts
│   │   └── audit.service.ts
│   ├── repositories/       # Data access (Prisma queries, scoped by company)
│   │   ├── unit.repository.ts
│   │   ├── client.repository.ts
│   │   └── ...
│   ├── schemas/            # Zod validation schemas
│   │   ├── unit.schema.ts
│   │   ├── contract.schema.ts
│   │   └── ...
│   └── context.ts          # Request context (session, companyId, userId, role)
│
├── domain/                 # Pure domain logic (no I/O, no framework dependencies)
│   ├── financial.ts        # Financial calculations (BigInt arithmetic)
│   ├── installment-generator.ts  # Installment schedule generation
│   ├── payment-allocator.ts      # FIFO payment allocation
│   ├── date-utils.ts       # Date arithmetic with end-of-month clamping
│   ├── unit-status.ts      # Unit status state machine
│   └── installment-status.ts    # Installment status derivation
│
└── lib/                    # Shared infrastructure utilities
    ├── auth/
    │   ├── session.ts      # Session management
    │   ├── password.ts     # Password hashing (Argon2id/bcrypt)
    │   ├── rbac.ts         # Role-based access control
    │   └── rate-limiter.ts # Login rate limiting
    ├── csrf.ts             # CSRF protection
    └── prisma.ts           # Prisma client singleton
```

**Layer rules:**
1. `domain/` has **zero imports** from `server/`, `app/`, `lib/`, or any external framework. It is pure TypeScript with BigInt and Date only.
2. `server/services/` may import from `domain/` and `server/repositories/` but not from `app/`.
3. `app/api/` route handlers are thin — they parse the request, call a service, and format the response.
4. `app/` pages and components may call server actions or fetch from API routes but never import from `server/` or `domain/` directly in client components.

### Consequences

**Positive:**
- Domain logic is **independently testable** with plain unit tests (no mocking frameworks needed)
- Financial calculations, date logic, and state machines can be verified with high confidence
- Clear dependency direction prevents circular imports
- New developers can understand the system by reading `domain/` first
- Facilitates future extraction of domain logic into a shared library

**Negative:**
- More files and directories than a flat structure
- Some boilerplate for mapping between layers (DTOs, response formatting)
- Requires discipline to prevent shortcutting the layer boundaries

---

## ADR-007: Vitest for Unit and Integration Tests

**Status:** Accepted  
**Date:** 2026-11-10

### Context

The system requires comprehensive testing at two levels:
1. **Unit tests** — pure domain logic (financial calculations, date generation, state machines) with no I/O
2. **Integration tests** — service layer with a real PostgreSQL database (tenant isolation, concurrent operations, transaction integrity)

We evaluated:
1. **Vitest** — Modern, fast, native ESM and TypeScript support, Jest-compatible API
2. **Jest** — Industry standard, large ecosystem, slower startup
3. **Node.js built-in test runner** — Minimal dependencies, less mature

### Decision

We will use **Vitest** for both unit and integration tests.

Configuration:
- Unit tests: `tests/unit/` — run with `vitest run --project unit`
- Integration tests: `tests/integration/` — run with `vitest run --project integration`
- Integration tests use a real PostgreSQL database (Docker container) with per-test transaction rollback or per-suite database reset
- Test utilities in `tests/helpers/` for factory functions, database setup, and session mocking

### Consequences

**Positive:**
- Native TypeScript and ESM support without additional transpilation setup
- Fast execution with parallel test running and smart caching
- Jest-compatible API reduces learning curve
- Built-in code coverage reporting
- Watch mode for development
- Same tool for both unit and integration tests simplifies CI configuration

**Negative:**
- Smaller ecosystem than Jest (fewer plugins)
- Integration tests require a running PostgreSQL instance (handled by Docker Compose test profile)

---

## ADR-008: Playwright for E2E Tests

**Status:** Accepted  
**Date:** 2026-11-10

### Context

The system requires end-to-end testing that:
- Validates full user workflows through the browser (login → create unit → reserve → contract → payment)
- Verifies role-based access restrictions from the user's perspective
- Confirms Arabic RTL layout and bidirectional text rendering
- Tests form interactions, error messages, and navigation

### Decision

We will use **Playwright** for all end-to-end tests.

Configuration:
- Test files in `tests/e2e/` with `.spec.ts` extension
- Tests run against the full application stack (Next.js + PostgreSQL via Docker Compose)
- Separate test database seeded before each test suite
- Page Object Model pattern for maintainable selectors
- RTL-specific assertions for layout direction verification

### Consequences

**Positive:**
- Cross-browser testing (Chromium, Firefox, WebKit) in a single framework
- Built-in auto-wait and retry mechanisms reduce flakiness
- Trace viewer and screenshot capture for debugging failures
- Native support for testing RTL layouts and `dir` attributes
- Parallel test execution for CI speed

**Negative:**
- Slower than unit/integration tests — reserved for critical user journeys
- Requires the full application stack to be running
- Browser-based tests can be flaky in CI without proper waits

---

## ADR-009: Docker Compose for Deployment

**Status:** Accepted  
**Date:** 2026-11-10

### Context

The specification requires Docker Compose as the deployment mechanism (REQ-052). The application needs:
- A Node.js runtime for the Next.js application
- A PostgreSQL database
- Networking between services
- Environment variable management
- Volume persistence for database data

### Decision

We will provide a **Docker Compose** configuration with the following services:

```yaml
services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=postgresql://...
      - SESSION_SECRET=...
    depends_on:
      db:
        condition: service_healthy

  db:
    image: postgres:15-alpine
    volumes:
      - pgdata:/var/lib/postgresql/data
    environment:
      - POSTGRES_DB=aqarelite
      - POSTGRES_USER=...
      - POSTGRES_PASSWORD=...
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U $$POSTGRES_USER"]
      interval: 5s
      timeout: 5s
      retries: 5

volumes:
  pgdata:
```

The **Dockerfile** uses a multi-stage build:
1. **deps** stage — install node_modules
2. **builder** stage — build the Next.js application
3. **runner** stage — minimal production image with standalone output

### Consequences

**Positive:**
- Single `docker compose up` command starts the entire stack
- Reproducible environments across development, CI, and production
- Health checks ensure the database is ready before the app starts
- Volume persistence preserves data across container restarts
- Multi-stage Dockerfile produces a small production image

**Negative:**
- Docker Compose is not suitable for high-availability or auto-scaling deployments
- Single-host deployment is a single point of failure
- No built-in TLS termination (requires a reverse proxy for HTTPS in production)

---

## ADR-010: Argon2id for Password Hashing

**Status:** Accepted  
**Date:** 2026-11-10

### Context

The system stores user passwords that must be hashed with a modern, secure algorithm (REQ-004). The hash must be:
- Resistant to GPU/ASIC brute-force attacks
- Memory-hard to prevent parallel cracking
- Configurable for future computational upgrades
- Well-supported in the Node.js ecosystem

We evaluated:
1. **Argon2id** — Winner of the Password Hashing Competition (2015), memory-hard, recommended by OWASP
2. **bcrypt** — Industry standard since 1999, CPU-hard but not memory-hard
3. **scrypt** — Memory-hard, but less widely adopted than Argon2

### Decision

We will use **Argon2id** as the primary password hashing algorithm, with **bcrypt** as a fallback if the Argon2 native binding (`argon2` npm package) cannot be installed on the target platform.

**Argon2id parameters (OWASP recommended minimums):**
- Memory: 19,456 KiB (19 MiB)
- Iterations: 2
- Parallelism: 1
- Output length: 32 bytes

**bcrypt fallback parameters:**
- Cost factor: 12 (4,096 iterations)

**Implementation:**
```typescript
// src/lib/auth/password.ts
import argon2 from 'argon2';

export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });
}

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  return argon2.verify(hash, password);
}
```

### Consequences

**Positive:**
- Argon2id is the current gold standard for password hashing (recommended by OWASP, NIST draft)
- Memory-hard design resists GPU/ASIC attacks (unlike bcrypt)
- Configurable parameters allow tuning for hardware capabilities
- The `argon2` npm package uses a native C binding for performance
- bcrypt fallback ensures portability when native bindings are unavailable

**Negative:**
- Argon2 native binding requires a C compiler at build time (handled by Docker multi-stage build)
- Higher memory usage per hash operation compared to bcrypt (by design)
- bcrypt fallback is less secure than Argon2id — should be used only as a last resort

**Risks:**
- Native binding build failures on certain platforms; mitigated by Docker-based builds and bcrypt fallback

---

## Change Log

| Date | Version | Author | Description |
|------|---------|--------|-------------|
| 2026-11-10 | 1.0 | System Architect | Initial ADR document with 10 decisions |
