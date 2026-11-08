import { Prisma, ActorType } from '@prisma/client';
import {
  TenantContext,
  ProposalDto,
  CreateProposalDto,
  ProposalPayload,
  ProposalState,
  ProposalKind,
  ApproveProposalResponseDto,
  TaskStatus,
} from '@teamos/contracts';
import { validateAndSortGraph } from '@teamos/risk-engine';
import { withTenant } from './with-tenant';
import { recordAuditEvent } from './audit';

/**
 * Creates a new change proposal for a project.
 */
export async function createProposal(
  context: TenantContext,
  projectId: string,
  dto: CreateProposalDto,
): Promise<ProposalDto> {
  return withTenant(context, async (tx: Prisma.TransactionClient) => {
    const project = await tx.project.findFirst({
      where: { id: projectId, orgId: context.orgId },
    });

    if (!project) {
      throw new Error('Project not found in this organization.');
    }

    const created = await tx.proposal.create({
      data: {
        orgId: context.orgId,
        projectId,
        title: dto.title.trim(),
        description: dto.description?.trim() || null,
        kind: (dto.kind as any) || 'PLAN',
        state: 'PENDING',
        payload: dto.payload as any,
        createdBy: context.userId,
      },
      include: {
        creator: {
          select: { login: true },
        },
      },
    });

    await recordAuditEvent(tx, {
      orgId: context.orgId,
      actorType: ActorType.USER,
      actorId: context.userId,
      action: 'PROPOSAL_CREATED',
      entityType: 'PROPOSAL',
      entityId: created.id,
      afterData: {
        projectId,
        title: created.title,
        kind: created.kind,
      },
      requestId: context.requestId,
    });

    return {
      id: created.id,
      orgId: created.orgId,
      projectId: created.projectId,
      kind: created.kind as ProposalKind,
      state: created.state as ProposalState,
      title: created.title,
      description: created.description || undefined,
      payload: created.payload as unknown as ProposalPayload,
      createdBy: created.createdBy,
      creatorLogin: created.creator.login,
      createdAt: created.createdAt.toISOString(),
    };
  });
}

/**
 * Lists proposals for a project, optionally filtered by state.
 */
export async function listProjectProposals(
  context: TenantContext,
  projectId: string,
  state?: ProposalState,
): Promise<ProposalDto[]> {
  return withTenant(context, async (tx: Prisma.TransactionClient) => {
    const proposals = await tx.proposal.findMany({
      where: {
        orgId: context.orgId,
        projectId,
        ...(state ? { state: state as any } : {}),
      },
      include: {
        creator: { select: { login: true } },
        reviewer: { select: { login: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return proposals.map((p) => ({
      id: p.id,
      orgId: p.orgId,
      projectId: p.projectId,
      kind: p.kind as ProposalKind,
      state: p.state as ProposalState,
      title: p.title,
      description: p.description || undefined,
      payload: p.payload as unknown as ProposalPayload,
      rejectionReason: p.rejectionReason || undefined,
      createdBy: p.createdBy,
      creatorLogin: p.creator.login,
      reviewedBy: p.reviewedBy || undefined,
      reviewerLogin: p.reviewer?.login || undefined,
      createdAt: p.createdAt.toISOString(),
      reviewedAt: p.reviewedAt ? p.reviewedAt.toISOString() : undefined,
    }));
  });
}

/**
 * Retrieves a single proposal by ID.
 */
export async function getProposalById(
  context: TenantContext,
  proposalId: string,
): Promise<ProposalDto | null> {
  return withTenant(context, async (tx: Prisma.TransactionClient) => {
    const p = await tx.proposal.findFirst({
      where: {
        id: proposalId,
        orgId: context.orgId,
      },
      include: {
        creator: { select: { login: true } },
        reviewer: { select: { login: true } },
      },
    });

    if (!p) return null;

    return {
      id: p.id,
      orgId: p.orgId,
      projectId: p.projectId,
      kind: p.kind as ProposalKind,
      state: p.state as ProposalState,
      title: p.title,
      description: p.description || undefined,
      payload: p.payload as unknown as ProposalPayload,
      rejectionReason: p.rejectionReason || undefined,
      createdBy: p.createdBy,
      creatorLogin: p.creator.login,
      reviewedBy: p.reviewedBy || undefined,
      reviewerLogin: p.reviewer?.login || undefined,
      createdAt: p.createdAt.toISOString(),
      reviewedAt: p.reviewedAt ? p.reviewedAt.toISOString() : undefined,
    };
  });
}

/**
 * Rejects a proposal. Only OWNER or ADMIN may reject proposals.
 */
export async function rejectProposal(
  context: TenantContext,
  proposalId: string,
  reason?: string,
): Promise<ProposalDto> {
  if (context.role !== 'OWNER' && context.role !== 'ADMIN') {
    throw new Error('ERR_UNAUTHORIZED_PROPOSAL_REVIEW');
  }

  return withTenant(context, async (tx: Prisma.TransactionClient) => {
    const existing = await tx.proposal.findFirst({
      where: { id: proposalId, orgId: context.orgId },
      include: {
        creator: { select: { login: true } },
        reviewer: { select: { login: true } },
      },
    });

    if (!existing) {
      throw new Error('ERR_PROPOSAL_NOT_FOUND');
    }

    if (existing.state !== 'PENDING') {
      throw new Error('ERR_PROPOSAL_NOT_PENDING');
    }

    const updated = await tx.proposal.update({
      where: { id: proposalId },
      data: {
        state: 'REJECTED',
        rejectionReason: reason?.trim() || null,
        reviewedBy: context.userId,
        reviewedAt: new Date(),
      },
      include: {
        creator: { select: { login: true } },
        reviewer: { select: { login: true } },
      },
    });

    await recordAuditEvent(tx, {
      orgId: context.orgId,
      actorType: ActorType.USER,
      actorId: context.userId,
      action: 'PROPOSAL_REJECTED',
      entityType: 'PROPOSAL',
      entityId: proposalId,
      afterData: {
        rejectionReason: updated.rejectionReason,
      },
      requestId: context.requestId,
    });

    return {
      id: updated.id,
      orgId: updated.orgId,
      projectId: updated.projectId,
      kind: updated.kind as ProposalKind,
      state: updated.state as ProposalState,
      title: updated.title,
      description: updated.description || undefined,
      payload: updated.payload as unknown as ProposalPayload,
      rejectionReason: updated.rejectionReason || undefined,
      createdBy: updated.createdBy,
      creatorLogin: updated.creator.login,
      reviewedBy: updated.reviewedBy || undefined,
      reviewerLogin: updated.reviewer?.login || undefined,
      createdAt: updated.createdAt.toISOString(),
      reviewedAt: updated.reviewedAt ? updated.reviewedAt.toISOString() : undefined,
    };
  });
}

/**
 * Atomically approves and applies a proposed plan or status change.
 * Re-validates optimistic versions, DAG acyclicity, and approver permissions in a single transaction.
 */
export async function approveProposal(
  context: TenantContext,
  proposalId: string,
): Promise<ApproveProposalResponseDto> {
  if (context.role !== 'OWNER' && context.role !== 'ADMIN') {
    throw new Error('ERR_UNAUTHORIZED_PROPOSAL_REVIEW');
  }

  return withTenant(context, async (tx: Prisma.TransactionClient) => {
    // 1. Lock and fetch proposal
    const proposalRows = await tx.$queryRaw<Array<{ id: string; org_id: string; project_id: string; state: string; payload: any }>>`
      SELECT id, org_id, project_id, state, payload 
      FROM public.proposals 
      WHERE org_id = ${context.orgId}::uuid AND id = ${proposalId}::uuid 
      FOR UPDATE
    `;

    if (proposalRows.length === 0) {
      throw new Error('ERR_PROPOSAL_NOT_FOUND');
    }

    const proposal = proposalRows[0];
    if (proposal.state !== 'PENDING') {
      throw new Error('ERR_PROPOSAL_NOT_PENDING');
    }

    const projectId = proposal.project_id;
    const payload = proposal.payload as ProposalPayload;

    // 2. Lock project row to serialize changes
    const projectRows = await tx.$queryRaw<Array<{ id: string; next_task_number: number }>>`
      SELECT id, next_task_number 
      FROM public.projects 
      WHERE org_id = ${context.orgId}::uuid AND id = ${projectId}::uuid 
      FOR UPDATE
    `;

    if (projectRows.length === 0) {
      throw new Error('ERR_PROJECT_NOT_FOUND');
    }

    let nextNumber = projectRows[0].next_task_number;

    // 3. Re-validate optimistic concurrency versions of tasks to update or delete
    if (payload.tasksToUpdate && payload.tasksToUpdate.length > 0) {
      const taskIds = payload.tasksToUpdate.map((u) => u.taskId);
      const existingTasks = await tx.task.findMany({
        where: { id: { in: taskIds }, orgId: context.orgId, projectId },
        select: { id: true, version: true },
      });

      const versionMap = new Map(existingTasks.map((t) => [t.id, t.version]));
      for (const update of payload.tasksToUpdate) {
        const currentVersion = versionMap.get(update.taskId);
        if (currentVersion === undefined || currentVersion !== update.expectedVersion) {
          throw new Error('ERR_CONCURRENT_UPDATE');
        }
      }
    }

    if (payload.tasksToDelete && payload.tasksToDelete.length > 0) {
      const taskIds = payload.tasksToDelete.map((d) => d.taskId);
      const existingTasks = await tx.task.findMany({
        where: { id: { in: taskIds }, orgId: context.orgId, projectId },
        select: { id: true, version: true },
      });

      const versionMap = new Map(existingTasks.map((t) => [t.id, t.version]));
      for (const del of payload.tasksToDelete) {
        const currentVersion = versionMap.get(del.taskId);
        if (currentVersion === undefined || currentVersion !== del.expectedVersion) {
          throw new Error('ERR_CONCURRENT_UPDATE');
        }
      }
    }

    // 4. DAG cycle validation of the planned resulting graph
    const allCurrentTasks = await tx.task.findMany({
      where: { orgId: context.orgId, projectId },
      select: { id: true },
    });
    const allCurrentDeps = await tx.taskDependency.findMany({
      where: { orgId: context.orgId, projectId },
      select: { blockerTaskId: true, blockedTaskId: true },
    });

    const deletedTaskIds = new Set(payload.tasksToDelete?.map((d) => d.taskId) || []);
    const tempIdMap = new Map<string, string>(); // tempId -> actual task UUID

    // Pre-allocate UUIDs for new tasks so DAG check can validate them
    const tasksToCreate = payload.tasksToCreate || [];
    for (const ct of tasksToCreate) {
      const preUuidRows = await tx.$queryRaw<Array<{ id: string }>>`SELECT gen_random_uuid() AS id`;
      tempIdMap.set(ct.tempId, preUuidRows[0].id);
    }

    const projectedTaskIds = [
      ...allCurrentTasks.filter((t) => !deletedTaskIds.has(t.id)).map((t) => t.id),
      ...Array.from(tempIdMap.values()),
    ];

    const resolveId = (id: string) => tempIdMap.get(id) || id;

    // Projected dependencies
    const removedDepSet = new Set(
      (payload.dependenciesToRemove || []).map(
        (r) => `${r.blockerTaskId}->${r.dependentTaskId}`,
      ),
    );

    const projectedDeps = [
      ...allCurrentDeps
        .filter(
          (d) =>
            !deletedTaskIds.has(d.blockerTaskId) &&
            !deletedTaskIds.has(d.blockedTaskId) &&
            !removedDepSet.has(`${d.blockerTaskId}->${d.blockedTaskId}`),
        )
        .map((d) => ({
          blockerTaskId: d.blockerTaskId,
          blockedTaskId: d.blockedTaskId,
        })),
      ...(payload.dependenciesToAdd || []).map((a) => ({
        blockerTaskId: resolveId(a.blockerId),
        blockedTaskId: resolveId(a.dependentId),
      })),
    ];

    const dagValidation = validateAndSortGraph(projectedTaskIds, projectedDeps);
    if (dagValidation.hasCycle) {
      throw new Error('ERR_DEPENDENCY_CYCLE');
    }

    // 5. Execute Mutations Atomically

    // A. Create new tasks
    let createdCount = 0;
    for (const ct of tasksToCreate) {
      const assignedId = tempIdMap.get(ct.tempId)!;
      const taskNum = nextNumber++;
      await tx.task.create({
        data: {
          id: assignedId,
          orgId: context.orgId,
          projectId,
          number: taskNum,
          title: ct.title.trim(),
          description: ct.description?.trim() || null,
          status: (ct.status as TaskStatus) || TaskStatus.TODO,
          remainingEstimateWorkdays:
            ct.remainingEstimateWorkdays !== undefined
              ? Math.round(ct.remainingEstimateWorkdays)
              : null,
          dueDate: ct.dueDate ? new Date(ct.dueDate) : null,
          version: 1,
          createdBy: context.userId,
        },
      });
      createdCount++;
    }

    // Update project next_task_number
    await tx.project.update({
      where: { id: projectId },
      data: { nextTaskNumber: nextNumber },
    });

    // B. Update tasks
    let updatedCount = 0;
    for (const ut of payload.tasksToUpdate || []) {
      await tx.task.update({
        where: { id: ut.taskId },
        data: {
          ...(ut.title !== undefined ? { title: ut.title.trim() } : {}),
          ...(ut.description !== undefined ? { description: ut.description.trim() } : {}),
          ...(ut.status !== undefined ? { status: ut.status as TaskStatus } : {}),
          ...(ut.remainingEstimateWorkdays !== undefined
            ? { remainingEstimateWorkdays: ut.remainingEstimateWorkdays }
            : {}),
          ...(ut.dueDate !== undefined
            ? { dueDate: ut.dueDate ? new Date(ut.dueDate) : null }
            : {}),
          version: { increment: 1 },
        },
      });
      updatedCount++;
    }

    // C. Delete tasks
    let deletedCount = 0;
    for (const dt of payload.tasksToDelete || []) {
      await tx.task.delete({
        where: { id: dt.taskId },
      });
      deletedCount++;
    }

    // D. Remove dependencies
    let removedDepCount = 0;
    for (const rd of payload.dependenciesToRemove || []) {
      await tx.taskDependency.deleteMany({
        where: {
          orgId: context.orgId,
          projectId,
          blockerTaskId: rd.blockerTaskId,
          blockedTaskId: rd.dependentTaskId,
        },
      });
      removedDepCount++;
    }

    // E. Add dependencies
    let addedDepCount = 0;
    for (const ad of payload.dependenciesToAdd || []) {
      const blockerId = resolveId(ad.blockerId);
      const dependentId = resolveId(ad.dependentId);

      await tx.taskDependency.create({
        data: {
          orgId: context.orgId,
          projectId,
          blockerTaskId: blockerId,
          blockedTaskId: dependentId,
          createdBy: context.userId,
        },
      });
      addedDepCount++;
    }

    // 6. Update proposal state
    await tx.proposal.update({
      where: { id: proposalId },
      data: {
        state: 'APPROVED',
        reviewedBy: context.userId,
        reviewedAt: new Date(),
      },
    });

    // 7. Audit Log
    await recordAuditEvent(tx, {
      orgId: context.orgId,
      actorType: ActorType.USER,
      actorId: context.userId,
      action: 'PROPOSAL_APPROVED',
      entityType: 'PROPOSAL',
      entityId: proposalId,
      afterData: {
        projectId,
        createdCount,
        updatedCount,
        deletedCount,
        addedDepCount,
        removedDepCount,
      },
      requestId: context.requestId,
    });

    return {
      success: true,
      proposalId,
      state: 'APPROVED',
      createdTaskCount: createdCount,
      updatedTaskCount: updatedCount,
      deletedTaskCount: deletedCount,
      addedDependencyCount: addedDepCount,
      removedDependencyCount: removedDepCount,
    };
  });
}

