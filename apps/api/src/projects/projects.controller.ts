import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  CreateProjectDto,
  UpdateProjectDto,
  ProjectDto,
  CreateTaskDto,
  UpdateTaskDto,
  TaskDto,
  TaskWithDependenciesDto,
  OrgRole,
  TaskStatus,
} from '@teamos/contracts';
import { SessionUser, Membership } from '@teamos/database';
import { AuthGuard } from '../identity/guards/auth.guard';
import { CurrentUser } from '../identity/decorators/current-user.decorator';
import { OrgMembershipGuard } from '../tenancy/guards/org-membership.guard';
import { RequireRole } from '../tenancy/decorators/require-role.decorator';
import { CurrentOrgId, CurrentMembership } from '../tenancy/decorators/current-org.decorator';
import { ProjectsService } from './projects.service';

@Controller('orgs/:orgId/projects')
@UseGuards(AuthGuard, OrgMembershipGuard)
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Post()
  @RequireRole('MEMBER')
  createProject(
    @CurrentOrgId() orgId: string,
    @CurrentUser() user: SessionUser,
    @CurrentMembership() membership: Membership,
    @Body() dto: CreateProjectDto,
  ): Promise<ProjectDto> {
    return this.projectsService.createProject(
      orgId,
      user.userId,
      membership.role as OrgRole,
      dto,
    );
  }

  @Get()
  listProjects(
    @CurrentOrgId() orgId: string,
    @CurrentUser() user: SessionUser,
    @CurrentMembership() membership: Membership,
  ): Promise<ProjectDto[]> {
    return this.projectsService.listProjects(
      orgId,
      user.userId,
      membership.role as OrgRole,
    );
  }

  @Get(':projectId')
  getProject(
    @CurrentOrgId() orgId: string,
    @CurrentUser() user: SessionUser,
    @CurrentMembership() membership: Membership,
    @Param('projectId') projectId: string,
  ): Promise<ProjectDto> {
    return this.projectsService.getProject(
      orgId,
      user.userId,
      membership.role as OrgRole,
      projectId,
    );
  }

  @Patch(':projectId')
  @RequireRole('ADMIN')
  updateProject(
    @CurrentOrgId() orgId: string,
    @CurrentUser() user: SessionUser,
    @CurrentMembership() membership: Membership,
    @Param('projectId') projectId: string,
    @Body() dto: UpdateProjectDto,
  ): Promise<ProjectDto> {
    return this.projectsService.updateProject(
      orgId,
      user.userId,
      membership.role as OrgRole,
      projectId,
      dto,
    );
  }

  // --- Task Operations ---

  @Post(':projectId/tasks')
  @RequireRole('MEMBER')
  createTask(
    @CurrentOrgId() orgId: string,
    @CurrentUser() user: SessionUser,
    @CurrentMembership() membership: Membership,
    @Param('projectId') projectId: string,
    @Body() dto: CreateTaskDto,
  ): Promise<TaskDto> {
    return this.projectsService.createTask(
      orgId,
      user.userId,
      membership.role as OrgRole,
      projectId,
      dto,
    );
  }

  @Get(':projectId/tasks')
  listTasks(
    @CurrentOrgId() orgId: string,
    @CurrentUser() user: SessionUser,
    @CurrentMembership() membership: Membership,
    @Param('projectId') projectId: string,
    @Query('status') status?: TaskStatus,
    @Query('assigneeId') assigneeId?: string,
  ): Promise<TaskWithDependenciesDto[]> {
    return this.projectsService.listTasks(
      orgId,
      user.userId,
      membership.role as OrgRole,
      projectId,
      { status, assigneeId },
    );
  }

  @Get(':projectId/tasks/:taskId')
  getTask(
    @CurrentOrgId() orgId: string,
    @CurrentUser() user: SessionUser,
    @CurrentMembership() membership: Membership,
    @Param('projectId') projectId: string,
    @Param('taskId') taskId: string,
  ): Promise<TaskDto> {
    return this.projectsService.getTask(
      orgId,
      user.userId,
      membership.role as OrgRole,
      projectId,
      taskId,
    );
  }

  @Patch(':projectId/tasks/:taskId')
  @RequireRole('MEMBER')
  updateTask(
    @CurrentOrgId() orgId: string,
    @CurrentUser() user: SessionUser,
    @CurrentMembership() membership: Membership,
    @Param('projectId') projectId: string,
    @Param('taskId') taskId: string,
    @Body() dto: UpdateTaskDto,
  ): Promise<TaskDto> {
    return this.projectsService.updateTask(
      orgId,
      user.userId,
      membership.role as OrgRole,
      projectId,
      taskId,
      dto,
    );
  }

  @Delete(':projectId/tasks/:taskId')
  @RequireRole('MEMBER')
  deleteTask(
    @CurrentOrgId() orgId: string,
    @CurrentUser() user: SessionUser,
    @CurrentMembership() membership: Membership,
    @Param('projectId') projectId: string,
    @Param('taskId') taskId: string,
  ): Promise<{ success: boolean }> {
    return this.projectsService.deleteTask(
      orgId,
      user.userId,
      membership.role as OrgRole,
      projectId,
      taskId,
    );
  }
}

