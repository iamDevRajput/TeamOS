import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuditEventDto, AuditQueryDto, OrgRole } from '@teamos/contracts';
import { SessionUser, Membership } from '@teamos/database';
import { AuthGuard } from '../identity/guards/auth.guard';
import { CurrentUser } from '../identity/decorators/current-user.decorator';
import { OrgMembershipGuard } from '../tenancy/guards/org-membership.guard';
import { RequireRole } from '../tenancy/decorators/require-role.decorator';
import { CurrentOrgId, CurrentMembership } from '../tenancy/decorators/current-org.decorator';
import { AuditService } from './audit.service';

@Controller('orgs/:orgId/audit')
@UseGuards(AuthGuard, OrgMembershipGuard)
@RequireRole('ADMIN')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  getTimeline(
    @CurrentOrgId() orgId: string,
    @CurrentUser() user: SessionUser,
    @CurrentMembership() membership: Membership,
    @Query() query: AuditQueryDto,
  ): Promise<AuditEventDto[]> {
    return this.auditService.getAuditTimeline(
      orgId,
      user.userId,
      membership.role as OrgRole,
      query,
    );
  }
}

