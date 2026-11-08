import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  BadRequestException,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { ProposalsController } from './proposals.controller';
import { ProposalsService } from './proposals.service';
import { OrgRole, ProposalDto, ApproveProposalResponseDto } from '@teamos/contracts';
import { Membership } from '@teamos/database';

describe('ProposalsController & ProposalsService', () => {
  let controller: ProposalsController;
  let service: ProposalsService;

  const mockOrgId = '11111111-1111-1111-1111-111111111111';
  const mockOwnerMembership: Membership = {
    orgId: mockOrgId,
    userId: '22222222-2222-2222-2222-222222222222',
    role: OrgRole.OWNER,
    createdAt: new Date(),
  };

  beforeEach(() => {
    service = new ProposalsService();
    controller = new ProposalsController(service);
  });

  it('rejects proposal creation without title', async () => {
    await expect(
      controller.create(mockOrgId, mockOwnerMembership, 'proj-1', {
        title: '',
        payload: {},
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('creates a proposal successfully', async () => {
    const mockCreated: ProposalDto = {
      id: 'prop-1',
      orgId: mockOrgId,
      projectId: 'proj-1',
      kind: 'PLAN',
      state: 'PENDING',
      title: 'Sprint 2 Plan',
      payload: {},
      createdBy: mockOwnerMembership.userId,
      createdAt: new Date().toISOString(),
    };

    vi.spyOn(service, 'create').mockResolvedValueOnce(mockCreated);

    const result = await controller.create(mockOrgId, mockOwnerMembership, 'proj-1', {
      title: 'Sprint 2 Plan',
      payload: {},
    });

    expect(result).toEqual(mockCreated);
  });

  it('maps concurrency conflict on approval to ConflictException (409)', async () => {
    vi.spyOn(service, 'approve').mockRejectedValueOnce(
      new ConflictException(
        'Concurrency Conflict: One or more tasks were modified after this proposal was created.',
      ),
    );

    await expect(
      controller.approve(mockOrgId, mockOwnerMembership, 'prop-1'),
    ).rejects.toThrow(ConflictException);
  });

  it('maps cycle detection on approval to BadRequestException (400)', async () => {
    vi.spyOn(service, 'approve').mockRejectedValueOnce(
      new BadRequestException(
        'Cannot approve proposal: the proposed dependencies introduce a cycle into the project graph.',
      ),
    );

    await expect(
      controller.approve(mockOrgId, mockOwnerMembership, 'prop-1'),
    ).rejects.toThrow(BadRequestException);
  });

  it('maps non-admin approval attempts to ForbiddenException (403)', async () => {
    vi.spyOn(service, 'approve').mockRejectedValueOnce(
      new ForbiddenException('Only Organization Owners or Admins can approve proposals.'),
    );

    await expect(
      controller.approve(mockOrgId, mockOwnerMembership, 'prop-1'),
    ).rejects.toThrow(ForbiddenException);
  });

  it('approves a proposal successfully', async () => {
    const mockApproveResult: ApproveProposalResponseDto = {
      success: true,
      proposalId: 'prop-1',
      state: 'APPROVED',
      createdTaskCount: 2,
      updatedTaskCount: 1,
      deletedTaskCount: 0,
      addedDependencyCount: 1,
      removedDependencyCount: 0,
    };

    vi.spyOn(service, 'approve').mockResolvedValueOnce(mockApproveResult);

    const result = await controller.approve(mockOrgId, mockOwnerMembership, 'prop-1');
    expect(result.success).toBe(true);
    expect(result.createdTaskCount).toBe(2);
  });

  it('rejects a proposal with a reason', async () => {
    const mockRejected: ProposalDto = {
      id: 'prop-1',
      orgId: mockOrgId,
      projectId: 'proj-1',
      kind: 'PLAN',
      state: 'REJECTED',
      title: 'Sprint 2 Plan',
      rejectionReason: 'Not needed',
      payload: {},
      createdBy: mockOwnerMembership.userId,
      createdAt: new Date().toISOString(),
    };

    vi.spyOn(service, 'reject').mockResolvedValueOnce(mockRejected);

    const result = await controller.reject(mockOrgId, mockOwnerMembership, 'prop-1', {
      reason: 'Not needed',
    });

    expect(result.state).toBe('REJECTED');
    expect(result.rejectionReason).toBe('Not needed');
  });
});

