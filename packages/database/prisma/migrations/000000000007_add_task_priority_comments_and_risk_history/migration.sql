-- TeamOS Migration 000000000007: Add Task Priority, Comments, GitHub PR Links, and Project Risk History

-- 1. Create TaskPriority Enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TaskPriority') THEN
    CREATE TYPE public."TaskPriority" AS ENUM ('URGENT', 'HIGH', 'MEDIUM', 'LOW');
  END IF;
END $$;

-- 2. Add priority column to tasks table (with safe default 'MEDIUM')
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS priority public."TaskPriority" NOT NULL DEFAULT 'MEDIUM';

-- 3. Task Comments Table
CREATE TABLE IF NOT EXISTS public.task_comments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  task_id uuid NOT NULL,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  body text NOT NULL,
  created_at timestamptz(6) NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz(6) NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT uq_task_comments_org_id UNIQUE (org_id, id),
  CONSTRAINT fk_task_comments_task FOREIGN KEY (org_id, task_id) REFERENCES public.tasks(org_id, id) ON DELETE CASCADE
);

-- 4. Task GitHub Links Table (Verified PR-to-Task Linkage & Stalled Evidence)
CREATE TABLE IF NOT EXISTS public.task_github_links (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  task_id uuid NOT NULL,
  pr_number integer NOT NULL,
  pr_title text NOT NULL,
  pr_url text NOT NULL,
  pr_branch text NOT NULL,
  pr_state text NOT NULL DEFAULT 'OPEN',
  is_stalled boolean NOT NULL DEFAULT false,
  last_activity_at timestamptz(6) NOT NULL DEFAULT clock_timestamp(),
  created_at timestamptz(6) NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz(6) NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT uq_task_github_links_org_id UNIQUE (org_id, id),
  CONSTRAINT uq_task_github_links_org_task_pr UNIQUE (org_id, task_id, pr_number),
  CONSTRAINT fk_task_github_links_task FOREIGN KEY (org_id, task_id) REFERENCES public.tasks(org_id, id) ON DELETE CASCADE
);

-- 5. Project Risk History Table (Historical Snapshots & 30-Day Trend)
CREATE TABLE IF NOT EXISTS public.project_risk_history (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id uuid NOT NULL,
  snapshot_date date NOT NULL,
  target_date date,
  forecast_date date,
  schedule_variance_days integer NOT NULL DEFAULT 0,
  critical_path_duration integer NOT NULL DEFAULT 0,
  critical_task_count integer NOT NULL DEFAULT 0,
  risk_level text NOT NULL DEFAULT 'LOW',
  snapshot_hash text NOT NULL,
  created_at timestamptz(6) NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT uq_project_risk_history_org_id UNIQUE (org_id, id),
  CONSTRAINT uq_project_risk_history_org_project_date UNIQUE (org_id, project_id, snapshot_date),
  CONSTRAINT fk_project_risk_history_project FOREIGN KEY (org_id, project_id) REFERENCES public.projects(org_id, id) ON DELETE CASCADE
);

-- 6. Indexes
CREATE INDEX IF NOT EXISTS tasks_priority_idx ON public.tasks(org_id, priority);
CREATE INDEX IF NOT EXISTS task_comments_org_task_idx ON public.task_comments(org_id, task_id);
CREATE INDEX IF NOT EXISTS task_comments_org_user_idx ON public.task_comments(org_id, user_id);
CREATE INDEX IF NOT EXISTS task_github_links_org_task_idx ON public.task_github_links(org_id, task_id);
CREATE INDEX IF NOT EXISTS project_risk_history_lookup_idx ON public.project_risk_history(org_id, project_id, snapshot_date);

-- 7. Row-Level Security: Forced Tenant Isolation
ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_comments FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_task_comments ON public.task_comments;
CREATE POLICY tenant_isolation_task_comments ON public.task_comments
  FOR ALL
  USING (org_id = (SELECT NULLIF(current_setting('app.org_id', true), '')::uuid))
  WITH CHECK (org_id = (SELECT NULLIF(current_setting('app.org_id', true), '')::uuid));

ALTER TABLE public.task_github_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_github_links FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_task_github_links ON public.task_github_links;
CREATE POLICY tenant_isolation_task_github_links ON public.task_github_links
  FOR ALL
  USING (org_id = (SELECT NULLIF(current_setting('app.org_id', true), '')::uuid))
  WITH CHECK (org_id = (SELECT NULLIF(current_setting('app.org_id', true), '')::uuid));

ALTER TABLE public.project_risk_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_risk_history FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_project_risk_history ON public.project_risk_history;
CREATE POLICY tenant_isolation_project_risk_history ON public.project_risk_history
  FOR ALL
  USING (org_id = (SELECT NULLIF(current_setting('app.org_id', true), '')::uuid))
  WITH CHECK (org_id = (SELECT NULLIF(current_setting('app.org_id', true), '')::uuid));

-- 8. Role Permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_comments TO teamos_api_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_comments TO teamos_worker_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_github_links TO teamos_api_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_github_links TO teamos_worker_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_risk_history TO teamos_api_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_risk_history TO teamos_worker_role;
