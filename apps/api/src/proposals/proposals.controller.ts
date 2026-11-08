import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../identity/guards/auth.guard';
import { OrgMembershipGuard } from '../tenancy/guards/org-membership.guard';
import { RequireRole } from '../tenancy/decorators/require-role.decorator';
import { CurrentOrgId, CurrentMembership } from '../tenancy/decorators/current-org.decorator';
import { ProposalsService } from './proposals.service';
import {
  TenantContext,
  ProposalDto,
  CreateProposalDto,
  ProposalState,
  ApproveProposalResponseDto,
  RejectProposalDto,
} from '@teamos/contracts';
import { Membership } from '@teamos/database';

@Controller('orgs/:orgId')
@UseGuards(AuthGuard, OrgMembershipGuard)
export class ProposalsController {
  constructor(private readonly proposalsService: ProposalsService) {}

  @Post('projects/:projectId/proposals')
  async create(
    @CurrentOrgId() orgId: string,
    @CurrentMembership() membership: Membership,
    @Param('projectId') projectId: string,
    @Body() dto: CreateProposalDto,
  ): Promise<ProposalDto> {
    const context: TenantContext = {
      orgId,
      userId: membership.userId,
      role: membership.role as any,
      requestId: `req-prop-create-${Date.now()}`,
    };
    return this.proposalsService.create(context, projectId, dto);
  }

  @Get('projects/:projectId/proposals')
  async list(
    @CurrentOrgId() orgId: string,
    @CurrentMembership() membership: Membership,
    @Param('projectId') projectId: string,
    @Query('state') state?: ProposalState,
  ): Promise<ProposalDto[]> {
    const context: TenantContext = {
      orgId,
      userId: membership.userId,
      role: membership.role as any,
      requestId: `req-prop-list-${Date.now()}`,
    };
    return this.proposalsService.list(context, projectId, state);
  }

  @Get('proposals/:proposalId')
  async getById(
    @CurrentOrgId() orgId: string,
    @CurrentMembership() membership: Membership,
    @Param('proposalId') proposalId: string,
  ): Promise<ProposalDto> {
    const context: TenantContext = {
      orgId,
      userId: membership.userId,
      role: membership.role as any,
      requestId: `req-prop-get-${Date.now()}`,
    };
    return this.proposalsService.getById(context, proposalId);
  }

  @Post('proposals/:proposalId/approve')
  @RequireRole('ADMIN')
  async approve(
    @CurrentOrgId() orgId: string,
    @CurrentMembership() membership: Membership,
    @Param('proposalId') proposalId: string,
  ): Promise<ApproveProposalResponseDto> {
    const context: TenantContext = {
      orgId,
      userId: membership.userId,
      role: membership.role as any,
      requestId: `req-prop-appr-${Date.now()}`,
    };
    return this.proposalsService.approve(context, proposalId);
  }

  @Post('proposals/:proposalId/reject')
  @RequireRole('ADMIN')
  async reject(
    @CurrentOrgId() orgId: string,
    @CurrentMembership() membership: Membership,
    @Param('proposalId') proposalId: string,
    @Body() dto: RejectProposalDto,
  ): Promise<ProposalDto> {
    const context: TenantContext = {
      orgId,
      userId: membership.userId,
      role: membership.role as any,
      requestId: `req-prop-rej-${Date.now()}`,
    };
    return this.proposalsService.reject(context, proposalId, dto);
  }
}

