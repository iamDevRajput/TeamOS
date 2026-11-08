import { Injectable, NotFoundException } from '@nestjs/common';
import {
  TenantContext,
  ProjectRiskReportDto,
  WhatIfScenarioInputDto,
  WhatIfScenarioResultDto,
  TaskRiskDto,
} from '@teamos/contracts';
import {
  withTenant,
  listTasks,
  listProjectDependencies,
  getProjectById,
} from '@teamos/database';
import {
  calculateProjectRisk,
  simulateWhatIf,
  RiskEngineProject,
  RiskEngineTask,
  RiskEngineDependency,
  WhatIfScenario,
  workdaysDifference,
  parseIsoDate,
} from '@teamos/risk-engine';

@Injectable()
export class RiskService {
  async getProjectRisk(
    context: TenantContext,
    projectId: string,
  ): Promise<ProjectRiskReportDto> {
    const project = await getProjectById(context, projectId);
    if (!project) {
      throw new NotFoundException('Project not found in this organization.');
    }

    const tasks = await listTasks(context, projectId);
    const dependencies = await listProjectDependencies(context, projectId);

    const todayIso = new Date().toISOString().slice(0, 10);
    const startDateIso = project.startDate || todayIso;

    const engineProject: RiskEngineProject = {
      id: project.id,
      startDate: startDateIso,
      targetDate: project.dueDate || null,
      evaluationDate: todayIso,
      timezone: project.timezone || 'UTC',
    };

    const engineTasks: RiskEngineTask[] = tasks.map((t) => ({
      id: t.id,
      title: t.title,
      status: t.status as any,
      remainingEstimateWorkdays:
        t.remainingEstimateWorkdays !== undefined ? t.remainingEstimateWorkdays : null,
      dueDate: t.dueDate || null,
    }));

    const engineDeps: RiskEngineDependency[] = dependencies.map((d) => ({
      blockerTaskId: d.blockerTaskId,
      blockedTaskId: d.blockedTaskId,
    }));

    const result = calculateProjectRisk(engineProject, engineTasks, engineDeps);

    // Calculate delivery variance (days late vs target date)
    let deliveryVarianceWorkdays: number | null = null;
    let isDelayed = false;
    if (result.projectForecastFinish && result.projectTargetDate) {
      const forecastEpoch = parseIsoDate(result.projectForecastFinish);
      const targetEpoch = parseIsoDate(result.projectTargetDate);
      deliveryVarianceWorkdays = workdaysDifference(targetEpoch, forecastEpoch);
      isDelayed = deliveryVarianceWorkdays > 0;
    }

    const mappedTasks: TaskRiskDto[] = tasks.map((t) => {
      const schedule = result.schedules[t.id];
      return {
        taskId: t.id,
        taskNumber: t.number,
        taskTitle: t.title,
        status: t.status,
        remainingEstimateWorkdays: t.remainingEstimateWorkdays || 0,
        earliestStartWorkday: 0,
        earliestFinishWorkday: 0,
        latestStartWorkday: 0,
        latestFinishWorkday: 0,
        slackWorkdays: schedule?.slackWorkdays ?? 0,
        isCritical: schedule?.isCritical ?? false,
        isBlocked: schedule?.isBlocked ?? false,
        forecastFinishDate: schedule?.earlyFinish ?? null,
      };
    });

    return {
      projectId: project.id,
      projectKey: project.key,
      projectName: project.name,
      calculatedAt: new Date().toISOString(),
      isAcyclic: result.isAcyclic,
      cycleNodes: result.cycleNodes,
      criticalPathTaskIds: result.criticalTaskIds,
      maxDurationWorkdays: result.criticalPaths[0]?.totalWorkdays ?? 0,
      forecastDeliveryDate: result.projectForecastFinish,
      targetDeliveryDate: result.projectTargetDate,
      deliveryVarianceWorkdays,
      isDelayed,
      tasks: mappedTasks,
    };
  }

  async simulateWhatIf(
    context: TenantContext,
    projectId: string,
    scenarioDto: WhatIfScenarioInputDto,
  ): Promise<WhatIfScenarioResultDto> {
    const project = await getProjectById(context, projectId);
    if (!project) {
      throw new NotFoundException('Project not found in this organization.');
    }

    const tasks = await listTasks(context, projectId);
    const dependencies = await listProjectDependencies(context, projectId);

    const todayIso = new Date().toISOString().slice(0, 10);
    const startDateIso = project.startDate || todayIso;

    const engineProject: RiskEngineProject = {
      id: project.id,
      startDate: startDateIso,
      targetDate: project.dueDate || null,
      evaluationDate: todayIso,
      timezone: project.timezone || 'UTC',
    };

    const engineTasks: RiskEngineTask[] = tasks.map((t) => ({
      id: t.id,
      title: t.title,
      status: t.status as any,
      remainingEstimateWorkdays:
        t.remainingEstimateWorkdays !== undefined ? t.remainingEstimateWorkdays : null,
      dueDate: t.dueDate || null,
    }));

    const engineDeps: RiskEngineDependency[] = dependencies.map((d) => ({
      blockerTaskId: d.blockerTaskId,
      blockedTaskId: d.blockedTaskId,
    }));

    const scenario: WhatIfScenario = {
      modifyTasks: scenarioDto.estimateOverrides?.map((o) => ({
        id: o.taskId,
        remainingEstimateWorkdays: o.remainingEstimateWorkdays,
      })),
      addDependencies: scenarioDto.addedDependencies?.map((a) => ({
        blockerTaskId: a.blockerTaskId,
        blockedTaskId: a.blockedTaskId,
      })),
      removeDependencies: scenarioDto.removedDependencies?.map((r) => ({
        blockerTaskId: r.blockerTaskId,
        blockedTaskId: r.blockedTaskId,
      })),
    };

    // In-memory simulation with zero database writes
    const simResult = simulateWhatIf(engineProject, engineTasks, engineDeps, scenario);

    const mappedTasks: TaskRiskDto[] = tasks.map((t) => {
      const schedule = simResult.simulatedResult.schedules[t.id];
      return {
        taskId: t.id,
        taskNumber: t.number,
        taskTitle: t.title,
        status: t.status,
        remainingEstimateWorkdays: t.remainingEstimateWorkdays || 0,
        earliestStartWorkday: 0,
        earliestFinishWorkday: 0,
        latestStartWorkday: 0,
        latestFinishWorkday: 0,
        slackWorkdays: schedule?.slackWorkdays ?? 0,
        isCritical: schedule?.isCritical ?? false,
        isBlocked: schedule?.isBlocked ?? false,
        forecastFinishDate: schedule?.earlyFinish ?? null,
      };
    });

    return {
      baselineForecastDeliveryDate: simResult.baseResult.projectForecastFinish,
      scenarioForecastDeliveryDate: simResult.simulatedResult.projectForecastFinish,
      varianceWorkdays: simResult.projectFinishDeltaWorkdays ?? 0,
      criticalPathTaskIds: simResult.simulatedResult.criticalTaskIds,
      impactedTaskIds: [
        ...simResult.newlyAtRiskTaskIds,
        ...simResult.addedCriticalTaskIds,
      ],
      tasks: mappedTasks,
    };
  }
}
