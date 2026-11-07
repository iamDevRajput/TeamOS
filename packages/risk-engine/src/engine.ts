/**
 * TeamOS Risk Engine — Main Calculation Orchestrator
 *
 * Rules:
 * - Pure deterministic pipeline.
 * - Zero database, network, or framework imports.
 * - Always surfaces unknown estimates explicitly.
 */

import {
  RiskEngineProject,
  RiskEngineTask,
  RiskEngineDependency,
  RiskEngineResult,
} from "./types";
import { validateAndSortGraph } from "./dag";
import { calculateCriticalPathMethod } from "./cpm";

/**
 * Calculates complete delivery risk, deterministic CPM forecasts, slack,
 * and critical paths for a project.
 */
export function calculateProjectRisk(
  project: RiskEngineProject,
  tasks: RiskEngineTask[],
  dependencies: RiskEngineDependency[],
): RiskEngineResult {
  const taskIds = tasks.map((t) => t.id);

  // 1. Validate DAG and establish deterministic topological order
  const dagResult = validateAndSortGraph(taskIds, dependencies);

  if (dagResult.hasCycle) {
    return {
      evaluationDate: project.evaluationDate,
      projectStartDate: project.startDate,
      projectForecastFinish: null,
      projectTargetDate: project.targetDate ?? null,
      isProjectAtRisk: false,
      projectSlackWorkdays: null,
      schedules: {},
      criticalPaths: [],
      criticalTaskIds: [],
      topologicalOrder: [],
      isAcyclic: false,
      hasCycle: true,
      cycleNodes: dagResult.cycleNodes,
      hasIncompleteForecast: true,
      flaggedCancelledDependencies: [],
    };
  }

  // 2. Execute Critical Path Method (Forward pass, backward pass, float, critical paths)
  const cpmOutput = calculateCriticalPathMethod(
    project,
    tasks,
    dependencies,
    dagResult.topologicalOrder,
  );

  return {
    evaluationDate: project.evaluationDate,
    projectStartDate: project.startDate,
    projectForecastFinish: cpmOutput.projectForecastFinish,
    projectTargetDate: project.targetDate ?? null,
    isProjectAtRisk: cpmOutput.isProjectAtRisk,
    projectSlackWorkdays: cpmOutput.projectSlackWorkdays,
    schedules: cpmOutput.schedules,
    criticalPaths: cpmOutput.criticalPaths,
    criticalTaskIds: cpmOutput.criticalTaskIds,
    topologicalOrder: dagResult.topologicalOrder,
    isAcyclic: true,
    hasCycle: false,
    hasIncompleteForecast: cpmOutput.hasIncompleteForecast,
    flaggedCancelledDependencies: cpmOutput.flaggedCancelledDependencies,
  };
}
