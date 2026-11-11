# Production Deployment, Secret Management & PostgreSQL Backup/Restore Runbook

**Application:** Aqar Elite  
**Target Stack:** Docker Compose (`postgres:16-alpine` + Next.js App) behind an HTTPS reverse proxy (Nginx / Caddy / ALB / Cloudflare).

---

## 1. Secret Generation & Rotation

Never reuse `.env.example` or local dev `SEED_DEFAULT_PASSWORD` / `aqar_secret` values in production.

### Generate Cryptographic Secrets
- **Linux / macOS / WSL / OpenSSL:**
  ```bash
  openssl rand -hex 32   # SESSION_SECRET (64 hex chars)
  openssl rand -hex 24   # POSTGRES_PASSWORD
  ```
- **Windows PowerShell:**
  ```powershell
  [Convert]::ToHexString((1..32 | ForEach-Object { [byte](Get-Random -Maximum 256) }))
  ```
  Or via .NET CSPRNG:
  ```powershell
  $bytes = New-Object byte[] 32; [Security.Cryptography.RandomNumberGenerator]::Fill($bytes); [Convert]::ToHexString($bytes).ToLower()
  ```

### Secret Rotation Procedure
1. **Rotating `SESSION_SECRET` / Revoking Active Sessions:**
   Update `SESSION_SECRET` in production `.env`, recreate the `app` container (`docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d app`), and optionally truncate the `sessions` table to force re-authentication of all users:
   ```bash
   docker compose exec -T postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "TRUNCATE TABLE sessions;"
   ```
2. **Rotating `POSTGRES_PASSWORD`:**
   Update the DB role password first inside PostgreSQL (`ALTER USER ... WITH PASSWORD '...';`), update `POSTGRES_PASSWORD` in production `.env`, then recreate the `app` container.

---

## 2. Production Deployment (HTTPS + `COOKIE_SECURE=true`)

1. Ensure your reverse proxy terminates TLS (HTTPS) and forwards `Host`, `X-Forwarded-For`, and `X-Forwarded-Proto: https` to `app:3000`.
2. Create a production `.env` (never committed to Git) with strong generated `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `SESSION_SECRET`, and `TRUST_PROXY=true`.
3. Launch using the production overlay (`docker-compose.prod.yml`), which **enforces `COOKIE_SECURE=true`** and fails fast if required secrets are missing:
   ```bash
   docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
   ```
4. Verify health:
   ```bash
   docker compose ps
   curl -fsS http://127.0.0.1:3000/api/health
   ```
   *(Do **NOT** run `npm run db:seed` in production; provision real company/user accounts directly with unique strong passwords.)*

---

## 3. PostgreSQL Backup & Restore (`aqar_pgdata`)

All persistent database state lives in the named Docker volume `aqar_pgdata` (`/var/lib/postgresql/data`).

### Logical Backup (`pg_dump` Custom Format)
Run online without stopping the application:
```bash
mkdir -p backups
docker compose exec -T postgres pg_dump -U "${POSTGRES_USER:-aqar}" -d "${POSTGRES_DB:-aqar_elite}" -Fc > "backups/aqar_elite_$(date +%Y%m%d_%H%M%S).dump"
```
On Windows PowerShell:
```powershell
New-Item -ItemType Directory -Force -Path backups | Out-Null
$ts = Get-Date -Format "yyyyMMdd_HHmmss"
docker compose exec -T postgres pg_dump -U aqar -d aqar_elite -Fc > "backups\aqar_elite_$ts.dump"
```

### Verify Backup Archive Integrity
```bash
docker compose exec -T postgres pg_restore --list < backups/<backup_file>.dump | head -n 30
```

### Restore Procedure (Clean or Disaster Recovery)
1. Stop `app` before restoring to prevent concurrent writes during restore:
   ```bash
   docker compose stop app
   ```
2. Drop/recreate target database (or restore into a fresh `postgres` container) and execute `pg_restore` (note: separate `-c` flags are required because `DROP DATABASE` / `CREATE DATABASE` cannot execute inside a single `psql -c` transaction block):
   ```bash
   docker compose exec -T postgres psql -U "${POSTGRES_USER:-aqar}" -d postgres -c "DROP DATABASE IF EXISTS ${POSTGRES_DB:-aqar_elite};" -c "CREATE DATABASE ${POSTGRES_DB:-aqar_elite};"
   docker compose exec -T postgres pg_restore -U "${POSTGRES_USER:-aqar}" -d "${POSTGRES_DB:-aqar_elite}" --no-owner --single-transaction < backups/<backup_file>.dump
   ```
   *(Using `--single-transaction` ensures atomic restore, preserving all `CHECK` constraints, `reservations_one_active_per_unit` partial unique index, and immutability/append-only triggers.)*
3. Start `app` and verify `/api/health`:
   ```bash
   docker compose start app
   ```
