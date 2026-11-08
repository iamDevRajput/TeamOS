import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../identity/guards/auth.guard';
import { OrgMembershipGuard } from '../tenancy/guards/org-membership.guard';
import { CurrentOrgId, CurrentMembership } from '../tenancy/decorators/current-org.decorator';
import { DependenciesService } from './dependencies.service';
import {
  TenantContext,
  DependencyDto,
  CreateDependencyDto,
} from '@teamos/contracts';
import { Membership } from '@teamos/database';

@Controller('orgs/:orgId/projects/:projectId/dependencies')
@UseGuards(AuthGuard, OrgMembershipGuard)
export class DependenciesController {
  constructor(private readonly dependenciesService: DependenciesService) {}

  @Post()
  async add(
    @CurrentOrgId() orgId: string,
    @CurrentMembership() membership: Membership,
    @Param('projectId') projectId: string,
    @Body() dto: CreateDependencyDto,
  ): Promise<DependencyDto> {
    const context: TenantContext = {
      orgId,
      userId: (membership as any)?.userId || (membership as any)?.user_id,
      role: membership.role as any,
      requestId: `req-dep-add-${Date.now()}`,
    };
    return this.dependenciesService.add(context, projectId, dto);
  }

  @Delete()
  async remove(
    @CurrentOrgId() orgId: string,
    @CurrentMembership() membership: Membership,
    @Param('projectId') projectId: string,
    @Body() dto: CreateDependencyDto,
  ): Promise<{ success: boolean }> {
    const context: TenantContext = {
      orgId,
      userId: (membership as any)?.userId || (membership as any)?.user_id,
      role: membership.role as any,
      requestId: `req-dep-rem-${Date.now()}`,
    };
    return this.dependenciesService.remove(context, projectId, dto);
  }

  @Get()
  async list(
    @CurrentOrgId() orgId: string,
    @CurrentMembership() membership: Membership,
    @Param('projectId') projectId: string,
  ): Promise<DependencyDto[]> {
    const context: TenantContext = {
      orgId,
      userId: (membership as any)?.userId || (membership as any)?.user_id,
      role: membership.role as any,
      requestId: `req-dep-list-${Date.now()}`,
    };
    return this.dependenciesService.list(context, projectId);
  }
}

