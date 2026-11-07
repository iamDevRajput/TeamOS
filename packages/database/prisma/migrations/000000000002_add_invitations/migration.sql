-- TeamOS Milestone 4: Add Invitations, Tenant Isolation & Secure Acceptance Functions

-- 1. Create Invitations Table
CREATE TABLE IF NOT EXISTS public.invitations (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  email text,
  role "OrgRole" NOT NULL DEFAULT 'MEMBER',
  created_by uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  expires_at timestamptz(6) NOT NULL,
  created_at timestamptz(6) NOT NULL DEFAULT clock_timestamp(),
  revoked_at timestamptz(6),
  accepted_at timestamptz(6),
  accepted_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  CONSTRAINT uq_invitations_org_id_id UNIQUE (org_id, id)
);

-- 2. Indexes
CREATE INDEX IF NOT EXISTS invitations_org_id_idx ON public.invitations(org_id);
CREATE INDEX IF NOT EXISTS invitations_token_hash_idx ON public.invitations(token_hash);
CREATE INDEX IF NOT EXISTS invitations_expires_at_idx ON public.invitations(expires_at);

-- 3. Row-Level Security: Forced Tenant Isolation
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invitations FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_invitations ON public.invitations
  FOR ALL
  USING (org_id = (SELECT NULLIF(current_setting('app.org_id', true), '')::uuid))
  WITH CHECK (org_id = (SELECT NULLIF(current_setting('app.org_id', true), '')::uuid));

-- 4. Role Permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invitations TO teamos_api_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invitations TO teamos_worker_role;

-- 5. Stored Procedure: Get Invitation by Token Hash (Metadata inspection before membership)
CREATE OR REPLACE FUNCTION public.get_invitation_by_token(p_token_hash text)
RETURNS TABLE (
  invitation_id uuid,
  org_id uuid,
  org_name text,
  org_slug text,
  email text,
  role public."OrgRole",
  expires_at timestamptz,
  created_at timestamptz,
  is_valid boolean,
  invalid_reason text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  v_inv RECORD;
BEGIN
  IF p_token_hash IS NULL OR btrim(p_token_hash) = '' THEN
    RETURN;
  END IF;

  SELECT 
    i.id,
    i.org_id,
    o.name AS org_name,
    o.slug AS org_slug,
    i.email,
    i.role,
    i.expires_at,
    i.created_at,
    i.revoked_at,
    i.accepted_at
  INTO v_inv
  FROM public.invitations i
  JOIN public.organizations o ON o.id = i.org_id
  WHERE i.token_hash = p_token_hash;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  invitation_id := v_inv.id;
  org_id := v_inv.org_id;
  org_name := v_inv.org_name;
  org_slug := v_inv.org_slug;
  email := v_inv.email;
  role := v_inv.role;
  expires_at := v_inv.expires_at;
  created_at := v_inv.created_at;

  IF v_inv.revoked_at IS NOT NULL THEN
    is_valid := false;
    invalid_reason := 'REVOKED';
  ELSIF v_inv.accepted_at IS NOT NULL THEN
    is_valid := false;
    invalid_reason := 'ALREADY_ACCEPTED';
  ELSIF v_inv.expires_at <= clock_timestamp() THEN
    is_valid := false;
    invalid_reason := 'EXPIRED';
  ELSE
    is_valid := true;
    invalid_reason := NULL;
  END IF;

  RETURN NEXT;
END;
$$;

-- 6. Stored Procedure: Accept Invitation (Atomic bootstrap with concurrency control)
CREATE OR REPLACE FUNCTION public.accept_invitation(
  p_token_hash text,
  p_user_id uuid
)
RETURNS TABLE (
  success boolean,
  org_id uuid,
  org_slug text,
  role public."OrgRole",
  message text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  v_inv RECORD;
  v_existing_membership RECORD;
BEGIN
  IF p_token_hash IS NULL OR p_user_id IS NULL THEN
    RETURN QUERY SELECT false, NULL::uuid, NULL::text, NULL::public."OrgRole", 'Invalid parameters'::text;
    RETURN;
  END IF;

  -- Concurrency control: Lock the invitation row FOR UPDATE
  SELECT i.*, o.slug AS org_slug
  INTO v_inv
  FROM public.invitations i
  JOIN public.organizations o ON o.id = i.org_id
  WHERE i.token_hash = p_token_hash
  FOR UPDATE OF i;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::uuid, NULL::text, NULL::public."OrgRole", 'Invitation not found'::text;
    RETURN;
  END IF;

  -- Check if already accepted
  IF v_inv.accepted_at IS NOT NULL THEN
    IF v_inv.accepted_by = p_user_id THEN
      -- Idempotent return for same user
      RETURN QUERY SELECT true, v_inv.org_id, v_inv.org_slug, v_inv.role, 'Already accepted by user'::text;
      RETURN;
    ELSE
      RETURN QUERY SELECT false, v_inv.org_id, v_inv.org_slug, v_inv.role, 'Invitation has already been accepted'::text;
      RETURN;
    END IF;
  END IF;

  -- Check revocation
  IF v_inv.revoked_at IS NOT NULL THEN
    RETURN QUERY SELECT false, v_inv.org_id, v_inv.org_slug, v_inv.role, 'Invitation has been revoked'::text;
    RETURN;
  END IF;

  -- Check expiry
  IF v_inv.expires_at <= clock_timestamp() THEN
    RETURN QUERY SELECT false, v_inv.org_id, v_inv.org_slug, v_inv.role, 'Invitation has expired'::text;
    RETURN;
  END IF;

  -- Check if user is already a member
  SELECT m.role INTO v_existing_membership
  FROM public.memberships m
  WHERE m.org_id = v_inv.org_id AND m.user_id = p_user_id;

  IF FOUND THEN
    -- Mark invitation accepted
    UPDATE public.invitations
    SET accepted_at = clock_timestamp(), accepted_by = p_user_id
    WHERE id = v_inv.id;

    RETURN QUERY SELECT true, v_inv.org_id, v_inv.org_slug, v_existing_membership.role, 'User is already a member'::text;
    RETURN;
  END IF;

  -- Create membership
  INSERT INTO public.memberships (org_id, user_id, role, created_at)
  VALUES (v_inv.org_id, p_user_id, v_inv.role, clock_timestamp());

  -- Mark invitation accepted
  UPDATE public.invitations
  SET accepted_at = clock_timestamp(), accepted_by = p_user_id
  WHERE id = v_inv.id;

  RETURN QUERY SELECT true, v_inv.org_id, v_inv.org_slug, v_inv.role, 'Invitation accepted successfully'::text;
END;
$$;

-- 7. Secure Grants
REVOKE ALL ON FUNCTION public.get_invitation_by_token(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.accept_invitation(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_invitation_by_token(text) TO teamos_api_role;
GRANT EXECUTE ON FUNCTION public.accept_invitation(text, uuid) TO teamos_api_role;

-- 8. Organization Creation & Membership Verification Functions
CREATE OR REPLACE FUNCTION public.create_organization(
  p_user_id uuid,
  p_name text,
  p_slug text
)
RETURNS TABLE (
  org_id uuid,
  org_name text,
  org_slug text,
  user_role public."OrgRole",
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  v_org_id uuid;
  v_created_at timestamptz;
BEGIN
  IF p_user_id IS NULL OR p_name IS NULL OR p_slug IS NULL THEN
    RAISE EXCEPTION 'user_id, name and slug are required';
  END IF;

  INSERT INTO public.organizations (name, slug)
  VALUES (p_name, p_slug)
  RETURNING organizations.id, organizations.created_at INTO v_org_id, v_created_at;

  INSERT INTO public.memberships (org_id, user_id, role, created_at)
  VALUES (v_org_id, p_user_id, 'OWNER'::public."OrgRole", v_created_at);

  RETURN QUERY SELECT v_org_id, p_name, p_slug, 'OWNER'::public."OrgRole", v_created_at;
END;
$$;

CREATE OR REPLACE FUNCTION public.list_user_organizations(p_user_id uuid)
RETURNS TABLE (
  org_id uuid,
  org_name text,
  org_slug text,
  user_role public."OrgRole",
  member_count bigint,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
BEGIN
  IF p_user_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT 
    o.id AS org_id,
    o.name AS org_name,
    o.slug AS org_slug,
    m.role AS user_role,
    (SELECT count(*) FROM public.memberships m2 WHERE m2.org_id = o.id) AS member_count,
    o.created_at
  FROM public.memberships m
  JOIN public.organizations o ON o.id = m.org_id
  WHERE m.user_id = p_user_id
  ORDER BY o.created_at ASC;
END;
$$;

CREATE OR REPLACE FUNCTION public.check_membership(p_org_id uuid, p_user_id uuid)
RETURNS TABLE (
  org_id uuid,
  user_id uuid,
  role public."OrgRole",
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
BEGIN
  RETURN QUERY
  SELECT m.org_id, m.user_id, m.role, m.created_at
  FROM public.memberships m
  WHERE m.org_id = p_org_id AND m.user_id = p_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_organization(uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.list_user_organizations(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.check_membership(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_organization(uuid, text, text) TO teamos_api_role;
GRANT EXECUTE ON FUNCTION public.list_user_organizations(uuid) TO teamos_api_role;
GRANT EXECUTE ON FUNCTION public.check_membership(uuid, uuid) TO teamos_api_role;
