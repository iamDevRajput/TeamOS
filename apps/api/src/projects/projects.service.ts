import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import {
  CreateProjectDto,
  UpdateProjectDto,
  ProjectDto,
  CreateTaskDto,
  UpdateTaskDto,
  TaskDto,
  TaskWithDependenciesDto,
  TaskCommentDto,
  CreateTaskCommentDto,
  TaskGithubLinkDto,
  ProjectRiskHistoryDto,
  OrgRole,
  TaskStatus,
} from '@teamos/contracts';
import {
  TenantContext,
  createProject,
  listProjects,
  getProjectById,
  updateProject,
  createTask,
  listTasksWithDependencies,
  getTaskById,
  updateTask,
  deleteTask,
  createTaskComment as dbCreateTaskComment,
  listTaskComments as dbListTaskComments,
  deleteTaskComment as dbDeleteTaskComment,
  listTaskGithubLinks as dbListTaskGithubLinks,
  listProjectRiskHistory as dbListProjectRiskHistory,
} from '@teamos/database';

@Injectable()
export class ProjectsService {
  private buildTenantContext(orgId: string, userId: string, role: OrgRole): TenantContext {
    return {
      orgId,
      userId,
      role,
    };
  }

  async createProject(
    orgId: string,
    userId: string,
    role: OrgRole,
    dto: CreateProjectDto,
  ): Promise<ProjectDto> {
    const context = this.buildTenantContext(orgId, userId, role);
    try {
      const p = await createProject(context, dto);
      return {
        id: p.id,
        orgId: p.orgId,
        key: p.key,
        name: p.name,
        startDate: p.startDate ? p.startDate.toISOString().slice(0, 10) : null,
        dueDate: p.dueDate ? p.dueDate.toISOString().slice(0, 10) : null,
        timezone: p.timezone,
        nextTaskNumber: p.nextTaskNumber,
        taskCount: 0,
        createdAt: p.createdAt.toISOString(),
      };
    } catch (err: any) {
      if (err.message?.includes('already in use')) {
        throw new ConflictException(err.message);
      }
      throw new BadRequestException(err.message || 'Failed to create project.');
    }
  }

  async listProjects(orgId: string, userId: string, role: OrgRole): Promise<ProjectDto[]> {
    const context = this.buildTenantContext(orgId, userId, role);
    return listProjects(context);
  }

  async getProject(
    orgId: string,
    userId: string,
    role: OrgRole,
    projectId: string,
  ): Promise<ProjectDto> {
    const context = this.buildTenantContext(orgId, userId, role);
    const p = await getProjectById(context, projectId);
    if (!p) {
      throw new NotFoundException(`Project "${projectId}" not found.`);
    }
    return p;
  }

  async updateProject(
    orgId: string,
    userId: string,
    role: OrgRole,
    projectId: string,
    dto: UpdateProjectDto,
  ): Promise<ProjectDto> {
    const context = this.buildTenantContext(orgId, userId, role);
    try {
      const p = await updateProject(context, projectId, dto);
      return {
        id: p.id,
        orgId: p.orgId,
        key: p.key,
        name: p.name,
        startDate: p.startDate ? p.startDate.toISOString().slice(0, 10) : null,
        dueDate: p.dueDate ? p.dueDate.toISOString().slice(0, 10) : null,
        timezone: p.timezone,
        nextTaskNumber: p.nextTaskNumber,
        createdAt: p.createdAt.toISOString(),
      };
    } catch (err: any) {
      if (err.message?.includes('not found')) {
        throw new NotFoundException(err.message);
      }
      throw new BadRequestException(err.message || 'Failed to update project.');
    }
  }

  async createTask(
    orgId: string,
    userId: string,
    role: OrgRole,
    projectId: string,
    dto: CreateTaskDto,
  ): Promise<TaskDto> {
    const context = this.buildTenantContext(orgId, userId, role);
    try {
      const t = await createTask(context, projectId, dto);
      return {
        id: t.id,
        orgId: t.orgId,
        projectId: t.projectId,
        number: t.number,
        title: t.title,
        description: t.description || undefined,
        status: t.status as TaskStatus,
        priority: (t.priority as any) || 'MEDIUM',
        assigneeId: t.assigneeId || undefined,
        remainingEstimateWorkdays: t.remainingEstimateWorkdays ?? undefined,
        dueDate: t.dueDate ? t.dueDate.toISOString().slice(0, 10) : undefined,
        version: t.version,
        createdAt: t.createdAt.toISOString(),
        updatedAt: t.updatedAt.toISOString(),
      };
    } catch (err: any) {
      if (err.message?.includes('Project not found')) {
        throw new NotFoundException(err.message);
      }
      throw new BadRequestException(err.message || 'Failed to create task.');
    }
  }

  async listTasks(
    orgId: string,
    userId: string,
    role: OrgRole,
    projectId: string,
    filters?: { status?: TaskStatus; assigneeId?: string },
  ): Promise<TaskWithDependenciesDto[]> {
    const context = this.buildTenantContext(orgId, userId, role);
    return listTasksWithDependencies(context, projectId, filters);
  }

  async getTask(
    orgId: string,
    userId: string,
    role: OrgRole,
    projectId: string,
    taskId: string,
  ): Promise<TaskDto> {
    const context = this.buildTenantContext(orgId, userId, role);
    const task = await getTaskById(context, projectId, taskId);
    if (!task) {
      throw new NotFoundException(`Task "${taskId}" not found.`);
    }
    return task;
  }

  async updateTask(
    orgId: string,
    userId: string,
    role: OrgRole,
    projectId: string,
    taskId: string,
    dto: UpdateTaskDto,
  ): Promise<TaskDto> {
    const context = this.buildTenantContext(orgId, userId, role);
    try {
      const t = await updateTask(context, projectId, taskId, dto);
      return {
        id: t.id,
        orgId: t.orgId,
        projectId: t.projectId,
        number: t.number,
        title: t.title,
        description: t.description || undefined,
        status: t.status as TaskStatus,
        priority: (t.priority as any) || 'MEDIUM',
        assigneeId: t.assigneeId || undefined,
        remainingEstimateWorkdays: t.remainingEstimateWorkdays ?? undefined,
        dueDate: t.dueDate ? t.dueDate.toISOString().slice(0, 10) : undefined,
        version: t.version,
        createdAt: t.createdAt.toISOString(),
        updatedAt: t.updatedAt.toISOString(),
      };
    } catch (err: any) {
      if (err.code === 'ERR_CONCURRENT_UPDATE') {
        throw new ConflictException(err.message);
      }
      if (err.message?.includes('not found')) {
        throw new NotFoundException(err.message);
      }
      throw new BadRequestException(err.message || 'Failed to update task.');
    }
  }

  async deleteTask(
    orgId: string,
    userId: string,
    role: OrgRole,
    projectId: string,
    taskId: string,
  ): Promise<{ success: boolean }> {
    const context = this.buildTenantContext(orgId, userId, role);
    try {
      await deleteTask(context, projectId, taskId);
      return { success: true };
    } catch (err: any) {
      if (err.message?.includes('not found')) {
        throw new NotFoundException(err.message);
      }
      throw new BadRequestException(err.message || 'Failed to delete task.');
    }
  }

  // --- Task Comments ---

  async createTaskComment(
    orgId: string,
    userId: string,
    role: OrgRole,
    projectId: string,
    taskId: string,
    dto: CreateTaskCommentDto,
  ): Promise<TaskCommentDto> {
    const context = this.buildTenantContext(orgId, userId, role);
    try {
      return await dbCreateTaskComment(context, projectId, taskId, dto);
    } catch (err: any) {
      if (err.message?.includes('not found')) {
        throw new NotFoundException(err.message);
      }
      throw new BadRequestException(err.message || 'Failed to post task comment.');
    }
  }

  async listTaskComments(
    orgId: string,
    userId: string,
    role: OrgRole,
    projectId: string,
    taskId: string,
  ): Promise<TaskCommentDto[]> {
    const context = this.buildTenantContext(orgId, userId, role);
    return dbListTaskComments(context, projectId, taskId);
  }

  async deleteTaskComment(
    orgId: string,
    userId: string,
    role: OrgRole,
    projectId: string,
    taskId: string,
    commentId: string,
  ): Promise<{ success: boolean }> {
    const context = this.buildTenantContext(orgId, userId, role);
    try {
      await dbDeleteTaskComment(context, projectId, taskId, commentId);
      return { success: true };
    } catch (err: any) {
      if (err.message?.includes('Permission denied')) {
        throw new BadRequestException(err.message);
      }
      if (err.message?.includes('not found')) {
        throw new NotFoundException(err.message);
      }
      throw new BadRequestException(err.message || 'Failed to delete comment.');
    }
  }

  // --- GitHub PR Links & Risk History ---

  async listTaskGithubLinks(
    orgId: string,
    userId: string,
    role: OrgRole,
    taskId: string,
  ): Promise<TaskGithubLinkDto[]> {
    const context = this.buildTenantContext(orgId, userId, role);
    return dbListTaskGithubLinks(context, taskId);
  }

  async listProjectRiskHistory(
    orgId: string,
    userId: string,
    role: OrgRole,
    projectId: string,
    limitDays = 30,
  ): Promise<ProjectRiskHistoryDto[]> {
    const context = this.buildTenantContext(orgId, userId, role);
    return dbListProjectRiskHistory(context, projectId, limitDays);
  }
}

