import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { Pool } from 'pg';
import crypto from 'crypto';
import {
  createApiPrismaClient,
  createOrganization,
  createProject,
  createTask,
  createProjectReport,
  listProjectReports,
  getReportById,
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

describe('Project Reports & Snapshot Grounding Specification (Phase I)', () => {
  let apiPrisma: ReturnType<typeof createApiPrismaClient>;
  let ownerPool: Pool;

  const testUserId = '95000000-0000-0000-0000-000000000001';
  const otherUserId = '95000000-0000-0000-0000-000000000002';

  let orgId: string;
  let otherOrgId: string;
  let projectId: string;
  let context: TenantContext;
  let otherContext: TenantContext;

  beforeAll(async () => {
    apiPrisma = createApiPrismaClient(API_DB_URL);
    ownerPool = new Pool({ connectionString: OWNER_DB_URL });
    await apiPrisma.$connect();

    // Ensure test users exist
    await ownerPool.query(`
      INSERT INTO public.users (id, github_user_id, login, display_name)
      VALUES 
        ('${testUserId}', 9501, 'report-test-user', 'Report Tester'),
        ('${otherUserId}', 9502, 'report-other-user', 'Other Org User')
      ON CONFLICT (id) DO NOTHING;
    `);

    // Create organization
    const slug = `report-org-${crypto.randomBytes(4).toString('hex')}`;
    const orgResult = await createOrganization(
      apiPrisma,
      testUserId,
      'Report Org',
      slug,
    );
    orgId = orgResult.organization.id;

    // Create other org for tenant isolation test
    const otherSlug = `report-other-org-${crypto.randomBytes(4).toString('hex')}`;
    const otherOrgResult = await createOrganization(
      apiPrisma,
      otherUserId,
      'Other Report Org',
      otherSlug,
    );
    otherOrgId = otherOrgResult.organization.id;

    context = {
      orgId,
      userId: testUserId,
      role: OrgRole.OWNER,
      requestId: 'req-report-spec-1',
    };

    otherContext = {
      orgId: otherOrgId,
      userId: otherUserId,
      role: OrgRole.OWNER,
      requestId: 'req-report-spec-2',
    };

    // Create project
    const project = await createProject(context, {
      name: 'Report Test Project',
      key: 'REP',
      startDate: '2026-04-01',
      dueDate: '2026-05-01',
    });
    projectId = project.id;

    // Create task
    await createTask(context, projectId, {
      title: 'Initial Milestone Task',
      remainingEstimateWorkdays: 5,
    });
  });

  afterAll(async () => {
    await apiPrisma.$disconnect();
    await ownerPool.end();
  });

  it('creates an evidence-grounded project report and records audit event', async () => {
    const report = await createProjectReport(context, {
      projectId,
      title: 'Weekly Delivery Health Snapshot',
      summary: 'Project REP is tracking on schedule with 1 critical task.',
      deliveryRisk: 'LOW',
      snapshotHash: 'hash-abc-123456',
      snapshot: {
        projectId,
        projectKey: 'REP',
        projectName: 'Report Test Project',
        targetDueDate: '2026-05-01',
        forecastDate: '2026-04-08',
        deliveryRisk: 'LOW',
        totalTasks: 1,
        completedTasks: 0,
        inProgressTasks: 0,
        todoTasks: 1,
        blockedTasks: 0,
        criticalPathTaskIds: [],
        blockedTaskIds: [],
        validEntityIds: [projectId],
        facts: [
          {
            id: 'fact-1',
            type: 'FORECAST_DATE',
            claim: 'Forecast date is 2026-04-08',
            value: '2026-04-08',
            evidenceIds: [projectId],
          },
        ],
        computedAt: '2026-04-01',
        snapshotHash: 'hash-abc-123456',
      },
      claims: [
        {
          id: 'fact-1',
          type: 'FORECAST_DATE',
          claim: 'Forecast date is 2026-04-08',
          value: '2026-04-08',
          evidenceIds: [projectId],
        },
      ],
    });

    expect(report.id).toBeDefined();
    expect(report.orgId).toBe(orgId);
    expect(report.projectId).toBe(projectId);
    expect(report.title).toBe('Weekly Delivery Health Snapshot');
    expect(report.deliveryRisk).toBe('LOW');
    expect(report.creatorLogin).toBe('report-test-user');

    // Verify audit event
    const auditLogs = await listAuditEvents(context, {
      entityType: 'project_report',
      entityId: report.id,
    });
    expect(auditLogs.length).toBeGreaterThan(0);
    expect(auditLogs[0].action).toBe('report.created');
  });

  it('lists reports for the project ordered by recency', async () => {
    const list = await listProjectReports(context, projectId);
    expect(list.length).toBeGreaterThanOrEqual(1);
    expect(list[0].title).toBe('Weekly Delivery Health Snapshot');
  });

  it('retrieves an individual report by ID', async () => {
    const list = await listProjectReports(context, projectId);
    const reportId = list[0].id;

    const report = await getReportById(context, reportId);
    expect(report).not.toBeNull();
    expect(report?.id).toBe(reportId);
    expect(report?.snapshotHash).toBe('hash-abc-123456');
  });

  it('enforces tenant isolation: another org cannot view or access the report', async () => {
    const list = await listProjectReports(context, projectId);
    const reportId = list[0].id;

    // Cross-tenant list
    const otherList = await listProjectReports(otherContext, projectId);
    expect(otherList).toHaveLength(0);

    // Cross-tenant get
    const crossReport = await getReportById(otherContext, reportId);
    expect(crossReport).toBeNull();
  });
});
