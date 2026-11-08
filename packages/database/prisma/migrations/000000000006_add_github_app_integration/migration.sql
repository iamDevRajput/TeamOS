-- TeamOS: Add GitHub App Integration Tables, RLS, Indexes and Grants

-- 1. GitHub Installations Table
CREATE TABLE IF NOT EXISTS public.github_installations (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  installation_id bigint NOT NULL,
  account_login text NOT NULL,
  account_id bigint NOT NULL,
  account_type text NOT NULL DEFAULT 'Organization',
  repository_selection text NOT NULL DEFAULT 'selected',
  created_by uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  created_at timestamptz(6) NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz(6) NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT uq_github_installations_org_id UNIQUE (org_id, id),
  CONSTRAINT uq_github_installations_installation_id UNIQUE (installation_id),
  CONSTRAINT uq_github_installations_org_installation UNIQUE (org_id, installation_id)
);

-- 2. GitHub Repositories Table
CREATE TABLE IF NOT EXISTS public.github_repositories (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  installation_id bigint NOT NULL REFERENCES public.github_installations(installation_id) ON DELETE CASCADE,
  project_id uuid,
  repo_id bigint NOT NULL,
  repo_name text NOT NULL,
  repo_full_name text NOT NULL,
  is_private boolean NOT NULL DEFAULT true,
  created_at timestamptz(6) NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT uq_github_repos_org_id UNIQUE (org_id, id),
  CONSTRAINT uq_github_repos_org_repo UNIQUE (org_id, repo_id),
  CONSTRAINT fk_github_repos_project FOREIGN KEY (org_id, project_id) REFERENCES public.projects(org_id, id) ON DELETE SET NULL (project_id)
);

-- 3. GitHub Webhook Ingest / Inbox Table (Delivery Deduplication)
CREATE TABLE IF NOT EXISTS public.github_webhook_deliveries (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  delivery_id text NOT NULL UNIQUE,
  event_type text NOT NULL,
  action text,
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'PENDING',
  created_at timestamptz(6) NOT NULL DEFAULT clock_timestamp(),
  processed_at timestamptz(6)
);

-- 4. Indexes
CREATE INDEX IF NOT EXISTS github_installations_org_id_idx ON public.github_installations(org_id);
CREATE INDEX IF NOT EXISTS github_repos_org_project_idx ON public.github_repositories(org_id, project_id);
CREATE INDEX IF NOT EXISTS github_repos_repo_id_idx ON public.github_repositories(repo_id);
CREATE INDEX IF NOT EXISTS github_webhook_deliveries_status_idx ON public.github_webhook_deliveries(status, created_at);

-- 5. Row-Level Security: Forced Tenant Isolation
ALTER TABLE public.github_installations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.github_installations FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_github_installations ON public.github_installations;
CREATE POLICY tenant_isolation_github_installations ON public.github_installations
  FOR ALL
  USING (org_id = (SELECT NULLIF(current_setting('app.org_id', true), '')::uuid))
  WITH CHECK (org_id = (SELECT NULLIF(current_setting('app.org_id', true), '')::uuid));

ALTER TABLE public.github_repositories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.github_repositories FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_github_repositories ON public.github_repositories;
CREATE POLICY tenant_isolation_github_repositories ON public.github_repositories
  FOR ALL
  USING (org_id = (SELECT NULLIF(current_setting('app.org_id', true), '')::uuid))
  WITH CHECK (org_id = (SELECT NULLIF(current_setting('app.org_id', true), '')::uuid));

-- 6. Role Permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.github_installations TO teamos_api_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.github_installations TO teamos_worker_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.github_repositories TO teamos_api_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.github_repositories TO teamos_worker_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.github_webhook_deliveries TO teamos_api_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.github_webhook_deliveries TO teamos_worker_role;
