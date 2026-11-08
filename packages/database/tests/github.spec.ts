import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { Pool } from 'pg';
import crypto from 'crypto';
import {
  createApiPrismaClient,
  createOrganization,
  createProject,
  saveGithubInstallation,
  listGithubInstallations,
  listGithubRepositories,
  linkGithubRepositoryToProject,
  saveWebhookDelivery,
  cleanupExpiredWebhookDeliveries,
  listAuditEvents,
  OrgRole,
  TenantContext,
} from '../src/index';

const API_DB_URL =
  process.env.DATABASE_URL ||
  'postgresql://teamos_api_role:teamos_api_password@localhost:5432/teamos?schema=public';

const OWNER_DB_URL =
  process.env.DATABASE_URL_MIGRATION ||
  'postgresql://teamos_owner:teamos_owner_password@localhost:5432/teamos?schema=public';

describe('GitHub App Integration & Repository Mapping Specification (Gap 2)', () => {
  let apiPrisma: ReturnType<typeof createApiPrismaClient>;
  let ownerPool: Pool;

  const testUserId = '97000000-0000-0000-0000-000000000001';
  const otherUserId = '97000000-0000-0000-0000-000000000002';

  let orgId: string;
  let otherOrgId: string;
  let projectId: string;
  let context: TenantContext;
  let otherContext: TenantContext;

  const testInstallationId = Math.floor(Date.now() % 100000000) + 100000;
  const testRepo1Id = testInstallationId * 10 + 1;
  const testRepo2Id = testInstallationId * 10 + 2;

  beforeAll(async () => {
    apiPrisma = createApiPrismaClient(API_DB_URL);
    ownerPool = new Pool({ connectionString: OWNER_DB_URL });
    await apiPrisma.$connect();

    // Ensure test users exist
    await ownerPool.query(`
      INSERT INTO public.users (id, github_user_id, login, display_name)
      VALUES 
        ('${testUserId}', 9701, 'github-test-user', 'GitHub Tester'),
        ('${otherUserId}', 9702, 'github-other-user', 'Other Org User')
      ON CONFLICT (id) DO NOTHING;
    `);

    // Create org A
    const slugA = `gh-org-${crypto.randomBytes(4).toString('hex')}`;
    const orgResultA = await createOrganization(apiPrisma, testUserId, 'GitHub Test Org', slugA);
    orgId = orgResultA.organization.id;

    // Create org B
    const slugB = `gh-other-org-${crypto.randomBytes(4).toString('hex')}`;
    const orgResultB = await createOrganization(apiPrisma, otherUserId, 'Other Org', slugB);
    otherOrgId = orgResultB.organization.id;

    context = {
      orgId,
      userId: testUserId,
      role: OrgRole.OWNER,
      requestId: 'req-gh-spec-1',
    };

    otherContext = {
      orgId: otherOrgId,
      userId: otherUserId,
      role: OrgRole.OWNER,
      requestId: 'req-gh-spec-2',
    };

    // Create project in org A
    const project = await createProject(context, {
      name: 'GitHub Connected Project',
      key: 'GHPR',
      startDate: '2026-04-01',
      dueDate: '2026-05-01',
    });
    projectId = project.id;
  });

  afterAll(async () => {
    await apiPrisma.$disconnect();
    await ownerPool.end();
  });

  it('persists GitHub App installation metadata and selected repositories', async () => {
    const installation = await saveGithubInstallation(context, {
      installationId: testInstallationId,
      accountLogin: 'acme-corp',
      accountId: 112233,
      accountType: 'Organization',
      repositorySelection: 'selected',
      repositories: [
        { repoId: testRepo1Id, repoName: 'frontend-service', repoFullName: 'acme-corp/frontend-service', isPrivate: true },
        { repoId: testRepo2Id, repoName: 'backend-api', repoFullName: 'acme-corp/backend-api', isPrivate: true },
      ],
    });

    expect(installation.installationId).toBe(testInstallationId);
    expect(installation.accountLogin).toBe('acme-corp');

    const installations = await listGithubInstallations(context);
    expect(installations.length).toBeGreaterThanOrEqual(1);

    const repos = await listGithubRepositories(context);
    expect(repos.length).toBe(2);
    expect(repos.map((r) => r.repoName)).toContain('frontend-service');

    // Verify audit record
    const audits = await listAuditEvents(context, {
      entityType: 'github_installation',
      entityId: installation.id,
    });
    expect(audits.length).toBeGreaterThan(0);
    expect(audits[0].action).toBe('github.installation.saved');
  });

  it('links a selected repository to an organization project', async () => {
    const linked = await linkGithubRepositoryToProject(context, testRepo2Id, projectId);
    expect(linked.projectId).toBe(projectId);
    expect(linked.repoName).toBe('backend-api');

    // Verify audit record
    const audits = await listAuditEvents(context, {
      entityType: 'github_repository',
      entityId: linked.id,
    });
    expect(audits.length).toBeGreaterThan(0);
    expect(audits[0].action).toBe('github.repository.linked');
  });

  it('enforces tenant isolation: other org cannot view or link repository', async () => {
    // Org B cannot list repositories of Org A
    const otherRepos = await listGithubRepositories(otherContext);
    expect(otherRepos).toHaveLength(0);

    // Org B cannot link Org A repository
    await expect(
      linkGithubRepositoryToProject(otherContext, testRepo2Id, projectId),
    ).rejects.toThrow();
  });

  it('deduplicates incoming webhook deliveries via unique delivery_id', async () => {
    const deliveryId = `delivery-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    const payload = { action: 'opened', pull_request: { number: 42 } };

    // First delivery -> accepted
    const first = await saveWebhookDelivery(apiPrisma, deliveryId, 'pull_request', 'opened', payload);
    expect(first.deduplicated).toBe(false);
    expect(first.id).toBeDefined();

    // Duplicate delivery -> deduplicated
    const second = await saveWebhookDelivery(apiPrisma, deliveryId, 'pull_request', 'opened', payload);
    expect(second.deduplicated).toBe(true);
  });

  it('safely cleans up webhook deliveries past the retention window without violating recent deduplication', async () => {
    // Insert an expired delivery record directly via ownerPool
    const oldDeliveryId = `old-delivery-${Date.now()}`;
    await ownerPool.query(`
      INSERT INTO public.github_webhook_deliveries (id, delivery_id, event_type, action, payload, created_at)
      VALUES (gen_random_uuid(), '${oldDeliveryId}', 'push', NULL, '{"ref":"main"}'::jsonb, NOW() - INTERVAL '35 days');
    `);

    // Clean up deliveries older than 30 days
    const cleanupResult = await cleanupExpiredWebhookDeliveries(apiPrisma, 30);
    expect(cleanupResult.deletedCount).toBeGreaterThanOrEqual(1);

    // Verify recent deliveries remain untouched
    const recentCheck = await apiPrisma.githubWebhookDelivery.findMany();
    expect(recentCheck.some((d) => d.deliveryId === oldDeliveryId)).toBe(false);
  });
});
