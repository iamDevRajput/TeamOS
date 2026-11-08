import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../identity/guards/auth.guard';
import { OrgMembershipGuard } from '../tenancy/guards/org-membership.guard';
import { CurrentUser } from '../identity/decorators/current-user.decorator';
import { CurrentOrgId, CurrentMembership } from '../tenancy/decorators/current-org.decorator';
import {
  TenantContext,
  CreateMeetingDto,
  ConvertProposalToTaskDto,
  MeetingDto,
  OrgRole,
} from '@teamos/contracts';
import { SessionUser, Membership } from '@teamos/database';
import { MeetingsService } from './meetings.service';

@Controller('orgs/:orgId/projects/:projectId/meetings')
@UseGuards(AuthGuard, OrgMembershipGuard)
export class MeetingsController {
  constructor(private readonly meetingsService: MeetingsService) {}

  @Get()
  async list(
    @CurrentOrgId() orgId: string,
    @CurrentUser() user: SessionUser,
    @CurrentMembership() membership: Membership,
    @Param('projectId') projectId: string
  ): Promise<MeetingDto[]> {
    const context: TenantContext = { orgId, userId: user.userId, role: membership.role as OrgRole };
    return this.meetingsService.list(context, projectId);
  }

  @Post()
  async create(
    @CurrentOrgId() orgId: string,
    @CurrentUser() user: SessionUser,
    @CurrentMembership() membership: Membership,
    @Param('projectId') projectId: string,
    @Body() dto: CreateMeetingDto
  ): Promise<MeetingDto> {
    const context: TenantContext = { orgId, userId: user.userId, role: membership.role as OrgRole };
    return this.meetingsService.create(context, projectId, dto);
  }

  @Get(':meetingId')
  async getById(
    @CurrentOrgId() orgId: string,
    @CurrentUser() user: SessionUser,
    @CurrentMembership() membership: Membership,
    @Param('meetingId') meetingId: string
  ): Promise<MeetingDto> {
    const context: TenantContext = { orgId, userId: user.userId, role: membership.role as OrgRole };
    return this.meetingsService.getById(context, meetingId);
  }

  @Post(':meetingId/proposals/:proposalId/convert')
  async convertProposal(
    @CurrentOrgId() orgId: string,
    @CurrentUser() user: SessionUser,
    @CurrentMembership() membership: Membership,
    @Param('projectId') projectId: string,
    @Param('meetingId') meetingId: string,
    @Param('proposalId') proposalId: string,
    @Body() dto: ConvertProposalToTaskDto
  ): Promise<{ taskId: string; proposalId: string; status: string }> {
    const context: TenantContext = { orgId, userId: user.userId, role: membership.role as OrgRole };
    return this.meetingsService.convertProposalToTask(
      context,
      projectId,
      meetingId,
      proposalId,
      dto
    );
  }

  @Post(':meetingId/proposals/:proposalId/dismiss')
  async dismissProposal(
    @CurrentOrgId() orgId: string,
    @CurrentUser() user: SessionUser,
    @CurrentMembership() membership: Membership,
    @Param('meetingId') meetingId: string,
    @Param('proposalId') proposalId: string
  ): Promise<{ success: boolean }> {
    const context: TenantContext = { orgId, userId: user.userId, role: membership.role as OrgRole };
    return this.meetingsService.dismissProposal(context, meetingId, proposalId);
  }
}
