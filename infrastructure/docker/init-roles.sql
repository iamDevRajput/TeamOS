-- TeamOS Database Bootstrap Script
-- Executed on fresh PostgreSQL container initialization

-- 1. Create Migration/DDL Owner Role
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'teamos_owner') THEN
    CREATE ROLE teamos_owner WITH LOGIN PASSWORD 'teamos_owner_password' CREATEDB;
  END IF;
END
$$;

-- 2. Create Outbox Function Admin Role (Non-login, owns outbox table & security definer functions)
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'teamos_outbox_admin') THEN
    CREATE ROLE teamos_outbox_admin WITH NOLOGIN;
  END IF;
END
$$;

-- 3. Create API Runtime Role (Non-owner, non-superuser, subject to forced RLS, no DDL)
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'teamos_api_role') THEN
    CREATE ROLE teamos_api_role WITH LOGIN PASSWORD 'teamos_api_password' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;
  END IF;
END
$$;

-- 4. Create Worker Runtime Role (Non-owner, non-superuser, subject to forced RLS, no DDL)
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'teamos_worker_role') THEN
    CREATE ROLE teamos_worker_role WITH LOGIN PASSWORD 'teamos_worker_password' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;
  END IF;
END
$$;

-- 5. Create Identity Function Admin Role (Non-login, owns sessions table & security definer functions)
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'teamos_identity_admin') THEN
    CREATE ROLE teamos_identity_admin WITH NOLOGIN;
  END IF;
END
$$;

-- 6. Create Identity Runtime Role (Dedicated login role for session/identity operations, no superuser, no bypassrls)
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'teamos_identity_runtime') THEN
    CREATE ROLE teamos_identity_runtime WITH LOGIN PASSWORD 'teamos_identity_password' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;
  END IF;
END
$$;

-- Grant role membership with SET TRUE, INHERIT FALSE to migration owner
GRANT teamos_identity_admin TO teamos_owner WITH SET TRUE, INHERIT FALSE;

-- Grant database connection permissions
GRANT CONNECT ON DATABASE teamos TO teamos_owner;
GRANT CONNECT ON DATABASE teamos TO teamos_api_role;
GRANT CONNECT ON DATABASE teamos TO teamos_worker_role;
GRANT CONNECT ON DATABASE teamos TO teamos_identity_runtime;

-- Grant schema usage to runtime roles
GRANT USAGE ON SCHEMA public TO teamos_owner, teamos_outbox_admin, teamos_identity_admin, teamos_api_role, teamos_worker_role, teamos_identity_runtime;

