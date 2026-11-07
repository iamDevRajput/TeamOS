-- TeamOS Milestone 1: Initial Migration & RLS Security

-- 1. Create Enums
CREATE TYPE "OrgRole" AS ENUM ('OWNER', 'ADMIN', 'MEMBER');
CREATE TYPE "TaskStatus" AS ENUM ('TODO', 'IN_PROGRESS', 'DONE', 'CANCELLED');
CREATE TYPE "ActorType" AS ENUM ('USER', 'SYSTEM', 'GITHUB', 'AI');
CREATE TYPE "OutboxStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'DEAD');

-- 2. Create Users Table
CREATE TABLE public.users (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  github_user_id bigint NOT NULL UNIQUE,
  login text NOT NULL UNIQUE,
  display_name text,
  created_at timestamptz(6) NOT NULL DEFAULT clock_timestamp()
);

-- 3. Create Organizations Table
CREATE TABLE public.organizations (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  ai_budget_cents_monthly int NOT NULL DEFAULT 0,
  created_at timestamptz(6) NOT NULL DEFAULT clock_timestamp()
);

-- 4. Create Memberships Table
CREATE TABLE public.memberships (
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role "OrgRole" NOT NULL DEFAULT 'MEMBER',
  created_at timestamptz(6) NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (org_id, user_id)
);

-- 5. Create Projects Table
CREATE TABLE public.projects (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  key text NOT NULL,
  name text NOT NULL,
  start_date date,
  due_date date,
  timezone text NOT NULL DEFAULT 'UTC',
  next_task_number int NOT NULL DEFAULT 1,
  created_by uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  created_at timestamptz(6) NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT uq_projects_org_id_id UNIQUE (org_id, id),
  CONSTRAINT uq_projects_org_id_key UNIQUE (org_id, key)
);
CREATE INDEX projects_org_id_idx ON public.projects(org_id);

-- 6. Create Tasks Table
CREATE TABLE public.tasks (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id uuid NOT NULL,
  number int NOT NULL,
  title text NOT NULL,
  description text,
  status "TaskStatus" NOT NULL DEFAULT 'TODO',
  assignee_id uuid,
  remaining_estimate_workdays int,
  due_date date,
  version int NOT NULL DEFAULT 1,
  created_by uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  created_at timestamptz(6) NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz(6) NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT uq_tasks_org_id_id UNIQUE (org_id, id),
  CONSTRAINT uq_tasks_org_id_project_id_number UNIQUE (org_id, project_id, number),
  CONSTRAINT tasks_org_id_project_id_fkey FOREIGN KEY (org_id, project_id) REFERENCES public.projects(org_id, id) ON DELETE CASCADE,
  -- PostgreSQL 16 Partial SET NULL: Only assignee_id is set to null, org_id is preserved!
  CONSTRAINT tasks_org_id_assignee_id_fkey FOREIGN KEY (org_id, assignee_id) REFERENCES public.memberships(org_id, user_id) ON DELETE SET NULL (assignee_id)
);
CREATE INDEX tasks_org_id_project_id_idx ON public.tasks(org_id, project_id);
CREATE INDEX tasks_org_id_assignee_id_idx ON public.tasks(org_id, assignee_id);

-- 7. Create Task Dependencies Table
CREATE TABLE public.task_dependencies (
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id uuid NOT NULL,
  blocker_task_id uuid NOT NULL,
  blocked_task_id uuid NOT NULL,
  created_by uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  created_at timestamptz(6) NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (org_id, blocker_task_id, blocked_task_id),
  CONSTRAINT task_deps_blocker_not_blocked CHECK (blocker_task_id <> blocked_task_id),
  CONSTRAINT task_deps_project_fkey FOREIGN KEY (org_id, project_id) REFERENCES public.projects(org_id, id) ON DELETE CASCADE,
  CONSTRAINT task_deps_blocker_fkey FOREIGN KEY (org_id, blocker_task_id) REFERENCES public.tasks(org_id, id) ON DELETE CASCADE,
  CONSTRAINT task_deps_blocked_fkey FOREIGN KEY (org_id, blocked_task_id) REFERENCES public.tasks(org_id, id) ON DELETE CASCADE
);
CREATE INDEX task_deps_blocker_idx ON public.task_dependencies(org_id, blocker_task_id);
CREATE INDEX task_deps_blocked_idx ON public.task_dependencies(org_id, blocked_task_id);
CREATE INDEX task_deps_project_idx ON public.task_dependencies(org_id, project_id);

-- 8. Create Audit Events Table (Append-Only)
CREATE TABLE public.audit_events (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  actor_type "ActorType" NOT NULL,
  actor_id uuid NOT NULL,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  before_data jsonb,
  after_data jsonb,
  request_id text,
  created_at timestamptz(6) NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX audit_events_org_id_idx ON public.audit_events(org_id, entity_type, entity_id);
CREATE INDEX audit_events_org_created_idx ON public.audit_events(org_id, created_at);

-- 9. Create Outbox Events Table
CREATE TABLE public.outbox_events (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  type text NOT NULL,
  payload jsonb NOT NULL,
  dedupe_key text NOT NULL,
  status "OutboxStatus" NOT NULL DEFAULT 'PENDING',
  attempts int NOT NULL DEFAULT 0,
  max_attempts int NOT NULL DEFAULT 5,
  available_at timestamptz(6) NOT NULL DEFAULT clock_timestamp(),
  locked_until timestamptz(6),
  locked_by text,
  lease_token uuid,
  last_error text,
  created_at timestamptz(6) NOT NULL DEFAULT clock_timestamp(),
  processed_at timestamptz(6),
  CONSTRAINT uq_outbox_org_dedupe UNIQUE (org_id, dedupe_key)
);
CREATE INDEX outbox_events_claim_idx ON public.outbox_events(status, available_at, locked_until);

-- 10. Enable & FORCE Row-Level Security on All Tenant-Owned Tables
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations FORCE ROW LEVEL SECURITY;

ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memberships FORCE ROW LEVEL SECURITY;

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects FORCE ROW LEVEL SECURITY;

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks FORCE ROW LEVEL SECURITY;

ALTER TABLE public.task_dependencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_dependencies FORCE ROW LEVEL SECURITY;

ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_events FORCE ROW LEVEL SECURITY;

ALTER TABLE public.outbox_events ENABLE ROW LEVEL SECURITY;
-- Note: NO FORCE ROW LEVEL SECURITY on outbox_events allows table owner (teamos_outbox_admin)
-- to claim platform events inside SECURITY DEFINER functions without tenant context, while
-- non-owner runtime roles (teamos_api_role, teamos_worker_role) are strictly constrained by RLS.
ALTER TABLE public.outbox_events NO FORCE ROW LEVEL SECURITY;

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users FORCE ROW LEVEL SECURITY;

-- 11. Create Cached RLS Policies
CREATE POLICY tenant_isolation_organizations ON public.organizations
  FOR ALL
  USING (id = (SELECT NULLIF(current_setting('app.org_id', true), '')::uuid))
  WITH CHECK (id = (SELECT NULLIF(current_setting('app.org_id', true), '')::uuid));

CREATE POLICY tenant_isolation_memberships ON public.memberships
  FOR ALL
  USING (org_id = (SELECT NULLIF(current_setting('app.org_id', true), '')::uuid))
  WITH CHECK (org_id = (SELECT NULLIF(current_setting('app.org_id', true), '')::uuid));

CREATE POLICY tenant_isolation_projects ON public.projects
  FOR ALL
  USING (org_id = (SELECT NULLIF(current_setting('app.org_id', true), '')::uuid))
  WITH CHECK (org_id = (SELECT NULLIF(current_setting('app.org_id', true), '')::uuid));

CREATE POLICY tenant_isolation_tasks ON public.tasks
  FOR ALL
  USING (org_id = (SELECT NULLIF(current_setting('app.org_id', true), '')::uuid))
  WITH CHECK (org_id = (SELECT NULLIF(current_setting('app.org_id', true), '')::uuid));

CREATE POLICY tenant_isolation_dependencies ON public.task_dependencies
  FOR ALL
  USING (org_id = (SELECT NULLIF(current_setting('app.org_id', true), '')::uuid))
  WITH CHECK (org_id = (SELECT NULLIF(current_setting('app.org_id', true), '')::uuid));

CREATE POLICY tenant_isolation_audit ON public.audit_events
  FOR ALL
  USING (org_id = (SELECT NULLIF(current_setting('app.org_id', true), '')::uuid))
  WITH CHECK (org_id = (SELECT NULLIF(current_setting('app.org_id', true), '')::uuid));

CREATE POLICY tenant_isolation_outbox ON public.outbox_events
  FOR ALL
  USING (org_id = (SELECT NULLIF(current_setting('app.org_id', true), '')::uuid))
  WITH CHECK (org_id = (SELECT NULLIF(current_setting('app.org_id', true), '')::uuid));

CREATE POLICY user_read_policy ON public.users
  FOR SELECT
  USING (
    id = (SELECT NULLIF(current_setting('app.user_id', true), '')::uuid)
    OR
    EXISTS (
      SELECT 1 FROM public.memberships m
      WHERE m.user_id = public.users.id
        AND m.org_id = (SELECT NULLIF(current_setting('app.org_id', true), '')::uuid)
    )
  );

-- 12. Transfer Ownership of Outbox to teamos_outbox_admin
ALTER TABLE public.outbox_events OWNER TO teamos_outbox_admin;

-- 13. Hardened SECURITY DEFINER Outbox Functions
CREATE OR REPLACE FUNCTION public.claim_next_outbox_event(
  p_worker_id text,
  p_lease_seconds int DEFAULT 30
)
RETURNS TABLE (
  id uuid,
  org_id uuid,
  type text,
  payload jsonb,
  attempts int,
  lease_token uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
BEGIN
  IF p_worker_id IS NULL OR btrim(p_worker_id) = '' THEN
    RAISE EXCEPTION 'worker_id is required';
  END IF;

  IF p_lease_seconds < 5 OR p_lease_seconds > 300 THEN
    RAISE EXCEPTION 'lease_seconds must be between 5 and 300';
  END IF;

  -- 1. Crash recovery / Dead-letter sweep:
  -- Move any expired PROCESSING event that already reached max_attempts to DEAD status
  WITH dead_candidates AS (
    SELECT o.id
    FROM public.outbox_events o
    WHERE o.status = 'PROCESSING'
      AND o.locked_until < clock_timestamp()
      AND o.attempts >= o.max_attempts
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.outbox_events o
  SET status = 'DEAD',
      locked_by = NULL,
      locked_until = NULL,
      lease_token = NULL,
      last_error = coalesce(o.last_error, 'Exhausted maximum retry attempts (lease expired)'),
      processed_at = clock_timestamp()
  FROM dead_candidates
  WHERE o.id = dead_candidates.id;

  -- 2. Claim next available PENDING or reclaimable PROCESSING event below max_attempts
  RETURN QUERY
  WITH candidate AS (
    SELECT o.id
    FROM public.outbox_events o
    WHERE (
      (o.status = 'PENDING' AND o.available_at <= clock_timestamp() AND o.attempts < o.max_attempts)
      OR
      (o.status = 'PROCESSING' AND o.locked_until < clock_timestamp() AND o.attempts < o.max_attempts)
    )
    ORDER BY o.available_at ASC
    FOR UPDATE SKIP LOCKED
    LIMIT 1
  )
  UPDATE public.outbox_events o
  SET status = 'PROCESSING',
      locked_by = p_worker_id,
      locked_until = clock_timestamp() + (p_lease_seconds || ' seconds')::interval,
      lease_token = gen_random_uuid(),
      attempts = o.attempts + 1,
      last_error = NULL
  FROM candidate
  WHERE o.id = candidate.id
  RETURNING o.id, o.org_id, o.type, o.payload, o.attempts, o.lease_token;
END;
$$;
ALTER FUNCTION public.claim_next_outbox_event(text, int) OWNER TO teamos_outbox_admin;

CREATE OR REPLACE FUNCTION public.complete_outbox_event(
  p_event_id uuid,
  p_worker_id text,
  p_lease_token uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  v_updated int;
BEGIN
  IF p_worker_id IS NULL OR btrim(p_worker_id) = '' THEN
    RAISE EXCEPTION 'worker_id is required';
  END IF;

  IF p_lease_token IS NULL THEN
    RAISE EXCEPTION 'lease_token is required';
  END IF;

  -- Require exact match on worker_id, lease_token, status PROCESSING, and active unexpired lease
  UPDATE public.outbox_events
  SET status = 'COMPLETED',
      locked_until = NULL,
      locked_by = NULL,
      lease_token = NULL,
      processed_at = clock_timestamp()
  WHERE id = p_event_id
    AND status = 'PROCESSING'
    AND locked_by = p_worker_id
    AND lease_token = p_lease_token
    AND locked_until >= clock_timestamp();

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$$;
ALTER FUNCTION public.complete_outbox_event(uuid, text, uuid) OWNER TO teamos_outbox_admin;

CREATE OR REPLACE FUNCTION public.fail_outbox_event(
  p_event_id uuid,
  p_worker_id text,
  p_lease_token uuid,
  p_error_message text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  v_safe_error text;
  v_result text;
BEGIN
  IF p_worker_id IS NULL OR btrim(p_worker_id) = '' THEN
    RAISE EXCEPTION 'worker_id is required';
  END IF;

  IF p_lease_token IS NULL THEN
    RAISE EXCEPTION 'lease_token is required';
  END IF;

  -- Multi-pass regex error sanitization (strip credentials, secrets, tokens, JWTs)
  v_safe_error := coalesce(p_error_message, 'Unknown error');
  v_safe_error := regexp_replace(v_safe_error, '([a-zA-Z]+://[^:]+:)[^@]+(@)', '\1[REDACTED]\2', 'g');
  v_safe_error := regexp_replace(v_safe_error, 'Bearer\s+[A-Za-z0-9_\-\.~+/]+=*', 'Bearer [REDACTED]', 'gi');
  v_safe_error := regexp_replace(v_safe_error, 'ey[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]+', '[REDACTED_JWT]', 'g');
  v_safe_error := regexp_replace(v_safe_error, '(gh[pousr]_[A-Za-z0-9_]{10,}|github_pat_[A-Za-z0-9_]{10,}|sk-[A-Za-z0-9_]{10,})', '[REDACTED_TOKEN]', 'g');
  v_safe_error := regexp_replace(v_safe_error, '(?i)("(?:[a-z0-9_]*(?:password|secret|token|api_key|apikey|auth)[a-z0-9_]*)"\s*:\s*")[^"]+(")', '\1[REDACTED]\2', 'g');
  v_safe_error := regexp_replace(v_safe_error, '([a-zA-Z0-9_-]*(password|secret|token|api_key|apikey|auth)[a-zA-Z0-9_-]*)(\s*[:=]\s*)([^\s,;"]+)', '\1\3[REDACTED]', 'gi');
  v_safe_error := substr(v_safe_error, 1, 1000);

  -- Atomic single-statement update enforcing strict lease, worker, and expiration check
  UPDATE public.outbox_events
  SET status = CASE
        WHEN attempts >= max_attempts THEN 'DEAD'::public."OutboxStatus"
        ELSE 'PENDING'::public."OutboxStatus"
      END,
      locked_by = NULL,
      locked_until = NULL,
      lease_token = NULL,
      available_at = CASE
        WHEN attempts >= max_attempts THEN available_at
        ELSE clock_timestamp() + (least(3600, power(2, attempts)::int) || ' seconds')::interval
      END,
      processed_at = CASE
        WHEN attempts >= max_attempts THEN clock_timestamp()
        ELSE NULL
      END,
      last_error = v_safe_error
  WHERE id = p_event_id
    AND status = 'PROCESSING'
    AND locked_by = p_worker_id
    AND lease_token = p_lease_token
    AND locked_until >= clock_timestamp()
  RETURNING status::text INTO v_result;

  IF v_result IS NULL THEN
    RETURN 'STALE_LEASE_OR_UNAUTHORIZED';
  END IF;

  RETURN v_result;
END;
$$;
ALTER FUNCTION public.fail_outbox_event(uuid, text, uuid, text) OWNER TO teamos_outbox_admin;

-- 14. Grant Role Permissions
-- API Role: Full CRUD on business tables, Append-only on Audit, Insert-only on Outbox
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organizations, public.memberships, public.projects, public.tasks, public.task_dependencies TO teamos_api_role;
GRANT SELECT, INSERT, UPDATE ON public.users TO teamos_api_role;
GRANT SELECT, INSERT ON public.audit_events TO teamos_api_role;
GRANT SELECT, INSERT ON public.outbox_events TO teamos_api_role;

-- Worker Role: CRUD on business tables via RLS, Execute on claim/complete/fail functions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organizations, public.memberships, public.projects, public.tasks, public.task_dependencies, public.audit_events TO teamos_worker_role;
GRANT SELECT ON public.users TO teamos_worker_role;
GRANT INSERT ON public.outbox_events TO teamos_worker_role;

REVOKE ALL ON FUNCTION public.claim_next_outbox_event(text, int) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.complete_outbox_event(uuid, text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fail_outbox_event(uuid, text, uuid, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.claim_next_outbox_event(text, int) TO teamos_worker_role;
GRANT EXECUTE ON FUNCTION public.complete_outbox_event(uuid, text, uuid) TO teamos_worker_role;
GRANT EXECUTE ON FUNCTION public.fail_outbox_event(uuid, text, uuid, text) TO teamos_worker_role;

-- Outbox Admin grant
GRANT SELECT, INSERT, UPDATE, DELETE ON public.outbox_events TO teamos_outbox_admin;
