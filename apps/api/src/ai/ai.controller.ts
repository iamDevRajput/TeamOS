import {
  Controller,
  Post,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../identity/guards/auth.guard';
import { OrgMembershipGuard } from '../tenancy/guards/org-membership.guard';
import { CurrentOrgId, CurrentMembership } from '../tenancy/decorators/current-org.decorator';
import { AiService } from './ai.service';
import { TenantContext, ProposalDto } from '@teamos/contracts';
import { Membership } from '@teamos/database';

export interface GeneratePlanDto {
  brief: string;
}

@Controller('orgs/:orgId/projects/:projectId/ai')
@UseGuards(AuthGuard, OrgMembershipGuard)
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('generate-plan')
  async generatePlan(
    @CurrentOrgId() orgId: string,
    @CurrentMembership() membership: Membership,
    @Param('projectId') projectId: string,
    @Body() dto: GeneratePlanDto,
  ): Promise<ProposalDto> {
    const context: TenantContext = {
      orgId,
      userId: membership.userId,
      role: membership.role as any,
      requestId: `req-ai-plan-${Date.now()}`,
    };
    return this.aiService.generatePlanProposal(context, projectId, dto.brief);
  }
}

