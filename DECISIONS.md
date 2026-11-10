# DECISIONS.md

Log of key architectural, technical, and recovery decisions. Detailed ADRs are maintained in `docs/ARCHITECTURE_DECISIONS.md`.

---

## REC-001: Recovery Alignment (2026-11-11)
- **Context:** Execution was interrupted during Phase 0 (`phase0-docs` subagent failed with quota error) while Phase 1 scaffolding had partially begun in parallel.
- **Decision:** Keep valid existing files (`docs/REQUIREMENTS_TRACEABILITY.md`, `docs/ASSUMPTIONS.md`, `docs/ARCHITECTURE_DECISIONS.md`, `docs/THREAT_MODEL.md`, `src/domain/*`, `src/server/auth/*`, `prisma/schema.prisma`, `package.json`), complete Phase 0 missing docs and Test-First Domain Proof (Sprint 0.5) + QA Gate first, then repair Phase 1 (Prisma 7 configuration, ESLint for Next 16, bcryptjs/Argon2 alignment).
- **Reason:** Preserves work without violating phase ordering or overwriting valid files.

## REC-002: Password Hashing Alignment (bcryptjs vs Argon2id)
- **Context:** `00_MASTER_ORCHESTRATOR.md` explicitly allows "Argon2id أو bcrypt". `src/server/auth/session.ts` already uses `bcryptjs@3.0.3` (pure JS, no native C++ build issues on Windows/Alpine Docker), whereas `docs/ARCHITECTURE_DECISIONS.md` ADR-010 drafted Argon2id.
- **Decision:** Standardize on `bcryptjs` (cost factor 12) and update ADR-010 / `THREAT_MODEL.md` / `REQUIREMENTS_TRACEABILITY.md` references to reflect `bcryptjs` consistently, avoiding native addon compilation failures in Docker/Windows while meeting the Master Orchestrator requirement.
