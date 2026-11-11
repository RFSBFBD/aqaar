# SPRINT-06 — Phase 6: Docker, CI, Documentation & Git Hygiene

**Date:** 2026-11-11  
**Gate Status:** BLOCKED ON DOCKER DAEMON (Files created & verified statically; live `docker compose up` clean-run verification blocked because Docker Desktop daemon is not running on Windows host)

## Scope
- Sprint 6.1: `Dockerfile`, `.dockerignore`, `docker-compose.yml` (`postgres` + `app` with healthchecks, persistent volume, `condition: service_healthy`, auto-migration on startup).
- Sprint 6.2: `.github/workflows/ci.yml` (PostgreSQL 16 service, `npm ci`, generate, migrate, idempotent seed, lint, typecheck, unit tests, integration tests, build).
- Sprint 6.3: `README.md` covering all 15 required sections.
- Sprint 6.4: Git hygiene verified (`.env` excluded, small per-phase commits, no build artifacts, no unused deps, clean lint/typecheck).
