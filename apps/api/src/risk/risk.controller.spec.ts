import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { RiskController } from './risk.controller';
import { RiskService } from './risk.service';
import { OrgRole, ProjectRiskReportDto, WhatIfScenarioResultDto } from '@teamos/contracts';
import { Membership } from '@teamos/database';

describe('RiskController & RiskService', () => {
  let controller: RiskController;
  let service: RiskService;

  const mockOrgId = '11111111-1111-1111-1111-111111111111';
  const mockMembership: Membership = {
    orgId: mockOrgId,
    userId: '22222222-2222-2222-2222-222222222222',
    role: OrgRole.MEMBER,
    createdAt: new Date(),
  };

  beforeEach(() => {
    service = new RiskService();
    controller = new RiskController(service);
  });

  it('retrieves project risk report', async () => {
    const mockReport: ProjectRiskReportDto = {
      projectId: 'proj-1',
      projectKey: 'PROJ',
      projectName: 'Test Project',
      calculatedAt: new Date().toISOString(),
      isAcyclic: true,
      criticalPathTaskIds: ['task-1', 'task-2'],
      maxDurationWorkdays: 10,
      forecastDeliveryDate: '2026-12-01',
      targetDeliveryDate: '2026-12-05',
      deliveryVarianceWorkdays: -4,
      isDelayed: false,
      tasks: [],
    };

    vi.spyOn(service, 'getProjectRisk').mockResolvedValueOnce(mockReport);

    const result = await controller.getRisk(mockOrgId, mockMembership, 'proj-1');
    expect(result).toEqual(mockReport);
    expect(result.isDelayed).toBe(false);
    expect(result.forecastDeliveryDate).toBe('2026-12-01');
  });

  it('handles non-existent project with NotFoundException', async () => {
    vi.spyOn(service, 'getProjectRisk').mockRejectedValueOnce(
      new NotFoundException('Project not found in this organization.'),
    );

    await expect(
      controller.getRisk(mockOrgId, mockMembership, 'invalid-proj'),
    ).rejects.toThrow(NotFoundException);
  });

  it('runs what-if scenario simulation without database writes', async () => {
    const mockSimulation: WhatIfScenarioResultDto = {
      baselineForecastDeliveryDate: '2026-12-01',
      scenarioForecastDeliveryDate: '2026-12-06',
      varianceWorkdays: 5,
      criticalPathTaskIds: ['task-1', 'task-2'],
      impactedTaskIds: ['task-2'],
      tasks: [],
    };

    vi.spyOn(service, 'simulateWhatIf').mockResolvedValueOnce(mockSimulation);

    const result = await controller.simulateWhatIf(mockOrgId, mockMembership, 'proj-1', {
      estimateOverrides: [{ taskId: 'task-1', remainingEstimateWorkdays: 8 }],
    });

    expect(result).toEqual(mockSimulation);
    expect(result.varianceWorkdays).toBe(5);
    expect(result.scenarioForecastDeliveryDate).toBe('2026-12-06');
  });
});

