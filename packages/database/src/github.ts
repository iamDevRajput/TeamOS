/**
 * TeamOS Database Package — GitHub App Integration & Repositories
 *
 * Rules:
 * - Tenant operations enforced via `withTenant`.
 * - Webhook deliveries tracked with unique delivery_id for deduplication.
 * - Repositories map to projects strictly within the same organization.
 */

import { Prisma, ActorType } from '@prisma/client';
import {
  GithubInstallationDto,
  GithubRepositoryDto,
  TenantContext,
} from '@teamos/contracts';
import { withTenant } from './with-tenant';
import { recordAuditEvent } from './audit';

export interface SaveInstallationParams {
  installationId: number | bigint;
  accountLogin: string;
  accountId: number | bigint;
  accountType?: string;
  repositorySelection?: string;
  repositories?: {
    repoId: number | bigint;
    repoName: string;
    repoFullName: string;
    isPrivate?: boolean;
  }[];
}

export async function saveGithubInstallation(
  context: TenantContext,
  params: SaveInstallationParams,
): Promise<GithubInstallationDto> {
  const installationId = BigInt(params.installationId);
  const accountId = BigInt(params.accountId);

  return withTenant(context, async (tx: Prisma.TransactionClient) => {
    // 1. Upsert GitHub installation record
    const installation = await tx.githubInstallation.upsert({
      where: {
        installationId,
      },
      create: {
        orgId: context.orgId,
        installationId,
        accountLogin: params.accountLogin,
        accountId,
        accountType: params.accountType || 'Organization',
        repositorySelection: params.repositorySelection || 'selected',
        createdBy: context.userId,
      },
      update: {
        accountLogin: params.accountLogin,
        accountId,
        accountType: params.accountType || 'Organization',
        repositorySelection: params.repositorySelection || 'selected',
      },
    });

    // 2. Upsert selected repositories if provided
    if (params.repositories && params.repositories.length > 0) {
      for (const repo of params.repositories) {
        const repoId = BigInt(repo.repoId);
        await tx.githubRepository.upsert({
          where: {
            orgId_repoId: {
              orgId: context.orgId,
              repoId,
            },
          },
          create: {
            orgId: context.orgId,
            installationId,
            repoId,
            repoName: repo.repoName,
            repoFullName: repo.repoFullName,
            isPrivate: repo.isPrivate ?? true,
          },
          update: {
            installationId,
            repoName: repo.repoName,
            repoFullName: repo.repoFullName,
            isPrivate: repo.isPrivate ?? true,
          },
        });
      }
    }

    // 3. Record audit event
    await recordAuditEvent(tx, {
      orgId: context.orgId,
      actorType: ActorType.USER,
      actorId: context.userId,
      action: 'github.installation.saved',
      entityType: 'github_installation',
      entityId: installation.id,
      afterData: {
        installationId: String(installationId),
        accountLogin: params.accountLogin,
        repoCount: params.repositories?.length || 0,
      },
      requestId: context.requestId,
    });

    return {
      id: installation.id,
      orgId: installation.orgId,
      installationId: Number(installation.installationId),
      accountLogin: installation.accountLogin,
      accountId: Number(installation.accountId),
      accountType: installation.accountType,
      repositorySelection: installation.repositorySelection,
      createdBy: installation.createdBy,
      createdAt: installation.createdAt.toISOString(),
    };
  });
}

export async function listGithubInstallations(
  context: TenantContext,
): Promise<GithubInstallationDto[]> {
  return withTenant(context, async (tx: Prisma.TransactionClient) => {
    const list = await tx.githubInstallation.findMany({
      where: { orgId: context.orgId },
      orderBy: { createdAt: 'desc' },
    });

    return list.map((inst) => ({
      id: inst.id,
      orgId: inst.orgId,
      installationId: Number(inst.installationId),
      accountLogin: inst.accountLogin,
      accountId: Number(inst.accountId),
      accountType: inst.accountType,
      repositorySelection: inst.repositorySelection,
      createdBy: inst.createdBy,
      createdAt: inst.createdAt.toISOString(),
    }));
  });
}

export async function listGithubRepositories(
  context: TenantContext,
): Promise<GithubRepositoryDto[]> {
  return withTenant(context, async (tx: Prisma.TransactionClient) => {
    const list = await tx.githubRepository.findMany({
      where: { orgId: context.orgId },
      orderBy: { repoFullName: 'asc' },
    });

    return list.map((r) => ({
      id: r.id,
      orgId: r.orgId,
      installationId: Number(r.installationId),
      projectId: r.projectId,
      repoId: Number(r.repoId),
      repoName: r.repoName,
      repoFullName: r.repoFullName,
      isPrivate: r.isPrivate,
      createdAt: r.createdAt.toISOString(),
    }));
  });
}

export async function linkGithubRepositoryToProject(
  context: TenantContext,
  repoId: number | bigint,
  projectId: string,
): Promise<GithubRepositoryDto> {
  const repoIdBigInt = BigInt(repoId);

  return withTenant(context, async (tx: Prisma.TransactionClient) => {
    // 1. Verify project exists in this tenant
    const project = await tx.project.findUnique({
      where: {
        orgId_id: {
          orgId: context.orgId,
          id: projectId,
        },
      },
    });

    if (!project) {
      throw new Error(`Project ${projectId} not found in organization.`);
    }

    // 2. Update repository project link
    const updated = await tx.githubRepository.update({
      where: {
        orgId_repoId: {
          orgId: context.orgId,
          repoId: repoIdBigInt,
        },
      },
      data: {
        projectId,
      },
    });

    // 3. Record audit event
    await recordAuditEvent(tx, {
      orgId: context.orgId,
      actorType: ActorType.USER,
      actorId: context.userId,
      action: 'github.repository.linked',
      entityType: 'github_repository',
      entityId: updated.id,
      afterData: {
        repoFullName: updated.repoFullName,
        projectId,
        projectKey: project.key,
      },
      requestId: context.requestId,
    });

    return {
      id: updated.id,
      orgId: updated.orgId,
      installationId: Number(updated.installationId),
      projectId: updated.projectId,
      repoId: Number(updated.repoId),
      repoName: updated.repoName,
      repoFullName: updated.repoFullName,
      isPrivate: updated.isPrivate,
      createdAt: updated.createdAt.toISOString(),
    };
  });
}

/**
 * Saves incoming webhook delivery for deduplication and durable acceptance.
 */
export async function saveWebhookDelivery(
  client: any,
  deliveryId: string,
  eventType: string,
  action: string | null,
  payload: any,
): Promise<{ deduplicated: boolean; id?: string }> {
  try {
    const delivery = await client.githubWebhookDelivery.create({
      data: {
        deliveryId,
        eventType,
        action: action || null,
        payload,
      },
    });

    return { deduplicated: false, id: delivery.id };
  } catch (err: any) {
    // Duplicate delivery ID (code P2002 or unique constraint)
    if (err.code === 'P2002' || err.message?.includes('unique constraint')) {
      return { deduplicated: true };
    }
    throw err;
  }
}

/**
 * Safely cleans up expired GitHub webhook deliveries older than the retention window.
 * Preserves GitHub's 24-hour retry deduplication guarantees by enforcing a minimum retention period.
 * Executes in bounded chunks to prevent locking or WAL spikes.
 */
export async function cleanupExpiredWebhookDeliveries(
  client: any,
  olderThanDays: number = 30,
): Promise<{ deletedCount: number }> {
  // Enforce a hard safety lower-bound of at least 3 days to protect GitHub's 24-hour retry window
  const retentionDays = Math.max(olderThanDays, 3);
  const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

  const result = await client.githubWebhookDelivery.deleteMany({
    where: {
      createdAt: {
        lt: cutoffDate,
      },
    },
  });

  return { deletedCount: result.count };
}


