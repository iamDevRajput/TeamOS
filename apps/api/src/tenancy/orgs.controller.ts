import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import {
  CreateOrgDto,
  OrgDto,
  OrgMemberDto,
  UpdateMemberRoleDto,
  TransferOwnershipDto,
  CreateInvitationDto,
  CreatedInvitationResponseDto,
  InvitationDto,
  OrgRole,
} from '@teamos/contracts';
import { SessionUser, Membership } from '@teamos/database';
import { AuthGuard } from '../identity/guards/auth.guard';
import { CurrentUser } from '../identity/decorators/current-user.decorator';
import { TenancyService } from './tenancy.service';
import { OrgMembershipGuard } from './guards/org-membership.guard';
import { RequireRole } from './decorators/require-role.decorator';
import { CurrentOrgId, CurrentMembership } from './decorators/current-org.decorator';

@Controller('orgs')
@UseGuards(AuthGuard)
export class OrgsController {
  constructor(private readonly tenancyService: TenancyService) {}

  @Post()
  createOrg(
    @CurrentUser() user: SessionUser,
    @Body() dto: CreateOrgDto,
  ): Promise<OrgDto> {
    return this.tenancyService.createOrg(user.userId, dto);
  }

  @Get()
  listUserOrgs(@CurrentUser() user: SessionUser): Promise<OrgDto[]> {
    return this.tenancyService.listUserOrgs(user.userId);
  }

  @Get(':orgId')
  @UseGuards(OrgMembershipGuard)
  getOrgDetails(
    @CurrentOrgId() orgId: string,
    @CurrentUser() user: SessionUser,
  ): Promise<OrgDto> {
    return this.tenancyService.getOrgDetails(orgId, user.userId);
  }

  @Get(':orgId/members')
  @UseGuards(OrgMembershipGuard)
  listMembers(
    @CurrentOrgId() orgId: string,
    @CurrentUser() user: SessionUser,
    @CurrentMembership() membership: Membership,
  ): Promise<OrgMemberDto[]> {
    return this.tenancyService.listMembers(
      orgId,
      user.userId,
      membership.role as OrgRole,
    );
  }

  @Patch(':orgId/members/:userId')
  @UseGuards(OrgMembershipGuard)
  @RequireRole('OWNER')
  updateMemberRole(
    @CurrentOrgId() orgId: string,
    @CurrentUser() user: SessionUser,
    @CurrentMembership() membership: Membership,
    @Param('userId') targetUserId: string,
    @Body() dto: UpdateMemberRoleDto,
  ): Promise<OrgMemberDto> {
    return this.tenancyService.updateRole(
      orgId,
      user.userId,
      membership.role as OrgRole,
      targetUserId,
      dto.role,
    );
  }

  @Delete(':orgId/members/:userId')
  @UseGuards(OrgMembershipGuard)
  removeMember(
    @CurrentOrgId() orgId: string,
    @CurrentUser() user: SessionUser,
    @CurrentMembership() membership: Membership,
    @Param('userId') targetUserId: string,
  ): Promise<{ success: boolean }> {
    return this.tenancyService.removeMember(
      orgId,
      user.userId,
      membership.role as OrgRole,
      targetUserId,
    );
  }

  @Post(':orgId/transfer-ownership')
  @UseGuards(OrgMembershipGuard)
  @RequireRole('OWNER')
  transferOwnership(
    @CurrentOrgId() orgId: string,
    @CurrentUser() user: SessionUser,
    @CurrentMembership() membership: Membership,
    @Body() dto: TransferOwnershipDto,
  ): Promise<{ success: boolean }> {
    return this.tenancyService.transferOwnership(
      orgId,
      user.userId,
      membership.role as OrgRole,
      dto.newOwnerUserId,
    );
  }

  @Get(':orgId/invitations')
  @UseGuards(OrgMembershipGuard)
  @RequireRole('ADMIN')
  listInvitations(
    @CurrentOrgId() orgId: string,
    @CurrentUser() user: SessionUser,
    @CurrentMembership() membership: Membership,
  ): Promise<InvitationDto[]> {
    return this.tenancyService.listInvitations(
      orgId,
      user.userId,
      membership.role as OrgRole,
    );
  }

  @Post(':orgId/invitations')
  @UseGuards(OrgMembershipGuard)
  @RequireRole('ADMIN')
  inviteTeammate(
    @CurrentOrgId() orgId: string,
    @CurrentUser() user: SessionUser,
    @CurrentMembership() membership: Membership,
    @Body() dto: CreateInvitationDto,
  ): Promise<CreatedInvitationResponseDto> {
    return this.tenancyService.inviteTeammate(
      orgId,
      user.userId,
      membership.role as OrgRole,
      dto,
    );
  }

  @Delete(':orgId/invitations/:invitationId')
  @UseGuards(OrgMembershipGuard)
  @RequireRole('ADMIN')
  revokeInvitation(
    @CurrentOrgId() orgId: string,
    @CurrentUser() user: SessionUser,
    @CurrentMembership() membership: Membership,
    @Param('invitationId') invitationId: string,
  ): Promise<{ success: boolean }> {
    return this.tenancyService.revokeInvitation(
      orgId,
      user.userId,
      membership.role as OrgRole,
      invitationId,
    );
  }
}

