import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { Pool } from 'pg';
import crypto from 'crypto';
import {
  createApiPrismaClient,
  createOrganization,
  createProject,
  createTask,
  updateTask,
  createProposal,
  listProjectProposals,
  getProposalById,
  rejectProposal,
  approveProposal,
  OrgRole,
  TenantContext,
} from '../src/index';

const API_DB_URL =
  process.env.DATABASE_URL ||
  'postgresql://teamos_api_role:teamos_api_password@localhost:5432/teamos?schema=public';

const OWNER_DB_URL =
  process.env.DATABASE_URL_MIGRATION ||
  'postgresql://teamos_owner:teamos_owner_password@localhost:5432/teamos?schema=public';

describe('Proposals Review & Atomic Application Specification (Phase F)', () => {
  let apiPrisma: ReturnType<typeof createApiPrismaClient>;
  let ownerPool: Pool;

  const ownerUserId = '90000000-0000-0000-0000-000000000001';
  const memberUserId = '90000000-0000-0000-0000-000000000002';

  let orgId: string;
  let projectId: string;
  let task1Id: string;
  let task2Id: string;

  let ownerContext: TenantContext;
  let memberContext: TenantContext;

  beforeAll(async () => {
    apiPrisma = createApiPrismaClient(API_DB_URL);
    ownerPool = new Pool({ connectionString: OWNER_DB_URL });
    await apiPrisma.$connect();

    // Ensure test users exist
    await ownerPool.query(`
      INSERT INTO public.users (id, github_user_id, login, display_name)
      VALUES 
        ('${ownerUserId}', 9001, 'prop-owner-user', 'Proposal Owner'),
        ('${memberUserId}', 9002, 'prop-member-user', 'Proposal Member')
      ON CONFLICT (id) DO NOTHING;
    `);

    // Create organization
    const slug = `prop-spec-org-${crypto.randomBytes(4).toString('hex')}`;
    const orgResult = await createOrganization(
      apiPrisma,
      ownerUserId,
      'Proposal Spec Org',
      slug,
    );
    orgId = orgResult.organization.id;

    // Add member user to organization
    await ownerPool.query(`
      INSERT INTO public.memberships (org_id, user_id, role)
      VALUES ('${orgId}', '${memberUserId}', 'MEMBER');
    `);

    ownerContext = {
      orgId,
      userId: ownerUserId,
      role: OrgRole.OWNER,
      requestId: 'req-prop-owner',
    };

    memberContext = {
      orgId,
      userId: memberUserId,
      role: OrgRole.MEMBER,
      requestId: 'req-prop-member',
    };

    // Create Project
    const project = await createProject(ownerContext, {
      name: 'Launch Proposal Project',
      key: 'PROP',
    });
    projectId = project.id;

    // Create baseline tasks
    const t1 = await createTask(ownerContext, projectId, {
      title: 'Initial Architecture',
      remainingEstimateWorkdays: 3,
    });
    task1Id = t1.id;

    const t2 = await createTask(ownerContext, projectId, {
      title: 'Core Implementation',
      remainingEstimateWorkdays: 5,
    });
    task2Id = t2.id;
  });

  afterAll(async () => {
    if (orgId) {
      await ownerPool.query(`DELETE FROM public.organizations WHERE id = $1`, [orgId]);
    }
    await ownerPool.query(`DELETE FROM public.users WHERE id IN ($1, $2)`, [
      ownerUserId,
      memberUserId,
    ]);
    await ownerPool.end();
    await apiPrisma.$disconnect();
  });

  it('allows members to create a plan proposal with proposed tasks and edges', async () => {
    const proposal = await createProposal(memberContext, projectId, {
      title: 'Q1 Refactor Plan',
      description: 'Add testing suite and link to core',
      kind: 'PLAN',
      payload: {
        tasksToCreate: [
          {
            tempId: 'new-task-1',
            title: 'End-to-End Test Suite',
            remainingEstimateWorkdays: 4,
          },
        ],
        dependenciesToAdd: [
          {
            blockerId: task2Id,
            dependentId: 'new-task-1',
          },
        ],
      },
    });

    expect(proposal.id).toBeDefined();
    expect(proposal.state).toBe('PENDING');
    expect(proposal.creatorLogin).toBe('prop-member-user');
    expect(proposal.payload.tasksToCreate?.length).toBe(1);
  });

  it('denies proposal approval to regular MEMBER role (requires OWNER or ADMIN)', async () => {
    const proposal = await createProposal(memberContext, projectId, {
      title: 'Unauthorized Plan',
      payload: {},
    });

    await expect(approveProposal(memberContext, proposal.id)).rejects.toThrow(
      'ERR_UNAUTHORIZED_PROPOSAL_REVIEW',
    );
  });

  it('re-validates optimistic concurrency: rejects approval if target task version changed', async () => {
    // Current task1 version is 1
    const proposal = await createProposal(memberContext, projectId, {
      title: 'Conflicting Task Update Plan',
      payload: {
        tasksToUpdate: [
          {
            taskId: task1Id,
            expectedVersion: 1, // Will become stale
            title: 'Updated from proposal',
          },
        ],
      },
    });

    // Simulate concurrent edit in the project
    await updateTask(ownerContext, projectId, task1Id, {
      title: 'Concurrent Direct Edit',
      expectedVersion: 1,
    });

    // Approving the proposal must fail closed with ERR_CONCURRENT_UPDATE
    await expect(approveProposal(ownerContext, proposal.id)).rejects.toThrow(
      'ERR_CONCURRENT_UPDATE',
    );
  });

  it('re-validates DAG: rejects approval if proposed edges would create a cycle', async () => {
    // task1 -> task2
    const proposal = await createProposal(memberContext, projectId, {
      title: 'Cycle Introducing Plan',
      payload: {
        dependenciesToAdd: [
          { blockerId: task1Id, dependentId: task2Id },
          { blockerId: task2Id, dependentId: task1Id }, // Immediate 2-cycle
        ],
      },
    });

    await expect(approveProposal(ownerContext, proposal.id)).rejects.toThrow(
      'ERR_DEPENDENCY_CYCLE',
    );
  });

  it('atomically applies approved proposal: creates tasks, updates project sequence, adds edges', async () => {
    const proposal = await createProposal(memberContext, projectId, {
      title: 'Approved Launch Plan',
      payload: {
        tasksToCreate: [
          {
            tempId: 'temp-auth-audit',
            title: 'Security Audit Verification',
            remainingEstimateWorkdays: 2,
          },
        ],
        dependenciesToAdd: [
          {
            blockerId: task2Id,
            dependentId: 'temp-auth-audit',
          },
        ],
      },
    });

    const result = await approveProposal(ownerContext, proposal.id);
    expect(result.success).toBe(true);
    expect(result.state).toBe('APPROVED');
    expect(result.createdTaskCount).toBe(1);
    expect(result.addedDependencyCount).toBe(1);

    // Verify proposal state in DB
    const fetched = await getProposalById(ownerContext, proposal.id);
    expect(fetched?.state).toBe('APPROVED');
    expect(fetched?.reviewedBy).toBe(ownerUserId);

    // Verify task was actually created in DB
    const projectProposals = await listProjectProposals(ownerContext, projectId, 'APPROVED');
    expect(projectProposals.some((p) => p.id === proposal.id)).toBe(true);
  });

  it('allows rejection of proposal with explanation', async () => {
    const proposal = await createProposal(memberContext, projectId, {
      title: 'Plan to be rejected',
      payload: {},
    });

    const rejected = await rejectProposal(
      ownerContext,
      proposal.id,
      'Deferred to next quarter',
    );
    expect(rejected.state).toBe('REJECTED');
    expect(rejected.rejectionReason).toBe('Deferred to next quarter');
  });
});

