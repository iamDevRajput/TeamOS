/**
 * TeamOS Risk Engine — In-Memory What-If Simulation
 *
 * Rules:
 * - Pure in-memory calculation; zero database writes or side effects.
 * - Deep immutability: base inputs are never mutated.
 * - Accurately computes deltas in delivery dates, risk states, and critical paths.
 */

import {
  RiskEngineProject,
  RiskEngineTask,
  RiskEngineDependency,
  WhatIfScenario,
  WhatIfSimulationResult,
} from "./types";
import { calculateProjectRisk } from "./engine";
import { parseIsoDate, workdaysDifference } from "./calendar";

/**
 * Simulates the impact of hypothetical project changes (estimates, statuses, added/removed edges)
 * without modifying base records.
 */
export function simulateWhatIf(
  project: RiskEngineProject,
  baseTasks: RiskEngineTask[],
  baseDependencies: RiskEngineDependency[],
  scenario: WhatIfScenario,
): WhatIfSimulationResult {
  // 1. Calculate baseline risk
  const baseResult = calculateProjectRisk(project, baseTasks, baseDependencies);

  // 2. Clone tasks and apply modifications
  const taskMap = new Map<string, RiskEngineTask>();
  for (const t of baseTasks) {
    taskMap.set(t.id, { ...t });
  }

  if (scenario.modifyTasks) {
    for (const mod of scenario.modifyTasks) {
      const existing = taskMap.get(mod.id);
      if (existing) {
        if (mod.remainingEstimateWorkdays !== undefined) {
          existing.remainingEstimateWorkdays = mod.remainingEstimateWorkdays;
        }
        if (mod.dueDate !== undefined) {
          existing.dueDate = mod.dueDate;
        }
        if (mod.status !== undefined) {
          existing.status = mod.status;
        }
      }
    }
  }

  const simulatedTasks = Array.from(taskMap.values());

  // 3. Clone dependencies and apply additions/removals
  const depKey = (d: RiskEngineDependency) =>
    `${d.blockerTaskId}->${d.blockedTaskId}`;
  const depMap = new Map<string, RiskEngineDependency>();

  for (const d of baseDependencies) {
    depMap.set(depKey(d), { ...d });
  }

  if (scenario.removeDependencies) {
    for (const d of scenario.removeDependencies) {
      depMap.delete(depKey(d));
    }
  }

  if (scenario.addDependencies) {
    for (const d of scenario.addDependencies) {
      depMap.set(depKey(d), { ...d });
    }
  }

  const simulatedDependencies = Array.from(depMap.values());

  // 4. Calculate simulated risk
  const simulatedResult = calculateProjectRisk(
    project,
    simulatedTasks,
    simulatedDependencies,
  );

  // 5. Compute deltas
  let projectFinishDeltaWorkdays: number | null = null;
  if (
    baseResult.projectForecastFinish &&
    simulatedResult.projectForecastFinish
  ) {
    const baseEpoch = parseIsoDate(baseResult.projectForecastFinish);
    const simEpoch = parseIsoDate(simulatedResult.projectForecastFinish);
    projectFinishDeltaWorkdays = workdaysDifference(baseEpoch, simEpoch);
  }

  const baseAtRisk = new Set(
    Object.values(baseResult.schedules)
      .filter((s) => s.isAtRisk)
      .map((s) => s.taskId),
  );
  const simAtRisk = new Set(
    Object.values(simulatedResult.schedules)
      .filter((s) => s.isAtRisk)
      .map((s) => s.taskId),
  );

  const newlyAtRiskTaskIds: string[] = [];
  for (const id of simAtRisk) {
    if (!baseAtRisk.has(id)) {
      newlyAtRiskTaskIds.push(id);
    }
  }

  const recoveredTaskIds: string[] = [];
  for (const id of baseAtRisk) {
    if (!simAtRisk.has(id)) {
      recoveredTaskIds.push(id);
    }
  }

  const baseCritical = new Set(baseResult.criticalTaskIds);
  const simCritical = new Set(simulatedResult.criticalTaskIds);

  const addedCriticalTaskIds: string[] = [];
  for (const id of simCritical) {
    if (!baseCritical.has(id)) {
      addedCriticalTaskIds.push(id);
    }
  }

  const removedCriticalTaskIds: string[] = [];
  for (const id of baseCritical) {
    if (!simCritical.has(id)) {
      removedCriticalTaskIds.push(id);
    }
  }

  return {
    baseResult,
    simulatedResult,
    projectFinishDeltaWorkdays,
    newlyAtRiskTaskIds,
    recoveredTaskIds,
    addedCriticalTaskIds,
    removedCriticalTaskIds,
  };
}
