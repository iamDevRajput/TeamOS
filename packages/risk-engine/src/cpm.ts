/**
 * TeamOS Risk Engine — Critical Path Method (CPM)
 *
 * Rules:
 * - Deterministic forward pass (Early Start, Early Finish).
 * - Deterministic backward pass (Late Start, Late Finish).
 * - Total slack / float calculation in working days.
 * - Missing estimates remain explicitly unknown (never silently zero).
 * - Downstream tasks inheriting unknown estimates are flagged hasUnknownForecast = true.
 * - Multiple equal critical paths are preserved.
 * - Cancelled blockers are excluded from active path and flagged for review.
 * - Zero network, database, or library dependencies.
 */

import {
  RiskEngineTask,
  RiskEngineDependency,
  RiskEngineProject,
  TaskSchedule,
  CriticalPath,
  FlaggedCancelledDependency,
} from "./types";
import {
  parseIsoDate,
  formatEpochDay,
  snapToWorkday,
  nextWorkday,
  previousWorkday,
  computeEarlyFinish,
  computeLateStart,
  workdaysDifference,
} from "./calendar";

export interface CpmCalculationOutput {
  projectForecastFinish: string | null;
  projectSlackWorkdays: number | null;
  isProjectAtRisk: boolean;
  schedules: Record<string, TaskSchedule>;
  criticalPaths: CriticalPath[];
  criticalTaskIds: string[];
  hasIncompleteForecast: boolean;
  flaggedCancelledDependencies: FlaggedCancelledDependency[];
}

export function calculateCriticalPathMethod(
  project: RiskEngineProject,
  tasks: RiskEngineTask[],
  dependencies: RiskEngineDependency[],
  topologicalOrder: string[],
): CpmCalculationOutput {
  const taskMap = new Map<string, RiskEngineTask>();
  for (const t of tasks) {
    taskMap.set(t.id, t);
  }

  const evalEpoch = snapToWorkday(parseIsoDate(project.evaluationDate), 1);
  const projectStartEpoch = snapToWorkday(parseIsoDate(project.startDate), 1);
  const baseStartEpoch = Math.max(evalEpoch, projectStartEpoch);

  // Separate active vs cancelled dependencies
  const activeBlockers = new Map<string, string[]>(); // blockedId -> [activeBlockerIds]
  const activeDependents = new Map<string, string[]>(); // blockerId -> [activeDependentIds]
  const flaggedCancelledDependencies: FlaggedCancelledDependency[] = [];

  for (const id of topologicalOrder) {
    activeBlockers.set(id, []);
    activeDependents.set(id, []);
  }

  for (const dep of dependencies) {
    const blocker = taskMap.get(dep.blockerTaskId);
    const blocked = taskMap.get(dep.blockedTaskId);
    if (!blocker || !blocked) continue;

    // If blocker is CANCELLED, exclude from active scheduling and flag for review
    if (blocker.status === "CANCELLED") {
      flaggedCancelledDependencies.push({
        blockerTaskId: blocker.id,
        blockedTaskId: blocked.id,
      });
      continue;
    }

    // If blocked is CANCELLED, it does not participate in active forward pass
    if (blocked.status === "CANCELLED") {
      continue;
    }

    if (activeBlockers.has(blocked.id) && activeDependents.has(blocker.id)) {
      activeBlockers.get(blocked.id)!.push(blocker.id);
      activeDependents.get(blocker.id)!.push(blocked.id);
    }
  }

  // --- FORWARD PASS ---
  const earlyStartMap = new Map<string, number | null>();
  const earlyFinishMap = new Map<string, number | null>();
  const unknownReasons = new Map<string, string>();

  for (const taskId of topologicalOrder) {
    const task = taskMap.get(taskId)!;

    if (task.status === "CANCELLED") {
      earlyStartMap.set(taskId, null);
      earlyFinishMap.set(taskId, null);
      continue;
    }

    if (task.status === "DONE") {
      const finishEpoch = task.actualFinishDate
        ? parseIsoDate(task.actualFinishDate)
        : evalEpoch;
      earlyStartMap.set(taskId, finishEpoch);
      earlyFinishMap.set(taskId, finishEpoch);
      continue;
    }

    // Check estimate: unknown estimates must remain explicitly unknown
    const estimate = task.remainingEstimateWorkdays;
    if (estimate === undefined || estimate === null) {
      earlyStartMap.set(taskId, null);
      earlyFinishMap.set(taskId, null);
      unknownReasons.set(taskId, "Task estimate is missing");
      continue;
    }

    const blockers = activeBlockers.get(taskId) || [];
    let taskStartEpoch: number;

    if (blockers.length === 0) {
      // Root task
      taskStartEpoch = baseStartEpoch;
    } else {
      // Dependent task: earliest start is next workday after latest blocker finish
      let maxBlockerFinish: number | null = null;
      let hasUnknownBlocker = false;
      let unknownBlockerId = "";

      for (const bId of blockers) {
        const bFinish = earlyFinishMap.get(bId);
        if (bFinish === null || bFinish === undefined) {
          hasUnknownBlocker = true;
          unknownBlockerId = bId;
          break;
        }
        if (maxBlockerFinish === null || bFinish > maxBlockerFinish) {
          maxBlockerFinish = bFinish;
        }
      }

      if (hasUnknownBlocker) {
        earlyStartMap.set(taskId, null);
        earlyFinishMap.set(taskId, null);
        unknownReasons.set(
          taskId,
          `Blocked by task "${unknownBlockerId}" which has an unknown forecast`,
        );
        continue;
      }

      // If all blockers are DONE and finished before baseStartEpoch, earliest start is baseStartEpoch
      const candidateStart = nextWorkday(maxBlockerFinish!);
      taskStartEpoch = Math.max(candidateStart, baseStartEpoch);
    }

    earlyStartMap.set(taskId, taskStartEpoch);
    const finishEpoch = computeEarlyFinish(taskStartEpoch, estimate);
    earlyFinishMap.set(taskId, finishEpoch);
  }

  // Identify terminal tasks (active non-cancelled tasks with no active dependents)
  const activeTerminalTaskIds: string[] = [];
  for (const taskId of topologicalOrder) {
    const task = taskMap.get(taskId)!;
    if (task.status === "CANCELLED") continue;

    const dependents = activeDependents.get(taskId) || [];
    if (dependents.length === 0) {
      activeTerminalTaskIds.push(taskId);
    }
  }

  // Project forecast finish: max earlyFinish across all terminal tasks
  // If ANY active terminal task has an unknown forecast, the overall project forecast is incomplete/unknown
  let projectForecastFinishEpoch: number | null = null;
  let hasIncompleteForecast = false;

  for (const tId of activeTerminalTaskIds) {
    const ef = earlyFinishMap.get(tId);
    if (ef === null || ef === undefined) {
      hasIncompleteForecast = true;
    } else {
      if (
        projectForecastFinishEpoch === null ||
        ef > projectForecastFinishEpoch
      ) {
        projectForecastFinishEpoch = ef;
      }
    }
  }

  if (hasIncompleteForecast) {
    projectForecastFinishEpoch = null;
  }

  // --- BACKWARD PASS ---
  const lateStartMap = new Map<string, number | null>();
  const lateFinishMap = new Map<string, number | null>();

  if (projectForecastFinishEpoch !== null && !hasIncompleteForecast) {
    // Reverse topological order for backward pass
    const reversedOrder = [...topologicalOrder].reverse();

    for (const taskId of reversedOrder) {
      const task = taskMap.get(taskId)!;
      if (task.status === "CANCELLED" || earlyFinishMap.get(taskId) === null) {
        lateStartMap.set(taskId, null);
        lateFinishMap.set(taskId, null);
        continue;
      }

      const dependents = activeDependents.get(taskId) || [];
      let taskLateFinish: number;

      if (dependents.length === 0) {
        // Terminal task: lateFinish equals projectForecastFinishEpoch
        taskLateFinish = projectForecastFinishEpoch;
      } else {
        // Predecessor: lateFinish is previous workday before minimum lateStart of dependents
        let minDependentLateStart: number | null = null;
        for (const depId of dependents) {
          const depLs = lateStartMap.get(depId);
          if (depLs !== null && depLs !== undefined) {
            if (
              minDependentLateStart === null ||
              depLs < minDependentLateStart
            ) {
              minDependentLateStart = depLs;
            }
          }
        }
        taskLateFinish =
          minDependentLateStart !== null
            ? previousWorkday(minDependentLateStart)
            : projectForecastFinishEpoch;
      }

      lateFinishMap.set(taskId, taskLateFinish);
      const estimate =
        task.status === "DONE" ? 0 : task.remainingEstimateWorkdays || 0;
      const taskLateStart = computeLateStart(taskLateFinish, estimate);
      lateStartMap.set(taskId, taskLateStart);
    }
  }

  // --- ASSEMBLE SCHEDULES & SLACK ---
  const schedules: Record<string, TaskSchedule> = {};
  const criticalTaskIdsSet = new Set<string>();

  for (const task of tasks) {
    const es = earlyStartMap.get(task.id) ?? null;
    const ef = earlyFinishMap.get(task.id) ?? null;
    const ls = lateStartMap.get(task.id) ?? null;
    const lf = lateFinishMap.get(task.id) ?? null;

    let slackWorkdays: number | null = null;
    if (ls !== null && es !== null) {
      slackWorkdays = workdaysDifference(es, ls);
    }

    const hasUnknown = ef === null && task.status !== "CANCELLED";
    const isCritical =
      slackWorkdays !== null &&
      slackWorkdays <= 0 &&
      !hasUnknown &&
      task.status !== "CANCELLED";

    if (isCritical) {
      criticalTaskIdsSet.add(task.id);
    }

    // At risk: earlyFinish is strictly after dueDate
    let isAtRisk = false;
    if (ef !== null && task.dueDate) {
      const dueEpoch = parseIsoDate(task.dueDate);
      isAtRisk = ef > dueEpoch;
    }

    // Blocked check: TODO/IN_PROGRESS with unfinished active blockers
    const rawBlockers = activeBlockers.get(task.id) || [];
    const isBlocked =
      (task.status === "TODO" || task.status === "IN_PROGRESS") &&
      rawBlockers.some((bId) => taskMap.get(bId)?.status !== "DONE");

    const cancelledBlockers = flaggedCancelledDependencies
      .filter((f) => f.blockedTaskId === task.id)
      .map((f) => f.blockerTaskId);

    schedules[task.id] = {
      taskId: task.id,
      status: task.status,
      remainingEstimateWorkdays: task.remainingEstimateWorkdays ?? null,
      earlyStart: es !== null ? formatEpochDay(es) : null,
      earlyFinish: ef !== null ? formatEpochDay(ef) : null,
      lateStart: ls !== null ? formatEpochDay(ls) : null,
      lateFinish: lf !== null ? formatEpochDay(lf) : null,
      slackWorkdays,
      isCritical,
      isAtRisk,
      isBlocked,
      activeBlockerIds: rawBlockers,
      cancelledBlockerIds: cancelledBlockers,
      hasUnknownForecast: hasUnknown,
      unknownReason: unknownReasons.get(task.id),
    };
  }

  // Project at-risk & project slack
  let isProjectAtRisk = false;
  let projectSlackWorkdays: number | null = null;
  if (project.targetDate && projectForecastFinishEpoch !== null) {
    const targetEpoch = parseIsoDate(project.targetDate);
    isProjectAtRisk = projectForecastFinishEpoch > targetEpoch;
    projectSlackWorkdays = workdaysDifference(
      projectForecastFinishEpoch,
      targetEpoch,
    );
  }

  // Extract all tied critical paths
  const criticalPaths = extractAllCriticalPaths(
    topologicalOrder,
    taskMap,
    activeBlockers,
    activeDependents,
    earlyStartMap,
    earlyFinishMap,
    criticalTaskIdsSet,
    activeTerminalTaskIds,
  );

  return {
    projectForecastFinish:
      projectForecastFinishEpoch !== null
        ? formatEpochDay(projectForecastFinishEpoch)
        : null,
    projectSlackWorkdays,
    isProjectAtRisk,
    schedules,
    criticalPaths,
    criticalTaskIds: Array.from(criticalTaskIdsSet),
    hasIncompleteForecast,
    flaggedCancelledDependencies,
  };
}

/**
 * Traces all equal critical paths from root critical tasks to terminal critical tasks.
 * Validates exact finish-to-start critical continuity between nodes.
 */
function extractAllCriticalPaths(
  topologicalOrder: string[],
  taskMap: Map<string, RiskEngineTask>,
  activeBlockers: Map<string, string[]>,
  activeDependents: Map<string, string[]>,
  earlyStartMap: Map<string, number | null>,
  earlyFinishMap: Map<string, number | null>,
  criticalTaskIds: Set<string>,
  terminalTaskIds: string[],
): CriticalPath[] {
  if (criticalTaskIds.size === 0) {
    return [];
  }

  const criticalTerminals = new Set(
    terminalTaskIds.filter((id) => criticalTaskIds.has(id)),
  );
  const MAX_PATHS = 25;
  const paths: string[][] = [];

  // Edge is critical iff blocker and dependent are both critical AND dependent starts on nextWorkday(blocker.finish)
  function isCriticalEdge(blockerId: string, dependentId: string): boolean {
    if (!criticalTaskIds.has(blockerId) || !criticalTaskIds.has(dependentId)) {
      return false;
    }
    const bFinish = earlyFinishMap.get(blockerId);
    const dStart = earlyStartMap.get(dependentId);
    if (
      bFinish === null ||
      bFinish === undefined ||
      dStart === null ||
      dStart === undefined
    ) {
      return false;
    }
    return nextWorkday(bFinish) === dStart;
  }

  // Find true critical root nodes (critical tasks that have NO critical predecessors driving their start)
  const criticalRoots: string[] = [];
  for (const id of topologicalOrder) {
    if (!criticalTaskIds.has(id)) continue;
    const blockers = activeBlockers.get(id) || [];
    const hasDrivingCriticalBlocker = blockers.some((bId) =>
      isCriticalEdge(bId, id),
    );
    if (!hasDrivingCriticalBlocker) {
      criticalRoots.push(id);
    }
  }

  function dfs(curr: string, currentPath: string[]) {
    if (paths.length >= MAX_PATHS) return;

    currentPath.push(curr);
    const dependents = (activeDependents.get(curr) || []).filter((depId) =>
      isCriticalEdge(curr, depId),
    );

    if (dependents.length === 0 || criticalTerminals.has(curr)) {
      paths.push([...currentPath]);
    } else {
      for (const next of dependents) {
        dfs(next, currentPath);
        if (paths.length >= MAX_PATHS) break;
      }
    }
    currentPath.pop();
  }

  for (const rootId of criticalRoots) {
    dfs(rootId, []);
    if (paths.length >= MAX_PATHS) break;
  }

  // Calculate total workdays for each path and sort by length
  const fullPaths: CriticalPath[] = [];
  for (const path of paths) {
    if (path.length === 0) continue;
    let totalWorkdays = 0;
    for (const taskId of path) {
      const task = taskMap.get(taskId);
      totalWorkdays += task?.remainingEstimateWorkdays || 0;
    }
    fullPaths.push({
      taskIds: path,
      totalWorkdays,
    });
  }

  // Filter to maximal length paths
  const maxLen = Math.max(...fullPaths.map((p) => p.taskIds.length), 0);
  const longestPaths = fullPaths.filter((p) => p.taskIds.length === maxLen);

  const seen = new Set<string>();
  const uniquePaths: CriticalPath[] = [];
  for (const p of longestPaths) {
    const key = p.taskIds.join("->");
    if (!seen.has(key)) {
      seen.add(key);
      uniquePaths.push(p);
    }
  }

  return uniquePaths;
}
