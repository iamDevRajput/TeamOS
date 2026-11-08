-- TeamOS: Add Proposals Table, Enums, Forced RLS and Indexes

-- 1. Enums
DO $$ BEGIN
  CREATE TYPE "ProposalKind" AS ENUM ('PLAN', 'STATUS_CHANGE');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "ProposalState" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 2. Create Table
CREATE TABLE IF NOT EXISTS public.proposals (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id uuid NOT NULL,
  kind "ProposalKind" NOT NULL DEFAULT 'PLAN',
  state "ProposalState" NOT NULL DEFAULT 'PENDING',
  title text NOT NULL,
  description text,
  payload jsonb NOT NULL,
  rejection_reason text,
  created_by uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  reviewed_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz(6) NOT NULL DEFAULT clock_timestamp(),
  reviewed_at timestamptz(6),
  CONSTRAINT fk_proposals_project FOREIGN KEY (org_id, project_id) REFERENCES public.projects(org_id, id) ON DELETE CASCADE,
  CONSTRAINT uq_proposals_org_id_id UNIQUE (org_id, id)
);

-- 3. Indexes
CREATE INDEX IF NOT EXISTS proposals_org_id_idx ON public.proposals(org_id);
CREATE INDEX IF NOT EXISTS proposals_org_id_project_id_idx ON public.proposals(org_id, project_id);
CREATE INDEX IF NOT EXISTS proposals_state_idx ON public.proposals(state);

-- 4. Row-Level Security: Forced Tenant Isolation
ALTER TABLE public.proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposals FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_proposals ON public.proposals
  FOR ALL
  USING (org_id = (SELECT NULLIF(current_setting('app.org_id', true), '')::uuid))
  WITH CHECK (org_id = (SELECT NULLIF(current_setting('app.org_id', true), '')::uuid));

-- 5. Role Permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.proposals TO teamos_api_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.proposals TO teamos_worker_role;

