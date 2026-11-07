/**
 * Pure deterministic risk calculation engine for TeamOS.
 *
 * NOTE: Strictly no database, network, or framework imports.
 * Graph calculations adhere to Kahn's algorithm and Critical Path Method (CPM).
 */

export interface RiskEngineTask {
  id: string;
  remainingEstimateWorkdays?: number;
  dueDate?: string;
  status: 'TODO' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED';
}

export interface RiskEngineDependency {
  blockerTaskId: string;
  blockedTaskId: string;
}

export interface RiskForecastResult {
  hasCycle: boolean;
  criticalPathTaskIds: string[];
  evaluationDate: string;
}

/**
 * Validates that the finish-to-start dependency graph is a Directed Acyclic Graph (DAG).
 */
export function validateAcyclicGraph(
  taskIds: string[],
  dependencies: RiskEngineDependency[],
): { isAcyclic: boolean; cycleNodes?: string[] } {
  const adj = new Map<string, string[]>();
  const inDegree = new Map<string, number>();

  for (const id of taskIds) {
    adj.set(id, []);
    inDegree.set(id, 0);
  }

  for (const dep of dependencies) {
    if (!adj.has(dep.blockerTaskId) || !adj.has(dep.blockedTaskId)) {
      continue;
    }
    adj.get(dep.blockerTaskId)!.push(dep.blockedTaskId);
    inDegree.set(dep.blockedTaskId, (inDegree.get(dep.blockedTaskId) || 0) + 1);
  }

  const queue: string[] = [];
  for (const [id, deg] of inDegree.entries()) {
    if (deg === 0) {
      queue.push(id);
    }
  }

  let visitedCount = 0;
  while (queue.length > 0) {
    const node = queue.shift()!;
    visitedCount++;
    const neighbors = adj.get(node) || [];
    for (const neighbor of neighbors) {
      const newDeg = (inDegree.get(neighbor) || 0) - 1;
      inDegree.set(neighbor, newDeg);
      if (newDeg === 0) {
        queue.push(neighbor);
      }
    }
  }

  return {
    isAcyclic: visitedCount === taskIds.length,
  };
}

