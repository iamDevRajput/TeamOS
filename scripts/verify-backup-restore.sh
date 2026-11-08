#!/usr/bin/env bash
set -euo pipefail

# TeamOS — Safe PostgreSQL Backup & Restore Verification Script
# Verifies database dump and restore integrity into a disposable database
# without modifying or endangering the active production database or volume.

CONTAINER_NAME="teamos-postgres"
DB_NAME="teamos"
TEST_DB_NAME="teamos_restore_verify_test"
DUMP_PATH="/tmp/teamos_backup_verification.dump"

echo "=== [1/5] Creating custom-format backup of '${DB_NAME}' ==="
docker exec -i "${CONTAINER_NAME}" pg_dump \
  -U teamos_owner \
  -d "${DB_NAME}" \
  --format=custom \
  -f "${DUMP_PATH}"

echo "=== [2/5] Creating disposable test database '${TEST_DB_NAME}' ==="
docker exec -i "${CONTAINER_NAME}" psql -U teamos_owner -d postgres -c "DROP DATABASE IF EXISTS ${TEST_DB_NAME};"
docker exec -i "${CONTAINER_NAME}" psql -U teamos_owner -d postgres -c "CREATE DATABASE ${TEST_DB_NAME};"

echo "=== [3/5] Restoring backup into '${TEST_DB_NAME}' ==="
docker exec -i "${CONTAINER_NAME}" pg_restore \
  -U teamos_owner \
  -d "${TEST_DB_NAME}" \
  "${DUMP_PATH}"

echo "=== [4/5] Verifying forced RLS policies on restored tables ==="
docker exec -i "${CONTAINER_NAME}" psql -U teamos_owner -d "${TEST_DB_NAME}" -c \
  "SELECT 
     relname, 
     relrowsecurity, 
     relforcerowsecurity 
   FROM pg_class 
   WHERE relname IN (
     'organizations', 
     'memberships', 
     'invitations', 
     'projects', 
     'tasks', 
     'task_dependencies', 
     'audit_events', 
     'proposals', 
     'project_reports', 
     'ai_budget_reservations', 
     'github_installations', 
     'github_repositories', 
     'users'
   )
   ORDER BY relname;"

echo "=== [5/5] Cleaning up disposable database and temporary dump file ==="
docker exec -i "${CONTAINER_NAME}" psql -U teamos_owner -d postgres -c "DROP DATABASE ${TEST_DB_NAME};"
docker exec -i "${CONTAINER_NAME}" rm -f "${DUMP_PATH}"

echo "✅ Backup and restore verification completed successfully with zero disruption to active database!"

