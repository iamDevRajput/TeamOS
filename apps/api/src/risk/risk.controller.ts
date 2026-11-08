import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../identity/guards/auth.guard';
import { OrgMembershipGuard } from '../tenancy/guards/org-membership.guard';
import { CurrentOrgId, CurrentMembership } from '../tenancy/decorators/current-org.decorator';
import { RiskService } from './risk.service';
import {
  TenantContext,
  ProjectRiskReportDto,
  WhatIfScenarioInputDto,
  WhatIfScenarioResultDto,
} from '@teamos/contracts';
import { Membership } from '@teamos/database';

@Controller('orgs/:orgId/projects/:projectId/risk')
@UseGuards(AuthGuard, OrgMembershipGuard)
export class RiskController {
  constructor(private readonly riskService: RiskService) {}

  @Get()
  async getRisk(
    @CurrentOrgId() orgId: string,
    @CurrentMembership() membership: Membership,
    @Param('projectId') projectId: string,
  ): Promise<ProjectRiskReportDto> {
    const context: TenantContext = {
      orgId,
      userId: membership.userId,
      role: membership.role as any,
      requestId: `req-risk-${Date.now()}`,
    };
    return this.riskService.getProjectRisk(context, projectId);
  }

  @Post('what-if')
  async simulateWhatIf(
    @CurrentOrgId() orgId: string,
    @CurrentMembership() membership: Membership,
    @Param('projectId') projectId: string,
    @Body() scenario: WhatIfScenarioInputDto,
  ): Promise<WhatIfScenarioResultDto> {
    const context: TenantContext = {
      orgId,
      userId: membership.userId,
      role: membership.role as any,
      requestId: `req-what-if-${Date.now()}`,
    };
    return this.riskService.simulateWhatIf(context, projectId, scenario);
  }
}

