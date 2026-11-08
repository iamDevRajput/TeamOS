import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { Pool } from 'pg';
import crypto from 'crypto';
import {
  createApiPrismaClient,
  createOrganization,
  createProject,
  createTask,
  addDependency,
  removeDependency,
  listProjectDependencies,
  listTasksWithDependencies,
  OrgRole,
  TenantContext,
} from '../src/index';

const API_DB_URL =
  process.env.DATABASE_URL ||
  'postgresql://teamos_api_role:teamos_api_password@localhost:5432/teamos?schema=public';

const OWNER_DB_URL =
  process.env.DATABASE_URL_MIGRATION ||
  'postgresql://teamos_owner:teamos_owner_password@localhost:5432/teamos?schema=public';

describe('Task Dependencies & Cycle Prevention Specification', () => {
  let apiPrisma: ReturnType<typeof createApiPrismaClient>;
  let ownerPool: Pool;

  const testUserId = '80000000-0000-0000-0000-000000000001';
  let orgId: string;
  let projectId: string;
  let task1Id: string;
  let task2Id: string;
  let task3Id: string;

  let context: TenantContext;

  beforeAll(async () => {
    apiPrisma = createApiPrismaClient(API_DB_URL);
    ownerPool = new Pool({ connectionString: OWNER_DB_URL });
    await apiPrisma.$connect();

    // Ensure user exists
    await ownerPool.query(`
      INSERT INTO public.users (id, github_user_id, login, display_name)
      VALUES ('${testUserId}', 8001, 'dep-spec-user', 'Dep Spec User')
      ON CONFLICT (id) DO NOTHING;
    `);

    // Create organization
    const slug = `dep-spec-org-${crypto.randomBytes(4).toString('hex')}`;
    const orgResult = await createOrganization(
      apiPrisma,
      testUserId,
      'Dep Spec Org',
      slug,
    );
    orgId = orgResult.organization.id;

    context = {
      orgId,
      userId: testUserId,
      role: OrgRole.OWNER,
      requestId: 'req-dep-spec',
    };

    // Create Project
    const project = await createProject(context, {
      name: 'Delivery Project',
      key: 'DEL',
    });
    projectId = project.id;

    // Create 3 tasks
    const t1 = await createTask(context, projectId, {
      title: 'Database Schema',
      remainingEstimateWorkdays: 3,
    });
    task1Id = t1.id;

    const t2 = await createTask(context, projectId, {
      title: 'API Endpoints',
      remainingEstimateWorkdays: 5,
    });
    task2Id = t2.id;

    const t3 = await createTask(context, projectId, {
      title: 'UI Dashboard',
      remainingEstimateWorkdays: 4,
    });
    task3Id = t3.id;
  });

  afterAll(async () => {
    if (orgId) {
      await ownerPool.query(`DELETE FROM public.organizations WHERE id = $1`, [orgId]);
    }
    await ownerPool.query(`DELETE FROM public.users WHERE id = $1`, [testUserId]);
    await ownerPool.end();
    await apiPrisma.$disconnect();
  });

  it('rejects self-dependency (task cannot depend on itself)', async () => {
    await expect(
      addDependency(context, {
        projectId,
        blockerTaskId: task1Id,
        blockedTaskId: task1Id,
      }),
    ).rejects.toThrow('ERR_SELF_DEPENDENCY');
  });

  it('successfully adds valid finish-to-start dependency (T1 -> T2)', async () => {
    const dep = await addDependency(context, {
      projectId,
      blockerTaskId: task1Id,
      blockedTaskId: task2Id,
    });

    expect(dep.orgId).toBe(orgId);
    expect(dep.projectId).toBe(projectId);
    expect(dep.blockerTaskId).toBe(task1Id);
    expect(dep.blockedTaskId).toBe(task2Id);

    const deps = await listProjectDependencies(context, projectId);
    expect(deps.some((d) => d.blockerTaskId === task1Id && d.blockedTaskId === task2Id)).toBe(true);
  });

  it('rejects duplicate dependency edge', async () => {
    await expect(
      addDependency(context, {
        projectId,
        blockerTaskId: task1Id,
        blockedTaskId: task2Id,
      }),
    ).rejects.toThrow('ERR_DEPENDENCY_EXISTS');
  });

  it('detects and rejects direct 2-node cycle (T2 -> T1 when T1 -> T2)', async () => {
    await expect(
      addDependency(context, {
        projectId,
        blockerTaskId: task2Id,
        blockedTaskId: task1Id,
      }),
    ).rejects.toThrow('ERR_DEPENDENCY_CYCLE');
  });

  it('detects and rejects indirect 3-node cycle (T1 -> T2 -> T3, then T3 -> T1)', async () => {
    // Add T2 -> T3
    await addDependency(context, {
      projectId,
      blockerTaskId: task2Id,
      blockedTaskId: task3Id,
    });

    // Try adding T3 -> T1
    await expect(
      addDependency(context, {
        projectId,
        blockerTaskId: task3Id,
        blockedTaskId: task1Id,
      }),
    ).rejects.toThrow('ERR_DEPENDENCY_CYCLE');
  });

  it('reports correct blocked status in listTasksWithDependencies', async () => {
    const tasksWithDeps = await listTasksWithDependencies(context, projectId);

    const t1 = tasksWithDeps.find((t) => t.id === task1Id)!;
    const t2 = tasksWithDeps.find((t) => t.id === task2Id)!;
    const t3 = tasksWithDeps.find((t) => t.id === task3Id)!;

    // T1 has no blockers -> not blocked
    expect(t1.isBlocked).toBe(false);
    expect(t1.blockerTaskIds.length).toBe(0);
    expect(t1.blockedTaskIds).toContain(task2Id);

    // T2 is blocked by T1 (T1 is TODO) -> isBlocked = true
    expect(t2.isBlocked).toBe(true);
    expect(t2.blockerTaskIds).toContain(task1Id);
    expect(t2.blockedTaskIds).toContain(task3Id);

    // T3 is blocked by T2 (T2 is TODO) -> isBlocked = true
    expect(t3.isBlocked).toBe(true);
    expect(t3.blockerTaskIds).toContain(task2Id);
  });

  it('removes dependency successfully and updates blocked status', async () => {
    await removeDependency(context, {
      projectId,
      blockerTaskId: task2Id,
      blockedTaskId: task3Id,
    });

    const tasksWithDeps = await listTasksWithDependencies(context, projectId);
    const t3 = tasksWithDeps.find((t) => t.id === task3Id)!;

    // T3 is no longer blocked
    expect(t3.isBlocked).toBe(false);
    expect(t3.blockerTaskIds.length).toBe(0);
  });

  it('supports filtering by status in listTasksWithDependencies', async () => {
    const todoTasks = await listTasksWithDependencies(context, projectId, {
      status: 'TODO' as any,
    });
    expect(todoTasks.length).toBe(3);

    const doneTasks = await listTasksWithDependencies(context, projectId, {
      status: 'DONE' as any,
    });
    expect(doneTasks.length).toBe(0);
  });
});
