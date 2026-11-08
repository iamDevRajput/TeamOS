import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { OrgRole, ProjectReportDto } from '@teamos/contracts';
import { Membership, SessionUser } from '@teamos/database';

describe('ReportsController', () => {
  let controller: ReportsController;
  let service: ReportsService;

  const mockOrgId = '11111111-1111-1111-1111-111111111111';
  const mockUserId = '22222222-2222-2222-2222-222222222222';
  const mockUser: SessionUser = {
    sessionId: 'sess-1',
    userId: mockUserId,
    login: 'reportuser',
    displayName: 'Report User',
    avatarUrl: null,
    expiresAt: new Date(),
    lastActiveAt: new Date(),
  };

  const mockMembership: Membership = {
    orgId: mockOrgId,
    userId: mockUserId,
    role: OrgRole.OWNER,
    createdAt: new Date(),
  };

  const mockReport: ProjectReportDto = {
    id: 'rep-1',
    orgId: mockOrgId,
    projectId: 'proj-1',
    title: 'Health Report: PROJ — Mar 2, 2026',
    summary: 'Project is tracking safely on schedule.',
    deliveryRisk: 'LOW',
    snapshotHash: 'hash-abc-123',
    snapshot: {
      projectId: 'proj-1',
      projectKey: 'PROJ',
      projectName: 'Test Project',
      targetDueDate: '2026-03-20',
      forecastDate: '2026-03-15',
      deliveryRisk: 'LOW',
      totalTasks: 3,
      completedTasks: 1,
      inProgressTasks: 1,
      todoTasks: 1,
      blockedTasks: 0,
      criticalPathTaskIds: ['t-1'],
      blockedTaskIds: [],
      validEntityIds: ['proj-1', 't-1'],
      facts: [],
      computedAt: '2026-03-02',
      snapshotHash: 'hash-abc-123',
    },
    claims: [],
    createdBy: mockUserId,
    creatorLogin: 'reportuser',
    createdAt: new Date().toISOString(),
  };

  beforeEach(() => {
    service = new ReportsService();
    controller = new ReportsController(service);
  });

  it('generates an evidence-backed health report', async () => {
    vi.spyOn(service, 'generateReport').mockResolvedValue(mockReport);

    const result = await controller.generateReport(
      mockOrgId,
      mockUser,
      mockMembership,
      'proj-1',
      { title: 'Custom Sprint Report' },
    );

    expect(result).toEqual(mockReport);
    expect(service.generateReport).toHaveBeenCalledWith(
      expect.objectContaining({ orgId: mockOrgId, userId: mockUserId }),
      'proj-1',
      { title: 'Custom Sprint Report' },
    );
  });

  it('lists health reports for a project', async () => {
    vi.spyOn(service, 'listReports').mockResolvedValue([mockReport]);

    const result = await controller.listReports(
      mockOrgId,
      mockUser,
      mockMembership,
      'proj-1',
    );

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('rep-1');
  });

  it('retrieves an individual report by ID', async () => {
    vi.spyOn(service, 'getReport').mockResolvedValue(mockReport);

    const result = await controller.getReport(
      mockOrgId,
      mockUser,
      mockMembership,
      'rep-1',
    );

    expect(result.id).toBe('rep-1');
    expect(result.deliveryRisk).toBe('LOW');
  });

  it('throws NotFoundException when report is not found', async () => {
    vi.spyOn(service, 'getReport').mockRejectedValue(new NotFoundException('Report not found'));

    await expect(
      controller.getReport(mockOrgId, mockUser, mockMembership, 'rep-999'),
    ).rejects.toThrow(NotFoundException);
  });
});

