# TeamOS — Operations: PostgreSQL Backup & Restore Runbook

This runbook defines authoritative procedures for creating database snapshots, scheduled backups, point-in-time recovery, and non-destructive restore verification for TeamOS multi-tenant SaaS.

---

## 1. Architecture & Security Requirements

1. **Role Separation**:
   - `pg_dump` and `pg_restore` require owner credentials (`teamos_owner`) to export and recreate database objects, sequences, foreign keys, and Row-Level Security (RLS) policies.
   - Runtime roles (`teamos_api_role`, `teamos_worker_role`, `teamos_identity_runtime`) must **never** be used to run backups or restores.
2. **Forced RLS Preservation**:
   - Every tenant-scoped table (`organizations`, `projects`, `tasks`, `proposals`, `project_reports`, `ai_budget_reservations`) has `FORCE ROW LEVEL SECURITY`.
   - Restore operations must verify that `relrowsecurity = true` and `relforcerowsecurity = true` across all tenant tables.
3. **Non-Destructive Guarantee**:
   - Never drop or truncate the active `teamos` database or volume in an unverified state.
   - All recovery rehearsals must execute in isolated, disposable target databases (e.g. `teamos_restore_verify_test`).

---

## 2. Production / Local Backup Procedure

### Command
```bash
docker exec -i teamos-postgres pg_dump \
  -U teamos_owner \
  -d teamos \
  --format=custom \
  --compress=9 \
  --file=/var/lib/postgresql/data/teamos_$(date +%Y%m%d_%H%M%S).dump
```

### Explanation of Flags
- `--format=custom` (`-Fc`): PostgreSQL custom binary format. Compressed, flexible, supports selective table restore, and maintains exact sequence values and constraints.
- `--compress=9`: Maximum gzip compression.
- `-U teamos_owner`: Migration/schema owner role with full DDL inspection rights.

---

## 3. Automated Local Restore Verification

Before relying on any backup file, verify its integrity against a temporary disposable database.

Execute the automated verification script:
```bash
./scripts/verify-backup-restore.sh
```

### Manual Step-by-Step Restore Procedure
```bash
# 1. Create a disposable target database
docker exec -i teamos-postgres psql -U teamos_owner -d postgres -c "CREATE DATABASE teamos_disposable_verify;"

# 2. Restore into the disposable database
docker exec -i teamos-postgres pg_restore \
  -U teamos_owner \
  -d teamos_disposable_verify \
  /tmp/backup_to_verify.dump

# 3. Verify RLS integrity on all 13 restored tenant tables
docker exec -i teamos-postgres psql -U teamos_owner -d teamos_disposable_verify -c \
  "SELECT relname, relrowsecurity, relforcerowsecurity FROM pg_class WHERE relname IN (
     'organizations', 'memberships', 'invitations', 'projects', 'tasks',
     'task_dependencies', 'audit_events', 'proposals', 'project_reports',
     'ai_budget_reservations', 'github_installations', 'github_repositories', 'users'
   ) ORDER BY relname;"
# Note: System tables (sessions, github_webhook_deliveries, outbox_events) have dedicated security models.

# 4. Clean up disposable database
docker exec -i teamos-postgres psql -U teamos_owner -d postgres -c "DROP DATABASE teamos_disposable_verify;"
```

---

## 4. Disaster Recovery (Full Restore)

In the event of hardware or host failure:

1. Provision new PostgreSQL 16 container with `init-roles.sql` mounted to provision database roles (`teamos_owner`, `teamos_api_role`, `teamos_worker_role`, `teamos_identity_admin`, `teamos_identity_runtime`).
2. Run restore:
   ```bash
   pg_restore -U teamos_owner -d teamos --clean --if-exists /path/to/backup.dump
   ```
3. Run monorepo health and readiness probes:
   ```bash
   curl -s http://localhost:3001/api/v1/health/ready
   # Expected: {"status":"ok","database":"connected"}
   ```
4. Run tenant isolation security tests:
   ```bash
   pnpm --filter=@teamos/database test
   ```

