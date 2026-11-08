-- TeamOS: Add Project Reports Table, Forced RLS, Indexes and Grants

-- 1. Create Table
CREATE TABLE IF NOT EXISTS public.project_reports (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id uuid NOT NULL,
  title text NOT NULL,
  summary text NOT NULL,
  delivery_risk text NOT NULL DEFAULT 'LOW',
  snapshot_hash text NOT NULL,
  snapshot jsonb NOT NULL,
  claims jsonb NOT NULL,
  created_by uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  created_at timestamptz(6) NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT fk_project_reports_project FOREIGN KEY (org_id, project_id) REFERENCES public.projects(org_id, id) ON DELETE CASCADE,
  CONSTRAINT uq_project_reports_org_id_id UNIQUE (org_id, id)
);

-- 2. Indexes
CREATE INDEX IF NOT EXISTS project_reports_org_id_idx ON public.project_reports(org_id);
CREATE INDEX IF NOT EXISTS project_reports_org_id_project_id_idx ON public.project_reports(org_id, project_id);
CREATE INDEX IF NOT EXISTS project_reports_created_at_idx ON public.project_reports(created_at DESC);

-- 3. Row-Level Security: Forced Tenant Isolation
ALTER TABLE public.project_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_reports FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_project_reports ON public.project_reports;
CREATE POLICY tenant_isolation_project_reports ON public.project_reports
  FOR ALL
  USING (org_id = (SELECT NULLIF(current_setting('app.org_id', true), '')::uuid))
  WITH CHECK (org_id = (SELECT NULLIF(current_setting('app.org_id', true), '')::uuid));

-- 4. Role Permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_reports TO teamos_api_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_reports TO teamos_worker_role;

