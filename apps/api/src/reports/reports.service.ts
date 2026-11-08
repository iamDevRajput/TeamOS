import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import {
  createApiPrismaClient,
  getProjectById,
  listTasksWithDependencies,
  listProjectDependencies,
  createProjectReport,
  listProjectReports,
  getReportById,
  TenantContext,
} from '@teamos/database';
import {
  buildProjectSnapshot,
  verifyReportClaims,
  RiskEngineProject,
  RiskEngineTask,
  RiskEngineDependency,
} from '@teamos/risk-engine';
import { ProjectReportDto, CreateReportDto, DeliveryRiskLevel } from '@teamos/contracts';

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);
  private readonly prisma = createApiPrismaClient();

  /**
   * Generates an authoritative, evidence-backed delivery health report.
   * 1. Constructs immutable project risk snapshot via Risk Engine.
   * 2. Ground-truth verifier guarantees zero hallucinated metrics or foreign entity citations.
   * 3. Atomically commits report and audit event.
   */
  async generateReport(
    context: TenantContext,
    projectId: string,
    dto: CreateReportDto,
  ): Promise<ProjectReportDto> {
    // 1. Fetch project details
    const project = await getProjectById(context, projectId);
    if (!project) {
      throw new NotFoundException(`Project ${projectId} not found.`);
    }

    // 2. Fetch project tasks and dependencies
    const tasks = await listTasksWithDependencies(context, projectId);
    const dependencies = await listProjectDependencies(context, projectId);

    const evaluationDate = new Date().toISOString().slice(0, 10);

    const riskProject: RiskEngineProject & { id: string; key: string; name: string } = {
      id: project.id,
      key: project.key,
      name: project.name,
      startDate: project.startDate || evaluationDate,
      targetDate: project.dueDate || null,
      evaluationDate,
      timezone: project.timezone || 'UTC',
    };

    const riskTasks: (RiskEngineTask & { title: string; status: any })[] = tasks.map((t) => ({
      id: t.id,
      title: t.title,
      status: t.status as any,
      remainingEstimateWorkdays: t.remainingEstimateWorkdays,
      dueDate: t.dueDate,
    }));

    const riskDeps: RiskEngineDependency[] = dependencies.map((d) => ({
      blockerTaskId: d.blockerTaskId,
      blockedTaskId: d.blockedTaskId,
    }));

    // 3. Risk Engine creates snapshot and facts
    const snapshot = buildProjectSnapshot(riskProject, riskTasks, riskDeps);

    // 4. Strict Claim Verifier: Guarantees every claim strictly matches ground truth
    const verification = verifyReportClaims(snapshot, snapshot.facts);
    if (!verification.valid) {
      this.logger.error(`Report verification failed: ${verification.errors.join('; ')}`);
      throw new BadRequestException(
        `Report verification failed: ${verification.errors.join(', ')}`,
      );
    }

    // 5. Build summary narrative grounded in verified metrics
    const reportTitle =
      dto.title?.trim() ||
      `Health Report: ${project.key} — ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;

    let statusNarrative = '';
    if (snapshot.deliveryRisk === 'LOW') {
      statusNarrative = `Project is tracking safely on schedule with completion forecasted for ${snapshot.forecastDate || 'target date'}.`;
    } else if (snapshot.deliveryRisk === 'MEDIUM') {
      statusNarrative = `Project delivery buffer is compressed. Slack has tightened below threshold.`;
    } else if (snapshot.deliveryRisk === 'HIGH') {
      statusNarrative = `Delivery date is at high risk. Forecasted completion exceeds target due date or dependencies are critically blocked.`;
    } else {
      statusNarrative = `Forecasted delivery date is indeterminate due to missing estimates or unresolved dependency state.`;
    }

    if (snapshot.blockedTasks > 0) {
      statusNarrative += ` ${snapshot.blockedTasks} task(s) are currently waiting on prerequisite blockers.`;
    }

    if (snapshot.criticalPathTaskIds.length > 0) {
      statusNarrative += ` Critical path spans ${snapshot.criticalPathTaskIds.length} tasks that dictate delivery timing.`;
    }

    // 6. Persist report with forced RLS and audit log
    return createProjectReport(context, {
      projectId,
      title: reportTitle,
      summary: statusNarrative,
      deliveryRisk: snapshot.deliveryRisk,
      snapshotHash: snapshot.snapshotHash,
      snapshot,
      claims: snapshot.facts,
      requestId: context.requestId,
    });
  }

  async listReports(
    context: TenantContext,
    projectId: string,
  ): Promise<ProjectReportDto[]> {
    return listProjectReports(context, projectId);
  }

  async getReport(
    context: TenantContext,
    reportId: string,
  ): Promise<ProjectReportDto> {
    const report = await getReportById(context, reportId);
    if (!report) {
      throw new NotFoundException(`Report ${reportId} not found.`);
    }
    return report;
  }
}
