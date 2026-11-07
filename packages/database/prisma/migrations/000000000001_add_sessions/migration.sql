-- TeamOS Milestone: Add Sessions, Identity Security & Restricted Stored Procedures

-- 1. Alter Users Table
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS avatar_url text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS updated_at timestamptz(6) NOT NULL DEFAULT clock_timestamp();

-- 2. Create Sessions Table (No IP address stored; user_agent capped to 255 chars)
CREATE TABLE IF NOT EXISTS public.sessions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  session_token_hash text NOT NULL UNIQUE,
  expires_at timestamptz(6) NOT NULL,
  created_at timestamptz(6) NOT NULL DEFAULT clock_timestamp(),
  last_active_at timestamptz(6) NOT NULL DEFAULT clock_timestamp(),
  user_agent varchar(255)
);

CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON public.sessions(user_id);
CREATE INDEX IF NOT EXISTS sessions_expires_at_idx ON public.sessions(expires_at);

-- 3. Transfer Ownership to teamos_identity_admin
ALTER TABLE public.sessions OWNER TO teamos_identity_admin;

-- 4. Grant Minimum Required Privileges to teamos_identity_admin
GRANT USAGE ON SCHEMA public TO teamos_identity_admin;
GRANT SELECT (id, login, display_name, avatar_url) ON public.users TO teamos_identity_admin;
GRANT SELECT ON public.memberships TO teamos_identity_admin;
CREATE POLICY identity_admin_users_read ON public.users FOR SELECT TO teamos_identity_admin USING (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sessions TO teamos_identity_admin;

-- 5. Deploy the 5 Hardened SECURITY DEFINER Functions
CREATE OR REPLACE FUNCTION public.create_session(
  p_user_id uuid,
  p_token_hash text,
  p_ttl_seconds int DEFAULT 1209600,
  p_user_agent text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  v_session_id uuid;
BEGIN
  IF p_user_id IS NULL OR p_token_hash IS NULL OR btrim(p_token_hash) = '' THEN
    RAISE EXCEPTION 'user_id and token_hash are required';
  END IF;

  IF p_ttl_seconds < 60 OR p_ttl_seconds > 1209600 THEN
    RAISE EXCEPTION 'ttl_seconds must be between 60 and 1209600';
  END IF;

  INSERT INTO public.sessions (
    user_id,
    session_token_hash,
    expires_at,
    user_agent
  )
  VALUES (
    p_user_id,
    p_token_hash,
    clock_timestamp() + (p_ttl_seconds || ' seconds')::interval,
    substr(p_user_agent, 1, 255)
  )
  RETURNING id INTO v_session_id;

  RETURN v_session_id;
END;
$$;
ALTER FUNCTION public.create_session(uuid, text, int, text) OWNER TO teamos_identity_admin;

CREATE OR REPLACE FUNCTION public.resolve_session_by_hash(
  p_token_hash text
)
RETURNS TABLE (
  session_id uuid,
  user_id uuid,
  expires_at timestamptz,
  last_active_at timestamptz,
  login text,
  display_name text,
  avatar_url text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
BEGIN
  IF p_token_hash IS NULL OR btrim(p_token_hash) = '' THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT 
    s.id AS session_id,
    s.user_id,
    s.expires_at,
    s.last_active_at,
    u.login,
    u.display_name,
    u.avatar_url
  FROM public.sessions s
  JOIN public.users u ON u.id = s.user_id
  WHERE s.session_token_hash = p_token_hash
    AND s.expires_at > clock_timestamp();
END;
$$;
ALTER FUNCTION public.resolve_session_by_hash(text) OWNER TO teamos_identity_admin;

CREATE OR REPLACE FUNCTION public.touch_session(
  p_session_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  v_updated int;
BEGIN
  -- Enforces fixed 900-second (15-minute) activity update throttling policy
  UPDATE public.sessions
  SET last_active_at = clock_timestamp()
  WHERE id = p_session_id
    AND expires_at > clock_timestamp()
    AND last_active_at < (clock_timestamp() - INTERVAL '900 seconds');

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$$;
ALTER FUNCTION public.touch_session(uuid) OWNER TO teamos_identity_admin;

CREATE OR REPLACE FUNCTION public.revoke_session(
  p_token_hash text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  v_deleted int;
BEGIN
  DELETE FROM public.sessions
  WHERE session_token_hash = p_token_hash;

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted > 0;
END;
$$;
ALTER FUNCTION public.revoke_session(text) OWNER TO teamos_identity_admin;

CREATE OR REPLACE FUNCTION public.cleanup_expired_sessions()
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  v_count int;
BEGIN
  DELETE FROM public.sessions
  WHERE expires_at <= clock_timestamp();

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;
ALTER FUNCTION public.cleanup_expired_sessions() OWNER TO teamos_identity_admin;

-- 6. Role Privilege Boundaries
REVOKE ALL ON FUNCTION public.create_session(uuid, text, int, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.resolve_session_by_hash(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.touch_session(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.revoke_session(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cleanup_expired_sessions() FROM PUBLIC;

-- teamos_identity_runtime: dedicated runtime role for session issuance and resolution
GRANT EXECUTE ON FUNCTION public.create_session(uuid, text, int, text) TO teamos_identity_runtime;
GRANT EXECUTE ON FUNCTION public.resolve_session_by_hash(text) TO teamos_identity_runtime;
GRANT EXECUTE ON FUNCTION public.touch_session(uuid) TO teamos_identity_runtime;
GRANT EXECUTE ON FUNCTION public.revoke_session(text) TO teamos_identity_runtime;
GRANT SELECT, INSERT, UPDATE ON public.users TO teamos_identity_runtime;
GRANT SELECT ON public.memberships TO teamos_identity_runtime;
CREATE POLICY identity_runtime_users_read ON public.users FOR ALL TO teamos_identity_runtime USING (true) WITH CHECK (true);

-- teamos_worker_role: background worker role for expired session cleanup
GRANT EXECUTE ON FUNCTION public.cleanup_expired_sessions() TO teamos_worker_role;

-- Neither runtime role gets direct access to the sessions table
REVOKE ALL ON public.sessions FROM teamos_api_role;
REVOKE ALL ON public.sessions FROM teamos_identity_runtime;
REVOKE ALL ON public.sessions FROM teamos_worker_role;
