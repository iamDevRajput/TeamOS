import { Prisma, ActorType } from '@prisma/client';
import { TenantContext, DependencyDto } from '@teamos/contracts';
import { validateAndSortGraph } from '@teamos/risk-engine';
import { withTenant } from './with-tenant';
import { recordAuditEvent } from './audit';

export async function addDependency(
  context: TenantContext,
  params: {
    projectId: string;
    blockerTaskId: string;
    blockedTaskId: string;
  },
): Promise<DependencyDto> {
  if (params.blockerTaskId === params.blockedTaskId) {
    throw new Error('ERR_SELF_DEPENDENCY');
  }

  return withTenant(context, async (tx: Prisma.TransactionClient) => {
    // 1. Serialize dependency edits per project using explicit row lock to prevent race conditions & concurrent cycle creation
    await tx.$queryRaw`
      SELECT id FROM projects 
      WHERE org_id = ${context.orgId}::uuid AND id = ${params.projectId}::uuid 
      FOR UPDATE
    `;

    // 2. Validate both tasks exist in this project and tenant
    const tasks = await tx.task.findMany({
      where: {
        orgId: context.orgId,
        projectId: params.projectId,
        id: { in: [params.blockerTaskId, params.blockedTaskId] },
      },
      select: { id: true, projectId: true },
    });

    if (tasks.length < 2) {
      throw new Error('ERR_TASK_NOT_FOUND');
    }

    // 3. Check if dependency already exists
    const existing = await tx.taskDependency.findUnique({
      where: {
        orgId_blockerTaskId_blockedTaskId: {
          orgId: context.orgId,
          blockerTaskId: params.blockerTaskId,
          blockedTaskId: params.blockedTaskId,
        },
      },
    });

    if (existing) {
      throw new Error('ERR_DEPENDENCY_EXISTS');
    }

    // 4. Fetch all tasks and dependencies in this project for cycle detection
    const allTasks = await tx.task.findMany({
      where: {
        orgId: context.orgId,
        projectId: params.projectId,
      },
      select: { id: true },
    });

    const allDependencies = await tx.taskDependency.findMany({
      where: {
        orgId: context.orgId,
        projectId: params.projectId,
      },
      select: {
        blockerTaskId: true,
        blockedTaskId: true,
      },
    });

    // 5. Test DAG acyclicity with risk-engine
    const validation = validateAndSortGraph(
      allTasks.map((t: { id: string }) => t.id),
      [
        ...allDependencies,
        {
          blockerTaskId: params.blockerTaskId,
          blockedTaskId: params.blockedTaskId,
        },
      ],
    );

    if (validation.hasCycle) {
      throw new Error('ERR_DEPENDENCY_CYCLE');
    }

    // 6. Create dependency edge
    const created = await tx.taskDependency.create({
      data: {
        orgId: context.orgId,
        projectId: params.projectId,
        blockerTaskId: params.blockerTaskId,
        blockedTaskId: params.blockedTaskId,
        createdBy: context.userId,
      },
    });

    // 7. Audit log
    await recordAuditEvent(tx, {
      orgId: context.orgId,
      actorType: ActorType.USER,
      actorId: context.userId,
      action: 'DEPENDENCY_ADDED',
      entityType: 'TASK_DEPENDENCY',
      entityId: params.blockedTaskId,
      afterData: {
        projectId: params.projectId,
        blockerTaskId: params.blockerTaskId,
        blockedTaskId: params.blockedTaskId,
      },
      requestId: context.requestId,
    });

    return {
      orgId: created.orgId,
      projectId: created.projectId,
      blockerTaskId: created.blockerTaskId,
      blockedTaskId: created.blockedTaskId,
      createdBy: created.createdBy,
      createdAt: created.createdAt.toISOString(),
    };
  });
}

export async function removeDependency(
  context: TenantContext,
  params: {
    projectId: string;
    blockerTaskId: string;
    blockedTaskId: string;
  },
): Promise<void> {
  return withTenant(context, async (tx: Prisma.TransactionClient) => {
    // 1. Serialize project edits
    await tx.$queryRaw`
      SELECT id FROM projects 
      WHERE org_id = ${context.orgId}::uuid AND id = ${params.projectId}::uuid 
      FOR UPDATE
    `;

    const existing = await tx.taskDependency.findUnique({
      where: {
        orgId_blockerTaskId_blockedTaskId: {
          orgId: context.orgId,
          blockerTaskId: params.blockerTaskId,
          blockedTaskId: params.blockedTaskId,
        },
      },
    });

    if (!existing) {
      throw new Error('ERR_DEPENDENCY_NOT_FOUND');
    }

    await tx.taskDependency.delete({
      where: {
        orgId_blockerTaskId_blockedTaskId: {
          orgId: context.orgId,
          blockerTaskId: params.blockerTaskId,
          blockedTaskId: params.blockedTaskId,
        },
      },
    });

    await recordAuditEvent(tx, {
      orgId: context.orgId,
      actorType: ActorType.USER,
      actorId: context.userId,
      action: 'DEPENDENCY_REMOVED',
      entityType: 'TASK_DEPENDENCY',
      entityId: params.blockedTaskId,
      beforeData: {
        projectId: params.projectId,
        blockerTaskId: params.blockerTaskId,
        blockedTaskId: params.blockedTaskId,
      },
      requestId: context.requestId,
    });
  });
}

export async function listProjectDependencies(
  context: TenantContext,
  projectId: string,
): Promise<DependencyDto[]> {
  return withTenant(context, async (tx: Prisma.TransactionClient) => {
    const deps = await tx.taskDependency.findMany({
      where: {
        orgId: context.orgId,
        projectId,
      },
      orderBy: { createdAt: 'asc' },
    });

    return deps.map((d: {
      orgId: string;
      projectId: string;
      blockerTaskId: string;
      blockedTaskId: string;
      createdBy: string;
      createdAt: Date;
    }) => ({
      orgId: d.orgId,
      projectId: d.projectId,
      blockerTaskId: d.blockerTaskId,
      blockedTaskId: d.blockedTaskId,
      createdBy: d.createdBy,
      createdAt: d.createdAt.toISOString(),
    }));
  });
}
