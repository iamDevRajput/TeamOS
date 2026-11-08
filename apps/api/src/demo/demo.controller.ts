import {
  Controller,
  Post,
  Param,
  UseGuards,
  Body,
} from '@nestjs/common';
import { AuthGuard } from '../identity/guards/auth.guard';
import { OrgMembershipGuard } from '../tenancy/guards/org-membership.guard';
import { CurrentUser } from '../identity/decorators/current-user.decorator';
import { CurrentOrgId, CurrentMembership } from '../tenancy/decorators/current-org.decorator';
import { TenantContext, OrgRole } from '@teamos/contracts';
import { SessionUser, Membership } from '@teamos/database';
import { DemoService } from './demo.service';

@Controller('orgs/:orgId/demo')
@UseGuards(AuthGuard, OrgMembershipGuard)
export class DemoController {
  constructor(private readonly demoService: DemoService) {}

  @Post('setup')
  async setup(
    @CurrentOrgId() orgId: string,
    @CurrentUser() user: SessionUser,
    @CurrentMembership() membership: Membership
  ) {
    const context: TenantContext = { orgId, userId: user.userId, role: membership.role as OrgRole };
    return this.demoService.setupEnterpriseDemo(context);
  }

  @Post('step-delay')
  async triggerStepDelay(
    @CurrentOrgId() orgId: string,
    @CurrentUser() user: SessionUser,
    @CurrentMembership() membership: Membership,
    @Body('projectId') projectId: string
  ) {
    const context: TenantContext = { orgId, userId: user.userId, role: membership.role as OrgRole };
    return this.demoService.triggerStepDelay(context, projectId);
  }
}
