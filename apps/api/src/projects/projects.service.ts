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
  listTasks,
  listTasksWithDependencies,
  getTaskById,
  updateTask,
  deleteTask,
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
}

