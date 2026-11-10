# TEST_REPORT.md

All test executions and verification checks are recorded here with exact commands and observed outputs.

---

## Recovery Baseline Check — 2026-11-11

| Check / Test | Type | Command | Expected | Actual | Status | Fix / Next Step |
|--------------|------|---------|----------|--------|--------|-----------------|
| `.env` git ignore | Security | `git check-ignore -v .env` | Excluded | `.gitignore:27:.env` | PASS | — |
| Package tree | Integrity | `npm ls --depth=0` | Exit 0 | Exit 0 (all packages installed) | PASS | — |
| Prisma schema validate | Schema | `npx prisma validate` | Valid schema | Error P1012 (`url` in `schema.prisma` unsupported in Prisma 7) | FAIL | Add `prisma.config.ts` & `@prisma/adapter-pg` |
| TypeScript check | Static | `npm run typecheck` | 0 errors | TS2305 in `src/lib/prisma.ts`, `src/server/auth/session.ts` (`@prisma/client` not generated) | FAIL | Fix Prisma 7 config & run `prisma generate` |
| ESLint | Lint | `npm run lint` | 0 errors | Failed (`next lint` invalid in Next.js 16) | FAIL | Configure `eslint.config.mjs` and update script to `eslint .` |
| Vitest unit suite | Unit | `npm test` | All pass | Exited 1: No test files found | FAIL | Create Sprint 0.5 domain tests |
