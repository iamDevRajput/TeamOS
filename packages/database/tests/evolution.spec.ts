import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { Pool } from 'pg';
import crypto from 'crypto';
import {
  createApiPrismaClient,
  createOrganization,
  createProject,
  createTask,
  withTenant,
  createMeeting,
  listMeetings,
  getMeetingById,
  addTranscriptSegments,
  addMeetingActionProposals,
  updateMeetingActionProposalStatus,
  upsertWorkspaceEmbedding,
  searchWorkspaceEmbeddings,
  findSimilarTasks,
  createNotification,
  listNotifications,
  markNotificationRead,
  getUnreadNotificationCount,
  recordCopilotMessage,
  listCopilotMessages,
  OrgRole,
  TenantContext,
} from '../src/index';

const API_DB_URL =
  process.env.DATABASE_URL ||
  'postgresql://teamos_api_role:teamos_api_password@localhost:5432/teamos?schema=public';

const OWNER_DB_URL =
  process.env.DATABASE_URL_MIGRATION ||
  'postgresql://teamos_owner:teamos_owner_password@localhost:5432/teamos?schema=public';

describe('Ultimate Product Evolution: Collaboration, Meetings, Vector RAG & Copilot Specification', () => {
  let apiPrisma: ReturnType<typeof createApiPrismaClient>;
  let ownerPool: Pool;

  const userA = '99000000-0000-0000-0000-000000000001';
  const userB = '99000000-0000-0000-0000-000000000002';

  let orgAId: string;
  let orgBId: string;
  let projectAId: string;
  let projectBId: string;

  let contextA: TenantContext;
  let contextB: TenantContext;

  beforeAll(async () => {
    apiPrisma = createApiPrismaClient(API_DB_URL);
    ownerPool = new Pool({ connectionString: OWNER_DB_URL });
    await apiPrisma.$connect();

    // Create test users safely
    await ownerPool.query(`
      INSERT INTO public.users (id, github_user_id, login, display_name)
      VALUES 
        ('${userA}', 9901, 'evol-user-a', 'Evolution User A'),
        ('${userB}', 9902, 'evol-user-b', 'Evolution User B')
      ON CONFLICT (id) DO NOTHING;
    `);

    // Create Org A
    const slugA = `evol-org-a-${crypto.randomBytes(4).toString('hex')}`;
    const orgAResult = await createOrganization(apiPrisma, userA, 'Evolution Org A', slugA);
    orgAId = orgAResult.organization.id;
    contextA = { orgId: orgAId, userId: userA, role: OrgRole.OWNER };

    // Create Org B
    const slugB = `evol-org-b-${crypto.randomBytes(4).toString('hex')}`;
    const orgBResult = await createOrganization(apiPrisma, userB, 'Evolution Org B', slugB);
    orgBId = orgBResult.organization.id;
    contextB = { orgId: orgBId, userId: userB, role: OrgRole.OWNER };

    // Create Project A
    const pA = await createProject(contextA, {
      name: 'Project Alpha',
      key: 'ALPHA',
      timezone: 'UTC',
    });
    projectAId = pA.id;

    // Create Project B
    const pB = await createProject(contextB, {
      name: 'Project Beta',
      key: 'BETA',
      timezone: 'UTC',
    });
    projectBId = pB.id;
  });

  afterAll(async () => {
    try {
      if (orgAId) await ownerPool.query('DELETE FROM public.organizations WHERE id = $1', [orgAId]);
      if (orgBId) await ownerPool.query('DELETE FROM public.organizations WHERE id = $1', [orgBId]);
      await ownerPool.query('DELETE FROM public.users WHERE id IN ($1, $2)', [userA, userB]);
    } finally {
      await apiPrisma.$disconnect();
      await ownerPool.end();
    }
  });

  describe('1. Meeting Intelligence & Multi-Tenant Isolation', () => {
    let meetingAId: string;

    it('creates a meeting record with segments and action proposals in Org A', async () => {
      const created = await withTenant(contextA, async (tx) => {
        const m = await createMeeting(tx, orgAId, {
          projectId: projectAId,
          title: 'Sprint 1 Architecture Sync',
          transcript: 'Dev: We must complete OAuth before launching.\nSarah: I will handle the webhook retry buffer.',
          createdByUserId: userA,
        });

        await addTranscriptSegments(tx, orgAId, m.id, [
          { speaker: 'Dev', startTimeSeconds: 0, endTimeSeconds: 15, text: 'We must complete OAuth before launching.' },
          { speaker: 'Sarah', startTimeSeconds: 15, endTimeSeconds: 30, text: 'I will handle the webhook retry buffer.' },
        ]);

        await addMeetingActionProposals(tx, orgAId, projectAId, m.id, [
          {
            actionItem: 'Handle webhook retry buffer',
            confidence: 0.95,
            supportingEvidence: 'Sarah: I will handle the webhook retry buffer.',
          },
        ]);

        return getMeetingById(tx, orgAId, m.id);
      });

      expect(created).toBeDefined();
      expect(created?.title).toBe('Sprint 1 Architecture Sync');
      expect(created?.transcriptSegments.length).toBe(2);
      expect(created?.actionProposals.length).toBe(1);
      expect(created?.actionProposals[0].status).toBe('PENDING');
      meetingAId = created!.id;
    });

    it('enforces forced RLS: Org B cannot see Org A meeting', async () => {
      const resultB = await withTenant(contextB, async (tx) => {
        return getMeetingById(tx, orgBId, meetingAId);
      });
      expect(resultB).toBeNull();

      const listB = await withTenant(contextB, async (tx) => {
        return listMeetings(tx, orgBId, projectBId);
      });
      expect(listB.length).toBe(0);
    });

    it('converts an action proposal to CONVERTED status', async () => {
      await withTenant(contextA, async (tx) => {
        const meeting = await getMeetingById(tx, orgAId, meetingAId);
        const proposalId = meeting!.actionProposals[0].id;
        const updated = await updateMeetingActionProposalStatus(tx, orgAId, proposalId, 'CONVERTED');
        expect(updated.status).toBe('CONVERTED');
      });
    });
  });

  describe('2. Vector Search (pgvector) & Semantic Deduplication', () => {
    // Generate deterministic 768-dim test vector
    const mockVec1 = new Array(768).fill(0).map((_, i) => (i % 2 === 0 ? 0.05 : -0.05));
    const mockVecQuery = new Array(768).fill(0).map((_, i) => (i % 2 === 0 ? 0.048 : -0.048));

    it('upserts vector embedding and retrieves via cosine distance', async () => {
      const fakeTaskId = crypto.randomUUID();

      await withTenant(contextA, async (tx) => {
        await upsertWorkspaceEmbedding(tx, orgAId, {
          projectId: projectAId,
          sourceType: 'TASK',
          sourceId: fakeTaskId,
          contentText: 'Implement GitHub OAuth login with secure cookie session',
          embedding: mockVec1,
          metadata: { title: 'GitHub OAuth Login' },
        });

        const results = await searchWorkspaceEmbeddings(tx, orgAId, {
          queryEmbedding: mockVecQuery,
          projectId: projectAId,
          limit: 5,
        });

        expect(results.length).toBeGreaterThan(0);
        expect(results[0].sourceId).toBe(fakeTaskId);
        expect(results[0].score).toBeGreaterThan(0.95); // High cosine similarity
      });
    });

    it('enforces strict tenant isolation for vector embeddings', async () => {
      const resultsB = await withTenant(contextB, async (tx) => {
        return searchWorkspaceEmbeddings(tx, orgBId, {
          queryEmbedding: mockVecQuery,
          limit: 5,
        });
      });
      expect(resultsB.length).toBe(0);
    });

    it('detects duplicate tasks using semantic similarity', async () => {
      // Create concrete task in Project A
      const taskA = await createTask(contextA, projectAId, {
        title: 'GitHub Webhook Signature Verification',
        description: 'Verify HMAC SHA-256 signatures with constant time comparison',
      });

      // Index task embedding
      await withTenant(contextA, async (tx) => {
        await upsertWorkspaceEmbedding(tx, orgAId, {
          projectId: projectAId,
          sourceType: 'TASK',
          sourceId: taskA.id,
          contentText: 'GitHub Webhook Signature Verification HMAC SHA-256',
          embedding: mockVec1,
          metadata: { title: taskA.title },
        });

        const duplicates = await findSimilarTasks(tx, orgAId, {
          projectId: projectAId,
          taskEmbedding: mockVecQuery,
          title: 'Verify GitHub Webhook HMAC Signatures',
        });

        expect(duplicates.length).toBeGreaterThan(0);
        expect(duplicates.some((d) => d.sourceId === taskA.id)).toBe(true);
        expect(duplicates[0].score).toBeGreaterThan(0.85);
      });
    });
  });

  describe('3. Notifications & Deadline Automation', () => {
    let notifId: string;

    it('creates notification and queries unread count', async () => {
      await withTenant(contextA, async (tx) => {
        const notif = await createNotification(tx, orgAId, {
          userId: userA,
          type: 'DEADLINE_APPROACHING',
          title: 'Task Due Tomorrow',
          body: 'Task #1 is due in 24 hours.',
          entityType: 'task',
          entityId: crypto.randomUUID(),
        });
        notifId = notif.id;

        const count = await getUnreadNotificationCount(tx, orgAId, userA);
        expect(count).toBe(1);

        const list = await listNotifications(tx, orgAId, userA);
        expect(list.length).toBe(1);
        expect(list[0].title).toBe('Task Due Tomorrow');
      });
    });

    it('marks notification as read', async () => {
      await withTenant(contextA, async (tx) => {
        await markNotificationRead(tx, orgAId, notifId, userA);
        const count = await getUnreadNotificationCount(tx, orgAId, userA);
        expect(count).toBe(0);
      });
    });

    it('enforces forced RLS: Org B cannot see Org A notifications', async () => {
      await withTenant(contextB, async (tx) => {
        const listB = await listNotifications(tx, orgBId, userB);
        expect(listB.length).toBe(0);
        const countB = await getUnreadNotificationCount(tx, orgBId, userB);
        expect(countB).toBe(0);
      });
    });
  });

  describe('4. Copilot Messages & Chat History', () => {
    it('records and lists copilot conversation messages', async () => {
      await withTenant(contextA, async (tx) => {
        await recordCopilotMessage(tx, orgAId, {
          projectId: projectAId,
          userId: userA,
          role: 'user',
          content: 'What is the current delivery risk?',
        });

        await recordCopilotMessage(tx, orgAId, {
          projectId: projectAId,
          userId: userA,
          role: 'assistant',
          content: 'The team is currently on track to hit the target date.',
          citations: [{ type: 'task', id: 'task-1', title: 'Task 1' }],
        });

        const history = await listCopilotMessages(tx, orgAId, projectAId);
        expect(history.length).toBe(2);
        expect(history[0].role).toBe('user');
        expect(history[1].role).toBe('assistant');
      });
    });

    it('enforces forced RLS: Org B cannot access Org A copilot history', async () => {
      await withTenant(contextB, async (tx) => {
        const historyB = await listCopilotMessages(tx, orgBId, projectBId);
        expect(historyB.length).toBe(0);
      });
    });
  });
});
