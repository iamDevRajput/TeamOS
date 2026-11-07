/**
 * TeamOS Risk Engine — Downstream Impact and Delay Propagation
 *
 * Rules:
 * - Deterministic transitive closure computation of affected downstream tasks.
 * - Accurate delay propagation based on task slack.
 * - Zero network, database, or library dependencies.
 */

import {
  RiskEngineTask,
  RiskEngineDependency,
  DownstreamImpact,
  RiskEngineResult,
} from "./types";
import { parseIsoDate, computeEarlyFinish } from "./calendar";

/**
 * Computes the transitive downstream impact of a task being delayed by N working days.
 */
export function calculateDownstreamImpact(
  targetTaskId: string,
  baseResult: RiskEngineResult,
  tasks: RiskEngineTask[],
  dependencies: RiskEngineDependency[],
  delayWorkdays = 0,
): DownstreamImpact {
  const taskMap = new Map<string, RiskEngineTask>();
  for (const t of tasks) {
    taskMap.set(t.id, t);
  }

  // Build forward graph (blocker -> dependents)
  const adj = new Map<string, string[]>();
  for (const t of tasks) {
    adj.set(t.id, []);
  }

  for (const dep of dependencies) {
    if (adj.has(dep.blockerTaskId)) {
      adj.get(dep.blockerTaskId)!.push(dep.blockedTaskId);
    }
  }

  // Direct dependents
  const directDependentIds = adj.get(targetTaskId) || [];

  // Transitive closure (BFS)
  const visited = new Set<string>();
  const queue: string[] = [...directDependentIds];
  for (const id of directDependentIds) {
    visited.add(id);
  }

  while (queue.length > 0) {
    const current = queue.shift()!;
    const nextList = adj.get(current) || [];
    for (const next of nextList) {
      if (!visited.has(next)) {
        visited.add(next);
        queue.push(next);
      }
    }
  }

  const affectedTaskIds = Array.from(visited);
  const criticalSet = new Set(baseResult.criticalTaskIds);
  const criticalAffectedTaskIds = affectedTaskIds.filter((id) =>
    criticalSet.has(id),
  );

  // Compute project delay based on slack of target task
  const targetSchedule = baseResult.schedules[targetTaskId];
  let projectDelayWorkdays = 0;

  if (targetSchedule) {
    const slack = targetSchedule.slackWorkdays ?? 0;
    if (delayWorkdays > 0) {
      // If delay exceeds slack, the excess directly delays the project
      projectDelayWorkdays = Math.max(0, delayWorkdays - slack);
    }
  }

  // Check which downstream tasks become newly at risk under this delay
  const newlyAtRiskTaskIds: string[] = [];
  if (delayWorkdays > 0 && targetSchedule && targetSchedule.earlyFinish) {
    for (const affId of affectedTaskIds) {
      const affTask = taskMap.get(affId);
      const affSched = baseResult.schedules[affId];
      if (!affTask || !affTask.dueDate || !affSched || !affSched.earlyFinish) {
        continue;
      }
      // If it was already at risk, it is not "newly" at risk
      if (affSched.isAtRisk) {
        continue;
      }

      // Check if pushed finish exceeds due date
      const currentFinishEpoch = parseIsoDate(affSched.earlyFinish);
      const pushedFinishEpoch = computeEarlyFinish(
        currentFinishEpoch,
        delayWorkdays,
      );
      const dueEpoch = parseIsoDate(affTask.dueDate);

      if (pushedFinishEpoch > dueEpoch) {
        newlyAtRiskTaskIds.push(affId);
      }
    }
  }

  return {
    targetTaskId,
    affectedTaskIds,
    directDependentIds,
    criticalAffectedTaskIds,
    projectDelayWorkdays,
    newlyAtRiskTaskIds,
  };
}
