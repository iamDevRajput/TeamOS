import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { TenancyService } from './tenancy.service';
import { OrgsController } from './orgs.controller';
import { InvitationsController } from './invitations.controller';
import { OrgMembershipGuard } from './guards/org-membership.guard';

@Module({
  imports: [IdentityModule],
  controllers: [OrgsController, InvitationsController],
  providers: [TenancyService, OrgMembershipGuard],
  exports: [TenancyService, OrgMembershipGuard],
})
export class TenancyModule {}

