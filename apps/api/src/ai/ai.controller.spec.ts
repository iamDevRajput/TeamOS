import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  BadRequestException,
  ServiceUnavailableException,
  GatewayTimeoutException,
} from '@nestjs/common';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { OrgRole, ProposalDto } from '@teamos/contracts';
import { Membership } from '@teamos/database';

describe('AiController', () => {
  let controller: AiController;
  let service: AiService;

  const mockOrgId = '11111111-1111-1111-1111-111111111111';
  const mockMembership: Membership = {
    orgId: mockOrgId,
    userId: '22222222-2222-2222-2222-222222222222',
    role: OrgRole.MEMBER,
    createdAt: new Date(),
  };

  beforeEach(() => {
    service = new AiService({} as any);
    controller = new AiController(service);
  });

  it('rejects plan generation with empty brief', async () => {
    vi.spyOn(service, 'generatePlanProposal').mockRejectedValueOnce(
      new BadRequestException('A descriptive project brief is required.'),
    );

    await expect(
      controller.generatePlan(mockOrgId, mockMembership, 'proj-1', { brief: '' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('honors administrative kill switch', async () => {
    vi.spyOn(service, 'generatePlanProposal').mockRejectedValueOnce(
      new ServiceUnavailableException('AI services are currently paused by administrative kill switch.'),
    );

    await expect(
      controller.generatePlan(mockOrgId, mockMembership, 'proj-1', { brief: 'Build feature' }),
    ).rejects.toThrow(ServiceUnavailableException);
  });

  it('fails closed when organization AI budget is exhausted', async () => {
    vi.spyOn(service, 'generatePlanProposal').mockRejectedValueOnce(
      new BadRequestException('Organization AI budget exceeded. Please adjust monthly limit.'),
    );

    await expect(
      controller.generatePlan(mockOrgId, mockMembership, 'proj-1', { brief: 'Complex workflow' }),
    ).rejects.toThrow(/budget exceeded/);
  });

  it('handles provider timeouts by throwing GatewayTimeoutException', async () => {
    vi.spyOn(service, 'generatePlanProposal').mockRejectedValueOnce(
      new GatewayTimeoutException('AI provider request timed out. Budget held pending reconciliation.'),
    );

    await expect(
      controller.generatePlan(mockOrgId, mockMembership, 'proj-1', { brief: 'Large backend brief' }),
    ).rejects.toThrow(GatewayTimeoutException);
  });

  it('generates plan proposal and returns staged proposal', async () => {
    const mockProposal: ProposalDto = {
      id: 'prop-ai-1',
      orgId: mockOrgId,
      projectId: 'proj-1',
      kind: 'PLAN',
      state: 'PENDING',
      title: 'Plan: Realtime Notifications',
      description: 'Structured breakdown',
      payload: {},
      createdBy: mockMembership.userId,
      createdAt: new Date().toISOString(),
    };

    vi.spyOn(service, 'generatePlanProposal').mockResolvedValueOnce(mockProposal);

    const result = await controller.generatePlan(mockOrgId, mockMembership, 'proj-1', {
      brief: 'Realtime notifications using WebSocket and Redis',
    });

    expect(result).toEqual(mockProposal);
    expect(result.state).toBe('PENDING');
  });
});
