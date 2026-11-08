import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { CreateReportDto, ProjectReportDto, OrgRole } from '@teamos/contracts';
import { SessionUser, Membership, TenantContext } from '@teamos/database';
import { AuthGuard } from '../identity/guards/auth.guard';
import { CurrentUser } from '../identity/decorators/current-user.decorator';
import { OrgMembershipGuard } from '../tenancy/guards/org-membership.guard';
import { RequireRole } from '../tenancy/decorators/require-role.decorator';
import { CurrentOrgId, CurrentMembership } from '../tenancy/decorators/current-org.decorator';
import { ReportsService } from './reports.service';

@Controller('orgs/:orgId/projects/:projectId/reports')
@UseGuards(AuthGuard, OrgMembershipGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Post()
  @RequireRole('MEMBER')
  generateReport(
    @CurrentOrgId() orgId: string,
    @CurrentUser() user: SessionUser,
    @CurrentMembership() membership: Membership,
    @Param('projectId') projectId: string,
    @Body() dto: CreateReportDto,
  ): Promise<ProjectReportDto> {
    const context: TenantContext = {
      orgId,
      userId: user.userId,
      role: membership.role as OrgRole,
    };
    return this.reportsService.generateReport(context, projectId, dto);
  }

  @Get()
  @RequireRole('MEMBER')
  listReports(
    @CurrentOrgId() orgId: string,
    @CurrentUser() user: SessionUser,
    @CurrentMembership() membership: Membership,
    @Param('projectId') projectId: string,
  ): Promise<ProjectReportDto[]> {
    const context: TenantContext = {
      orgId,
      userId: user.userId,
      role: membership.role as OrgRole,
    };
    return this.reportsService.listReports(context, projectId);
  }

  @Get(':reportId')
  @RequireRole('MEMBER')
  getReport(
    @CurrentOrgId() orgId: string,
    @CurrentUser() user: SessionUser,
    @CurrentMembership() membership: Membership,
    @Param('reportId') reportId: string,
  ): Promise<ProjectReportDto> {
    const context: TenantContext = {
      orgId,
      userId: user.userId,
      role: membership.role as OrgRole,
    };
    return this.reportsService.getReport(context, reportId);
  }
}

