-- Migration: 000000000008_add_collaboration_meetings_rag_copilot
-- Additive migration for Meetings, Transcript Segments, Action Proposals, Workspace Embeddings (pgvector), Notifications, and AI Copilot

-- 1. Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Meetings Table
CREATE TABLE IF NOT EXISTS public.meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id UUID NOT NULL,
  title TEXT NOT NULL,
  meeting_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  participants TEXT[] NOT NULL DEFAULT '{}',
  audio_url TEXT,
  transcript TEXT,
  status TEXT NOT NULL DEFAULT 'COMPLETED',
  created_by_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_meetings_org_id UNIQUE (org_id, id),
  CONSTRAINT fk_meetings_project FOREIGN KEY (org_id, project_id) REFERENCES public.projects(org_id, id) ON DELETE CASCADE
);

ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meetings FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_meetings ON public.meetings
  USING (org_id = nullif(current_setting('app.org_id', true), '')::uuid);

CREATE INDEX IF NOT EXISTS idx_meetings_org_project ON public.meetings(org_id, project_id, meeting_date DESC);

-- 3. Transcript Segments Table
CREATE TABLE IF NOT EXISTS public.transcript_segments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  meeting_id UUID NOT NULL,
  speaker TEXT NOT NULL,
  start_time_seconds DOUBLE PRECISION NOT NULL,
  end_time_seconds DOUBLE PRECISION NOT NULL,
  text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_transcript_segments_org_id UNIQUE (org_id, id),
  CONSTRAINT fk_transcript_segments_meeting FOREIGN KEY (org_id, meeting_id) REFERENCES public.meetings(org_id, id) ON DELETE CASCADE
);

ALTER TABLE public.transcript_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transcript_segments FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_transcript_segments ON public.transcript_segments
  USING (org_id = nullif(current_setting('app.org_id', true), '')::uuid);

CREATE INDEX IF NOT EXISTS idx_transcript_segments_meeting ON public.transcript_segments(org_id, meeting_id);

-- 4. Meeting Action Proposals Table
CREATE TABLE IF NOT EXISTS public.meeting_action_proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id UUID NOT NULL,
  meeting_id UUID NOT NULL,
  action_item TEXT NOT NULL,
  suggested_assignee_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  suggested_deadline TIMESTAMPTZ,
  confidence DOUBLE PRECISION NOT NULL DEFAULT 0.9,
  supporting_evidence TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING',
  converted_task_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_meeting_action_proposals_org_id UNIQUE (org_id, id),
  CONSTRAINT fk_meeting_proposals_project FOREIGN KEY (org_id, project_id) REFERENCES public.projects(org_id, id) ON DELETE CASCADE,
  CONSTRAINT fk_meeting_proposals_meeting FOREIGN KEY (org_id, meeting_id) REFERENCES public.meetings(org_id, id) ON DELETE CASCADE,
  CONSTRAINT fk_meeting_proposals_converted_task FOREIGN KEY (org_id, converted_task_id) REFERENCES public.tasks(org_id, id) ON DELETE SET NULL
);

ALTER TABLE public.meeting_action_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_action_proposals FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_meeting_action_proposals ON public.meeting_action_proposals
  USING (org_id = nullif(current_setting('app.org_id', true), '')::uuid);

CREATE INDEX IF NOT EXISTS idx_meeting_proposals_meeting ON public.meeting_action_proposals(org_id, meeting_id, status);

-- 5. Workspace Embeddings Table (pgvector hybrid search)
CREATE TABLE IF NOT EXISTS public.workspace_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id UUID,
  source_type TEXT NOT NULL,
  source_id UUID NOT NULL,
  chunk_index INTEGER NOT NULL DEFAULT 0,
  content_text TEXT NOT NULL,
  embedding vector(768),
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_workspace_embeddings_org_id UNIQUE (org_id, id)
);

ALTER TABLE public.workspace_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_embeddings FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_workspace_embeddings ON public.workspace_embeddings
  USING (org_id = nullif(current_setting('app.org_id', true), '')::uuid);

CREATE INDEX IF NOT EXISTS idx_workspace_embeddings_lookup ON public.workspace_embeddings(org_id, project_id, source_type);

-- 6. Notifications Table
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_notifications_org_id UNIQUE (org_id, id)
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_notifications ON public.notifications
  USING (org_id = nullif(current_setting('app.org_id', true), '')::uuid);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(org_id, user_id, read_at, created_at DESC);

-- 7. Copilot Messages Table
CREATE TABLE IF NOT EXISTS public.copilot_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id UUID NOT NULL,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  simulation_payload JSONB,
  citations JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_copilot_messages_org_id UNIQUE (org_id, id),
  CONSTRAINT fk_copilot_messages_project FOREIGN KEY (org_id, project_id) REFERENCES public.projects(org_id, id) ON DELETE CASCADE
);

ALTER TABLE public.copilot_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.copilot_messages FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_copilot_messages ON public.copilot_messages
  USING (org_id = nullif(current_setting('app.org_id', true), '')::uuid);

CREATE INDEX IF NOT EXISTS idx_copilot_messages_project ON public.copilot_messages(org_id, project_id, created_at ASC);

-- 8. Table Permissions for Runtime Roles
GRANT SELECT, INSERT, UPDATE, DELETE ON public.meetings, public.transcript_segments, public.meeting_action_proposals, public.workspace_embeddings, public.notifications, public.copilot_messages TO teamos_api_role, teamos_worker_role;
