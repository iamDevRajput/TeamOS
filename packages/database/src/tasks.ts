import { Prisma, Task, ActorType, TaskStatus, TaskPriority } from '@prisma/client';
import { withTenant, TenantContext } from './with-tenant';
import { recordAuditEvent } from './audit';
import {
  CreateTaskDto,
  UpdateTaskDto,
  TaskDto,
  TaskWithDependenciesDto,
  TaskCommentDto,
  CreateTaskCommentDto,
  TaskGithubLinkDto,
  ProjectRiskHistoryDto,
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
        priority: (dto.priority as TaskPriority) || TaskPriority.MEDIUM,
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
      priority: (t.priority as any) || 'MEDIUM',
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
      priority: (t.priority as any) || 'MEDIUM',
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
    if (dto.priority !== undefined) data.priority = dto.priority as TaskPriority;
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
        priority: (t.priority as any) || 'MEDIUM',
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

/**
 * Creates a comment on a task.
 */
export async function createTaskComment(
  context: TenantContext,
  projectId: string,
  taskId: string,
  dto: CreateTaskCommentDto,
): Promise<TaskCommentDto> {
  return withTenant(context, async (tx) => {
    const task = await tx.task.findFirst({
      where: { id: taskId, projectId, orgId: context.orgId },
    });
    if (!task) {
      throw new Error('Task not found.');
    }

    const comment = await tx.taskComment.create({
      data: {
        orgId: context.orgId,
        taskId,
        userId: context.userId,
        body: dto.body.trim(),
      },
      include: {
        author: {
          select: {
            login: true,
            displayName: true,
            avatarUrl: true,
          },
        },
      },
    });

    await recordAuditEvent(tx, {
      orgId: context.orgId,
      actorType: ActorType.USER,
      actorId: context.userId,
      action: 'TASK_COMMENT_CREATED',
      entityType: 'TASK',
      entityId: taskId,
      afterData: { commentId: comment.id, body: comment.body.slice(0, 100) },
      requestId: context.requestId,
    });

    return {
      id: comment.id,
      orgId: comment.orgId,
      taskId: comment.taskId,
      userId: comment.userId,
      userLogin: comment.author.login,
      userDisplayName: comment.author.displayName || undefined,
      userAvatarUrl: comment.author.avatarUrl || undefined,
      body: comment.body,
      createdAt: comment.createdAt.toISOString(),
      updatedAt: comment.updatedAt.toISOString(),
    };
  });
}

/**
 * Lists all comments for a task in chronological order.
 */
export async function listTaskComments(
  context: TenantContext,
  _projectId: string,
  taskId: string,
): Promise<TaskCommentDto[]> {
  return withTenant(context, async (tx) => {
    const comments = await tx.taskComment.findMany({
      where: { orgId: context.orgId, taskId },
      include: {
        author: {
          select: {
            login: true,
            displayName: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return comments.map((c) => ({
      id: c.id,
      orgId: c.orgId,
      taskId: c.taskId,
      userId: c.userId,
      userLogin: c.author.login,
      userDisplayName: c.author.displayName || undefined,
      userAvatarUrl: c.author.avatarUrl || undefined,
      body: c.body,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
    }));
  });
}

/**
 * Deletes a task comment. Allowed only for comment author or org admin/owner.
 */
export async function deleteTaskComment(
  context: TenantContext,
  _projectId: string,
  taskId: string,
  commentId: string,
): Promise<void> {
  return withTenant(context, async (tx) => {
    const comment = await tx.taskComment.findFirst({
      where: { id: commentId, orgId: context.orgId, taskId },
    });
    if (!comment) {
      throw new Error('Comment not found.');
    }
    if (comment.userId !== context.userId && context.role !== 'OWNER' && context.role !== 'ADMIN') {
      throw new Error('Permission denied: cannot delete another user comment.');
    }

    await tx.taskComment.delete({
      where: { id: commentId },
    });
  });
}

/**
 * Links a GitHub PR to a task.
 */
export async function linkPrToTask(
  context: TenantContext,
  taskId: string,
  data: {
    prNumber: number;
    prTitle: string;
    prUrl: string;
    prBranch: string;
    prState?: string;
    isStalled?: boolean;
  },
): Promise<TaskGithubLinkDto> {
  return withTenant(context, async (tx) => {
    const link = await tx.taskGithubLink.upsert({
      where: {
        orgId_taskId_prNumber: {
          orgId: context.orgId,
          taskId,
          prNumber: data.prNumber,
        },
      },
      create: {
        orgId: context.orgId,
        taskId,
        prNumber: data.prNumber,
        prTitle: data.prTitle,
        prUrl: data.prUrl,
        prBranch: data.prBranch,
        prState: data.prState || 'OPEN',
        isStalled: data.isStalled || false,
        lastActivityAt: new Date(),
      },
      update: {
        prTitle: data.prTitle,
        prUrl: data.prUrl,
        prBranch: data.prBranch,
        prState: data.prState || 'OPEN',
        isStalled: data.isStalled !== undefined ? data.isStalled : false,
        lastActivityAt: new Date(),
      },
    });

    return {
      id: link.id,
      orgId: link.orgId,
      taskId: link.taskId,
      prNumber: link.prNumber,
      prTitle: link.prTitle,
      prUrl: link.prUrl,
      prBranch: link.prBranch,
      prState: link.prState,
      isStalled: link.isStalled,
      lastActivityAt: link.lastActivityAt.toISOString(),
      createdAt: link.createdAt.toISOString(),
    };
  });
}

/**
 * Lists linked GitHub PRs for a task.
 */
export async function listTaskGithubLinks(
  context: TenantContext,
  taskId: string,
): Promise<TaskGithubLinkDto[]> {
  return withTenant(context, async (tx) => {
    const links = await tx.taskGithubLink.findMany({
      where: { orgId: context.orgId, taskId },
      orderBy: { createdAt: 'desc' },
    });

    return links.map((l) => ({
      id: l.id,
      orgId: l.orgId,
      taskId: l.taskId,
      prNumber: l.prNumber,
      prTitle: l.prTitle,
      prUrl: l.prUrl,
      prBranch: l.prBranch,
      prState: l.prState,
      isStalled: l.isStalled,
      lastActivityAt: l.lastActivityAt.toISOString(),
      createdAt: l.createdAt.toISOString(),
    }));
  });
}

/**
 * Records an idempotent daily risk history snapshot for a project.
 */
export async function recordProjectRiskHistory(
  context: TenantContext,
  projectId: string,
  snapshot: {
    snapshotDate: Date;
    targetDate?: Date | null;
    forecastDate?: Date | null;
    scheduleVarianceDays: number;
    criticalPathDuration: number;
    criticalTaskCount: number;
    riskLevel: string;
    snapshotHash: string;
  },
): Promise<ProjectRiskHistoryDto> {
  return withTenant(context, async (tx) => {
    const record = await tx.projectRiskHistory.upsert({
      where: {
        orgId_projectId_snapshotDate: {
          orgId: context.orgId,
          projectId,
          snapshotDate: snapshot.snapshotDate,
        },
      },
      create: {
        orgId: context.orgId,
        projectId,
        snapshotDate: snapshot.snapshotDate,
        targetDate: snapshot.targetDate,
        forecastDate: snapshot.forecastDate,
        scheduleVarianceDays: snapshot.scheduleVarianceDays,
        criticalPathDuration: snapshot.criticalPathDuration,
        criticalTaskCount: snapshot.criticalTaskCount,
        riskLevel: snapshot.riskLevel,
        snapshotHash: snapshot.snapshotHash,
      },
      update: {
        targetDate: snapshot.targetDate,
        forecastDate: snapshot.forecastDate,
        scheduleVarianceDays: snapshot.scheduleVarianceDays,
        criticalPathDuration: snapshot.criticalPathDuration,
        criticalTaskCount: snapshot.criticalTaskCount,
        riskLevel: snapshot.riskLevel,
        snapshotHash: snapshot.snapshotHash,
      },
    });

    return {
      id: record.id,
      orgId: record.orgId,
      projectId: record.projectId,
      snapshotDate: record.snapshotDate.toISOString().slice(0, 10),
      targetDate: record.targetDate ? record.targetDate.toISOString().slice(0, 10) : undefined,
      forecastDate: record.forecastDate ? record.forecastDate.toISOString().slice(0, 10) : undefined,
      scheduleVarianceDays: record.scheduleVarianceDays,
      criticalPathDuration: record.criticalPathDuration,
      criticalTaskCount: record.criticalTaskCount,
      riskLevel: record.riskLevel,
      snapshotHash: record.snapshotHash,
      createdAt: record.createdAt.toISOString(),
    };
  });
}

/**
 * Lists the historical risk snapshots for a project up to limitDays.
 */
export async function listProjectRiskHistory(
  context: TenantContext,
  projectId: string,
  limitDays = 30,
): Promise<ProjectRiskHistoryDto[]> {
  return withTenant(context, async (tx) => {
    const records = await tx.projectRiskHistory.findMany({
      where: { orgId: context.orgId, projectId },
      orderBy: { snapshotDate: 'asc' },
      take: limitDays,
    });

    return records.map((r) => ({
      id: r.id,
      orgId: r.orgId,
      projectId: r.projectId,
      snapshotDate: r.snapshotDate.toISOString().slice(0, 10),
      targetDate: r.targetDate ? r.targetDate.toISOString().slice(0, 10) : undefined,
      forecastDate: r.forecastDate ? r.forecastDate.toISOString().slice(0, 10) : undefined,
      scheduleVarianceDays: r.scheduleVarianceDays,
      criticalPathDuration: r.criticalPathDuration,
      criticalTaskCount: r.criticalTaskCount,
      riskLevel: r.riskLevel,
      snapshotHash: r.snapshotHash,
      createdAt: r.createdAt.toISOString(),
    }));
  });
}
