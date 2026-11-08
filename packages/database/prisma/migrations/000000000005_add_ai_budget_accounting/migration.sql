-- TeamOS: Add AI Budget Reservations Table, Enum, Forced RLS, Indexes and Grants

-- 1. Create Enum
DO $$ BEGIN
  CREATE TYPE "AiReservationState" AS ENUM ('RESERVED', 'SETTLED', 'RELEASED', 'AWAITING_RECONCILIATION');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 2. Create Table
CREATE TABLE IF NOT EXISTS public.ai_budget_reservations (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  idempotency_key text NOT NULL,
  reserved_amount_cents int NOT NULL,
  settled_amount_cents int,
  state "AiReservationState" NOT NULL DEFAULT 'RESERVED',
  model_id text NOT NULL,
  period_key text NOT NULL,
  error_message text,
  created_at timestamptz(6) NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz(6) NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT uq_ai_reservations_org_idempotency UNIQUE (org_id, idempotency_key),
  CONSTRAINT uq_ai_reservations_org_id_id UNIQUE (org_id, id)
);

-- 3. Indexes
CREATE INDEX IF NOT EXISTS ai_reservations_org_period_state_idx 
  ON public.ai_budget_reservations(org_id, period_key, state);

CREATE INDEX IF NOT EXISTS ai_reservations_org_created_at_idx
  ON public.ai_budget_reservations(org_id, created_at DESC);

-- 4. Row-Level Security: Forced Tenant Isolation
ALTER TABLE public.ai_budget_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_budget_reservations FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_ai_reservations ON public.ai_budget_reservations;
CREATE POLICY tenant_isolation_ai_reservations ON public.ai_budget_reservations
  FOR ALL
  USING (org_id = (SELECT NULLIF(current_setting('app.org_id', true), '')::uuid))
  WITH CHECK (org_id = (SELECT NULLIF(current_setting('app.org_id', true), '')::uuid));

-- 5. Role Permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_budget_reservations TO teamos_api_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_budget_reservations TO teamos_worker_role;

