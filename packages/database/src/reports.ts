/**
 * TeamOS Database Package — Project Health Reports
 *
 * Rules:
 * - All queries must be executed within `withTenant` context to enforce PostgreSQL RLS.
 * - Every report creation must atomically record an audit event.
 * - Report claims and snapshots are immutable once generated.
 */

import { Prisma, ActorType } from '@prisma/client';
import { ProjectReportDto, ReportSnapshotDto, ReportFactDto, DeliveryRiskLevel } from '@teamos/contracts';
import { withTenant, TenantContext } from './with-tenant';
import { recordAuditEvent } from './audit';

export interface CreateReportParams {
  projectId: string;
  title: string;
  summary: string;
  deliveryRisk: DeliveryRiskLevel;
  snapshotHash: string;
  snapshot: ReportSnapshotDto;
  claims: ReportFactDto[];
  requestId?: string;
}

export async function createProjectReport(
  context: TenantContext,
  params: CreateReportParams,
): Promise<ProjectReportDto> {
  return withTenant(context, async (tx: Prisma.TransactionClient) => {
    // 1. Verify project exists in this tenant
    const project = await tx.project.findUnique({
      where: {
        orgId_id: {
          orgId: context.orgId,
          id: params.projectId,
        },
      },
      select: { id: true, key: true, name: true },
    });

    if (!project) {
      throw new Error(`Project ${params.projectId} not found in organization ${context.orgId}`);
    }

    // 2. Create the immutable project report
    const report = await tx.projectReport.create({
      data: {
        orgId: context.orgId,
        projectId: params.projectId,
        title: params.title,
        summary: params.summary,
        deliveryRisk: params.deliveryRisk,
        snapshotHash: params.snapshotHash,
        snapshot: params.snapshot as unknown as Prisma.InputJsonValue,
        claims: params.claims as unknown as Prisma.InputJsonValue,
        createdBy: context.userId,
      },
      include: {
        creator: {
          select: {
            login: true,
          },
        },
      },
    });

    // 3. Atomically record audit event
    await recordAuditEvent(tx, {
      orgId: context.orgId,
      actorType: ActorType.USER,
      actorId: context.userId,
      action: 'report.created',
      entityType: 'project_report',
      entityId: report.id,
      afterData: {
        reportId: report.id,
        projectId: params.projectId,
        title: params.title,
        deliveryRisk: params.deliveryRisk,
        snapshotHash: params.snapshotHash,
        verifiedClaimsCount: params.claims.length,
      },
      requestId: context.requestId,
    });

    return {
      id: report.id,
      orgId: report.orgId,
      projectId: report.projectId,
      title: report.title,
      summary: report.summary,
      deliveryRisk: report.deliveryRisk as DeliveryRiskLevel,
      snapshotHash: report.snapshotHash,
      snapshot: report.snapshot as unknown as ReportSnapshotDto,
      claims: report.claims as unknown as ReportFactDto[],
      createdBy: report.createdBy,
      creatorLogin: report.creator.login,
      createdAt: report.createdAt.toISOString(),
    };
  });
}

export async function listProjectReports(
  context: TenantContext,
  projectId: string,
): Promise<ProjectReportDto[]> {
  return withTenant(context, async (tx: Prisma.TransactionClient) => {
    const reports = await tx.projectReport.findMany({
      where: {
        orgId: context.orgId,
        projectId,
      },
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        creator: {
          select: {
            login: true,
          },
        },
      },
    });

    return reports.map((r) => ({
      id: r.id,
      orgId: r.orgId,
      projectId: r.projectId,
      title: r.title,
      summary: r.summary,
      deliveryRisk: r.deliveryRisk as DeliveryRiskLevel,
      snapshotHash: r.snapshotHash,
      snapshot: r.snapshot as unknown as ReportSnapshotDto,
      claims: r.claims as unknown as ReportFactDto[],
      createdBy: r.createdBy,
      creatorLogin: r.creator.login,
      createdAt: r.createdAt.toISOString(),
    }));
  });
}

export async function getReportById(
  context: TenantContext,
  reportId: string,
): Promise<ProjectReportDto | null> {
  return withTenant(context, async (tx: Prisma.TransactionClient) => {
    const report = await tx.projectReport.findUnique({
      where: {
        orgId_id: {
          orgId: context.orgId,
          id: reportId,
        },
      },
      include: {
        creator: {
          select: {
            login: true,
          },
        },
      },
    });

    if (!report) return null;

    return {
      id: report.id,
      orgId: report.orgId,
      projectId: report.projectId,
      title: report.title,
      summary: report.summary,
      deliveryRisk: report.deliveryRisk as DeliveryRiskLevel,
      snapshotHash: report.snapshotHash,
      snapshot: report.snapshot as unknown as ReportSnapshotDto,
      claims: report.claims as unknown as ReportFactDto[],
      createdBy: report.createdBy,
      creatorLogin: report.creator.login,
      createdAt: report.createdAt.toISOString(),
    };
  });
}
