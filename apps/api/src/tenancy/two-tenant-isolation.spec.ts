import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { ProjectsController } from '../projects/projects.controller';
import { ProjectsService } from '../projects/projects.service';
import { ReportsController } from '../reports/reports.controller';
import { ReportsService } from '../reports/reports.service';
import { ProposalsController } from '../proposals/proposals.controller';
import { ProposalsService } from '../proposals/proposals.service';
import { OrgRole } from '@teamos/contracts';
import { SessionUser, Membership } from '@teamos/database';

describe('Two-Tenant Separation & Isolation Specification (Gap 5 E2E)', () => {
  // Tenant A: Org Alpha, User A
  const orgAId = 'a1111111-1111-1111-1111-111111111111';
  const userAId = 'a2222222-2222-2222-2222-222222222222';
  const userA: SessionUser = {
    sessionId: 'sess-a',
    userId: userAId,
    login: 'user-alpha',
    displayName: 'User Alpha',
    avatarUrl: null,
    expiresAt: new Date(),
    lastActiveAt: new Date(),
  };
  const membershipA: Membership = {
    orgId: orgAId,
    userId: userAId,
    role: OrgRole.OWNER,
    createdAt: new Date(),
  };

  // Tenant B: Org Beta, User B
  const orgBId = 'b1111111-1111-1111-1111-111111111111';
  const userBId = 'b2222222-2222-2222-2222-222222222222';
  const userB: SessionUser = {
    sessionId: 'sess-b',
    userId: userBId,
    login: 'user-beta',
    displayName: 'User Beta',
    avatarUrl: null,
    expiresAt: new Date(),
    lastActiveAt: new Date(),
  };
  const membershipB: Membership = {
    orgId: orgBId,
    userId: userBId,
    role: OrgRole.OWNER,
    createdAt: new Date(),
  };

  let projectsService: ProjectsService;
  let projectsController: ProjectsController;
  let reportsService: ReportsService;
  let reportsController: ReportsController;
  let proposalsService: ProposalsService;
  let proposalsController: ProposalsController;

  beforeEach(() => {
    projectsService = new ProjectsService();
    projectsController = new ProjectsController(projectsService);

    reportsService = new ReportsService();
    reportsController = new ReportsController(reportsService);

    proposalsService = new ProposalsService();
    proposalsController = new ProposalsController(proposalsService);
  });

  it('prohibits User A from accessing Project B belonging to Org B', async () => {
    const projectBId = 'b-proj-999';

    vi.spyOn(projectsService, 'getProject').mockImplementation(
      async (orgId, userId, role, pId) => {
        if (orgId === orgBId && pId === projectBId) {
          return {
            id: projectBId,
            orgId: orgBId,
            key: 'BETA',
            name: 'Beta Project',
            startDate: null,
            dueDate: null,
            timezone: 'UTC',
            nextTaskNumber: 1,
            createdAt: new Date().toISOString(),
          };
        }
        throw new NotFoundException('Project not found in this organization.');
      },
    );

    // User A in Org A requests Project B -> Must throw NotFoundException (fail closed)
    await expect(
      projectsController.getProject(orgAId, userA, membershipA, projectBId),
    ).rejects.toThrow(NotFoundException);
  });

  it('prohibits User A from reading health reports belonging to Org B', async () => {
    const reportBId = 'rep-beta-123';

    vi.spyOn(reportsService, 'getReport').mockImplementation(async (context, rId) => {
      if (context.orgId === orgBId && rId === reportBId) {
        return {} as any;
      }
      throw new NotFoundException('Report not found.');
    });

    // User A requests Report B under Org A context
    await expect(
      reportsController.getReport(orgAId, userA, membershipA, reportBId),
    ).rejects.toThrow(NotFoundException);
  });

  it('prohibits User B from approving proposals belonging to Org A', async () => {
    const proposalAId = 'prop-alpha-555';

    vi.spyOn(proposalsService, 'approve').mockImplementation(
      async (context, pId) => {
        if (context.orgId !== orgAId) {
          throw new NotFoundException('Proposal not found in this organization.');
        }
        return {} as any;
      },
    );

    // User B attempts to approve proposal in Org B context
    await expect(
      proposalsController.approve(orgBId, membershipB, proposalAId),
    ).rejects.toThrow(NotFoundException);
  });

  it('isolates task lists: User A only sees Org A tasks and User B only sees Org B tasks', async () => {
    vi.spyOn(projectsService, 'listTasks').mockImplementation(
      async (orgId, userId, role, projectId) => {
        if (orgId === orgAId) {
          return [{ id: 'task-a1', orgId: orgAId, title: 'Alpha Task' } as any];
        }
        if (orgId === orgBId) {
          return [{ id: 'task-b1', orgId: orgBId, title: 'Beta Task' } as any];
        }
        return [];
      },
    );

    const tasksA = await projectsController.listTasks(orgAId, userA, membershipA, 'proj-1');
    const tasksB = await projectsController.listTasks(orgBId, userB, membershipB, 'proj-1');

    expect(tasksA).toHaveLength(1);
    expect(tasksA[0].title).toBe('Alpha Task');

    expect(tasksB).toHaveLength(1);
    expect(tasksB[0].title).toBe('Beta Task');

    // No cross-contamination
    expect(tasksA.some((t) => t.orgId === orgBId)).toBe(false);
    expect(tasksB.some((t) => t.orgId === orgAId)).toBe(false);
  });
});
