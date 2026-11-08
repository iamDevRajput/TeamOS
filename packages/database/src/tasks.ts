import { Prisma, Task, ActorType, TaskStatus } from '@prisma/client';
import { withTenant, TenantContext } from './with-tenant';
import { recordAuditEvent } from './audit';
import {
  CreateTaskDto,
  UpdateTaskDto,
  TaskDto,
  TaskWithDependenciesDto,
} from '@teamos/contracts';

/**
 * Creates a new task in a project with atomic per-project sequential numbering.
 */
export async function createTask(
  context: TenantContext,
  projectId: string,
  dto: CreateTaskDto,
): Promise<Task> {
  return withTenant(context, async (tx) => {
    // 1. Verify project exists in active tenant
    const project = await tx.project.findFirst({
      where: { id: projectId, orgId: context.orgId },
    });

    if (!project) {
      throw new Error('Project not found in this organization.');
    }

    // 2. If assignee provided, verify assignee belongs to the organization
    if (dto.assigneeId) {
      const membership = await tx.membership.findUnique({
        where: {
          orgId_userId: {
            orgId: context.orgId,
            userId: dto.assigneeId,
          },
        },
      });
      if (!membership) {
        throw new Error('Assignee must be an active member of this organization.');
      }
    }

    // 3. Atomically increment project nextTaskNumber
    const taskNumber = project.nextTaskNumber;
    await tx.project.update({
      where: { id: projectId },
      data: {
        nextTaskNumber: { increment: 1 },
      },
    });

    // 4. Create task with initial version = 1
    const task = await tx.task.create({
      data: {
        orgId: context.orgId,
        projectId,
        number: taskNumber,
        title: dto.title.trim(),
        description: dto.description?.trim() || null,
        status: (dto.status as TaskStatus) || TaskStatus.TODO,
        assigneeId: dto.assigneeId || null,
        remainingEstimateWorkdays:
          dto.remainingEstimateWorkdays !== undefined ? Math.round(dto.remainingEstimateWorkdays) : null,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
        version: 1,
        createdBy: context.userId,
      },
    });

    // 5. Audit
    await recordAuditEvent(tx, {
      orgId: context.orgId,
      actorType: ActorType.USER,
      actorId: context.userId,
      action: 'TASK_CREATED',
      entityType: 'TASK',
      entityId: task.id,
      afterData: {
        number: task.number,
        title: task.title,
        status: task.status,
        remainingEstimateWorkdays: task.remainingEstimateWorkdays,
      },
      requestId: context.requestId,
    });

    return task;
  });
}

/**
 * Lists tasks in a project with optional status or assignee filter.
 */
export async function listTasks(
  context: TenantContext,
  projectId: string,
  filters?: { status?: TaskStatus; assigneeId?: string },
): Promise<TaskDto[]> {
  return withTenant(context, async (tx) => {
    const where: Prisma.TaskWhereInput = {
      orgId: context.orgId,
      projectId,
      ...(filters?.status ? { status: filters.status } : {}),
      ...(filters?.assigneeId ? { assigneeId: filters.assigneeId } : {}),
    };

    const tasks = await tx.task.findMany({
      where,
      include: {
        assignee: {
          include: {
            user: {
              select: {
                login: true,
                displayName: true,
              },
            },
          },
        },
      },
      orderBy: { number: 'asc' },
    });

    return tasks.map((t) => ({
      id: t.id,
      orgId: t.orgId,
      projectId: t.projectId,
      number: t.number,
      title: t.title,
      description: t.description || undefined,
      status: t.status as TaskStatus,
      assigneeId: t.assigneeId || undefined,
      assigneeName: t.assignee?.user
        ? (t.assignee.user.displayName || t.assignee.user.login)
        : undefined,
      remainingEstimateWorkdays: t.remainingEstimateWorkdays !== null ? t.remainingEstimateWorkdays : undefined,
      dueDate: t.dueDate ? t.dueDate.toISOString().slice(0, 10) : undefined,
      version: t.version,
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
    }));
  });
}

/**
 * Retrieves a single task by ID.
 */
export async function getTaskById(
  context: TenantContext,
  projectId: string,
  taskId: string,
): Promise<TaskDto | null> {
  return withTenant(context, async (tx) => {
    const t = await tx.task.findFirst({
      where: {
        id: taskId,
        projectId,
        orgId: context.orgId,
      },
      include: {
        assignee: {
          include: {
            user: {
              select: {
                login: true,
                displayName: true,
              },
            },
          },
        },
      },
    });

    if (!t) return null;

    return {
      id: t.id,
      orgId: t.orgId,
      projectId: t.projectId,
      number: t.number,
      title: t.title,
      description: t.description || undefined,
      status: t.status as TaskStatus,
      assigneeId: t.assigneeId || undefined,
      assigneeName: t.assignee?.user
        ? (t.assignee.user.displayName || t.assignee.user.login)
        : undefined,
      remainingEstimateWorkdays: t.remainingEstimateWorkdays !== null ? t.remainingEstimateWorkdays : undefined,
      dueDate: t.dueDate ? t.dueDate.toISOString().slice(0, 10) : undefined,
      version: t.version,
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
    };
  });
}

/**
 * Updates a task with optimistic concurrency version checking.
 * Throws an error with code 'ERR_CONCURRENT_UPDATE' if the expected version doesn't match.
 */
export async function updateTask(
  context: TenantContext,
  projectId: string,
  taskId: string,
  dto: UpdateTaskDto,
): Promise<Task> {
  return withTenant(context, async (tx) => {
    const existing = await tx.task.findFirst({
      where: { id: taskId, projectId, orgId: context.orgId },
    });

    if (!existing) {
      throw new Error('Task not found.');
    }

    // Optimistic Concurrency Check
    if (existing.version !== dto.expectedVersion) {
      const error: any = new Error(
        `Optimistic concurrency failure: task has been modified concurrently. Expected version ${dto.expectedVersion}, but current version is ${existing.version}.`,
      );
      error.code = 'ERR_CONCURRENT_UPDATE';
      error.currentVersion = existing.version;
      throw error;
    }

    // Assignee validation if updating assignee
    if (dto.assigneeId) {
      const membership = await tx.membership.findUnique({
        where: {
          orgId_userId: {
            orgId: context.orgId,
            userId: dto.assigneeId,
          },
        },
      });
      if (!membership) {
        throw new Error('Assignee must be an active member of this organization.');
      }
    }

    const data: Prisma.TaskUpdateInput = {
      version: { increment: 1 },
    };

    if (dto.title !== undefined) data.title = dto.title.trim();
    if (dto.description !== undefined) data.description = dto.description ? dto.description.trim() : null;
    if (dto.status !== undefined) data.status = dto.status as TaskStatus;
    if (dto.assigneeId !== undefined) {
      if (dto.assigneeId) {
        data.assignee = {
          connect: {
            orgId_userId: {
              orgId: context.orgId,
              userId: dto.assigneeId,
            },
          },
        };
      } else {
        // Disconnecting a composite relation in Prisma tries to set all composite FK columns (including org_id) to NULL.
        // Under forced PostgreSQL RLS, setting org_id to NULL violates tenant isolation.
        // We set assignee_id = NULL directly via parameter-safe raw SQL to preserve org_id intact.
        await (tx as any).$executeRaw(
          Prisma.sql`UPDATE public.tasks SET assignee_id = NULL WHERE id = ${taskId}::uuid AND org_id = ${context.orgId}::uuid`
        );
      }
    }
    if (dto.remainingEstimateWorkdays !== undefined) {
      data.remainingEstimateWorkdays =
        dto.remainingEstimateWorkdays !== null ? Math.round(dto.remainingEstimateWorkdays) : null;
    }
    if (dto.dueDate !== undefined) {
      data.dueDate = dto.dueDate ? new Date(dto.dueDate) : null;
    }

    const updated = await tx.task.update({
      where: { id: taskId },
      data,
    });

    const action = dto.status && dto.status !== existing.status ? 'TASK_STATUS_CHANGED' : 'TASK_UPDATED';

    await recordAuditEvent(tx, {
      orgId: context.orgId,
      actorType: ActorType.USER,
      actorId: context.userId,
      action,
      entityType: 'TASK',
      entityId: taskId,
      beforeData: {
        status: existing.status,
        version: existing.version,
        remainingEstimateWorkdays: existing.remainingEstimateWorkdays,
      },
      afterData: {
        status: updated.status,
        version: updated.version,
        remainingEstimateWorkdays: updated.remainingEstimateWorkdays,
      },
      requestId: context.requestId,
    });

    return updated;
  });
}

/**
 * Deletes a task within the tenant organization.
 */
export async function deleteTask(
  context: TenantContext,
  projectId: string,
  taskId: string,
): Promise<void> {
  await withTenant(context, async (tx) => {
    const existing = await tx.task.findFirst({
      where: { id: taskId, projectId, orgId: context.orgId },
    });

    if (!existing) {
      throw new Error('Task not found.');
    }

    await tx.task.delete({
      where: { id: taskId },
    });

    await recordAuditEvent(tx, {
      orgId: context.orgId,
      actorType: ActorType.USER,
      actorId: context.userId,
      action: 'TASK_DELETED',
      entityType: 'TASK',
      entityId: taskId,
      beforeData: { number: existing.number, title: existing.title },
      requestId: context.requestId,
    });
  });
}

/**
 * Lists tasks in a project along with dependency graph metadata (blocker/blocked task IDs, isBlocked status).
 */
export async function listTasksWithDependencies(
  context: TenantContext,
  projectId: string,
  filters?: { status?: TaskStatus; assigneeId?: string },
): Promise<TaskWithDependenciesDto[]> {
  return withTenant(context, async (tx) => {
    const where: Prisma.TaskWhereInput = {
      orgId: context.orgId,
      projectId,
      ...(filters?.status ? { status: filters.status } : {}),
      ...(filters?.assigneeId ? { assigneeId: filters.assigneeId } : {}),
    };

    const tasks = await tx.task.findMany({
      where,
      include: {
        assignee: {
          include: {
            user: {
              select: {
                login: true,
                displayName: true,
              },
            },
          },
        },
        blockedBy: {
          select: {
            blockerTaskId: true,
            blockerTask: {
              select: { status: true },
            },
          },
        },
        blocks: {
          select: {
            blockedTaskId: true,
          },
        },
      },
      orderBy: { number: 'asc' },
    });

    return tasks.map((t) => {
      const isBlocked = t.blockedBy.some(
        (b) =>
          b.blockerTask.status !== TaskStatus.DONE &&
          b.blockerTask.status !== TaskStatus.CANCELLED,
      );

      return {
        id: t.id,
        orgId: t.orgId,
        projectId: t.projectId,
        number: t.number,
        title: t.title,
        description: t.description || undefined,
        status: t.status as TaskStatus,
        assigneeId: t.assigneeId || undefined,
        assigneeName: t.assignee?.user
          ? t.assignee.user.displayName || t.assignee.user.login
          : undefined,
        remainingEstimateWorkdays:
          t.remainingEstimateWorkdays !== null
            ? t.remainingEstimateWorkdays
            : undefined,
        dueDate: t.dueDate ? t.dueDate.toISOString().slice(0, 10) : undefined,
        version: t.version,
        createdAt: t.createdAt.toISOString(),
        updatedAt: t.updatedAt.toISOString(),
        blockerTaskIds: t.blockedBy.map((b) => b.blockerTaskId),
        blockedTaskIds: t.blocks.map((b) => b.blockedTaskId),
        isBlocked,
      };
    });
  });
}
