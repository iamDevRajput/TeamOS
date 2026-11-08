import { Prisma, Project, ActorType } from '@prisma/client';
import { withTenant, TenantContext } from './with-tenant';
import { recordAuditEvent } from './audit';
import { CreateProjectDto, UpdateProjectDto, ProjectDto } from '@teamos/contracts';

const PROJECT_KEY_REGEX = /^[A-Z0-9]{2,8}$/;

/**
 * Creates a new project in the active tenant organization.
 */
export async function createProject(
  context: TenantContext,
  dto: CreateProjectDto,
): Promise<Project> {
  const normalizedKey = dto.key.trim().toUpperCase();
  if (!PROJECT_KEY_REGEX.test(normalizedKey)) {
    throw new Error('Project key must be 2-8 uppercase alphanumeric characters (e.g. CORE, ALPHA, WEB).');
  }

  return withTenant(context, async (tx) => {
    // Check if key already exists in org
    const existing = await tx.project.findFirst({
      where: {
        orgId: context.orgId,
        key: normalizedKey,
      },
    });

    if (existing) {
      throw new Error(`Project key "${normalizedKey}" is already in use in this organization.`);
    }

    const project = await tx.project.create({
      data: {
        orgId: context.orgId,
        key: normalizedKey,
        name: dto.name.trim(),
        startDate: dto.startDate ? new Date(dto.startDate) : null,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
        timezone: dto.timezone || 'UTC',
        createdBy: context.userId,
      },
    });

    await recordAuditEvent(tx, {
      orgId: context.orgId,
      actorType: ActorType.USER,
      actorId: context.userId,
      action: 'PROJECT_CREATED',
      entityType: 'PROJECT',
      entityId: project.id,
      afterData: {
        key: project.key,
        name: project.name,
        dueDate: project.dueDate?.toISOString() || null,
      },
      requestId: context.requestId,
    });

    return project;
  });
}

/**
 * Lists projects for an organization.
 */
export async function listProjects(
  context: TenantContext,
): Promise<ProjectDto[]> {
  return withTenant(context, async (tx) => {
    const projects = await tx.project.findMany({
      where: {
        orgId: context.orgId,
      },
      include: {
        _count: {
          select: { tasks: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return projects.map((p) => ({
      id: p.id,
      orgId: p.orgId,
      key: p.key,
      name: p.name,
      startDate: p.startDate ? p.startDate.toISOString().slice(0, 10) : null,
      dueDate: p.dueDate ? p.dueDate.toISOString().slice(0, 10) : null,
      timezone: p.timezone,
      nextTaskNumber: p.nextTaskNumber,
      taskCount: p._count.tasks,
      createdAt: p.createdAt.toISOString(),
    }));
  });
}

/**
 * Retrieves a single project by ID within the current tenant organization.
 */
export async function getProjectById(
  context: TenantContext,
  projectId: string,
): Promise<ProjectDto | null> {
  return withTenant(context, async (tx) => {
    const p = await tx.project.findFirst({
      where: {
        id: projectId,
        orgId: context.orgId,
      },
      include: {
        _count: {
          select: { tasks: true },
        },
      },
    });

    if (!p) return null;

    return {
      id: p.id,
      orgId: p.orgId,
      key: p.key,
      name: p.name,
      startDate: p.startDate ? p.startDate.toISOString().slice(0, 10) : null,
      dueDate: p.dueDate ? p.dueDate.toISOString().slice(0, 10) : null,
      timezone: p.timezone,
      nextTaskNumber: p.nextTaskNumber,
      taskCount: p._count.tasks,
      createdAt: p.createdAt.toISOString(),
    };
  });
}

/**
 * Updates a project's details within the current tenant organization.
 */
export async function updateProject(
  context: TenantContext,
  projectId: string,
  dto: UpdateProjectDto,
): Promise<Project> {
  return withTenant(context, async (tx) => {
    const existing = await tx.project.findFirst({
      where: { id: projectId, orgId: context.orgId },
    });

    if (!existing) {
      throw new Error('Project not found.');
    }

    const data: Prisma.ProjectUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.dueDate !== undefined) {
      data.dueDate = dto.dueDate ? new Date(dto.dueDate) : null;
    }
    if (dto.startDate !== undefined) {
      data.startDate = dto.startDate ? new Date(dto.startDate) : null;
    }
    if (dto.timezone !== undefined) {
      data.timezone = dto.timezone;
    }

    const updated = await tx.project.update({
      where: { id: projectId },
      data,
    });

    await recordAuditEvent(tx, {
      orgId: context.orgId,
      actorType: ActorType.USER,
      actorId: context.userId,
      action: 'PROJECT_UPDATED',
      entityType: 'PROJECT',
      entityId: projectId,
      beforeData: {
        name: existing.name,
        dueDate: existing.dueDate?.toISOString() || null,
      },
      afterData: {
        name: updated.name,
        dueDate: updated.dueDate?.toISOString() || null,
      },
      requestId: context.requestId,
    });

    return updated;
  });
}
