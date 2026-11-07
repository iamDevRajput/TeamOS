/**
 * TeamOS Risk Engine — Directed Acyclic Graph (DAG) Algorithms
 *
 * Rules:
 * - Deterministic Kahn's algorithm for topological sorting.
 * - Accurate cycle detection and cycle node extraction.
 * - Self-dependency rejection.
 * - Pure algorithmic functions; zero I/O.
 */

import { RiskEngineDependency } from "./types";

export interface DagValidationResult {
  isAcyclic: boolean;
  topologicalOrder: string[];
  hasCycle: boolean;
  cycleNodes?: string[];
}

/**
 * Validates whether the dependency graph over taskIds is a Directed Acyclic Graph (DAG).
 * Returns the topological sort order if acyclic, or the cycle nodes if a cycle exists.
 */
export function validateAndSortGraph(
  taskIds: string[],
  dependencies: RiskEngineDependency[],
): DagValidationResult {
  const taskIdSet = new Set(taskIds);
  const adj = new Map<string, string[]>();
  const inDegree = new Map<string, number>();

  for (const id of taskIds) {
    adj.set(id, []);
    inDegree.set(id, 0);
  }

  // Filter dependencies to valid known tasks and reject self-dependencies immediately
  for (const dep of dependencies) {
    if (
      !taskIdSet.has(dep.blockerTaskId) ||
      !taskIdSet.has(dep.blockedTaskId)
    ) {
      continue;
    }
    if (dep.blockerTaskId === dep.blockedTaskId) {
      return {
        isAcyclic: false,
        hasCycle: true,
        topologicalOrder: [],
        cycleNodes: [dep.blockerTaskId],
      };
    }

    adj.get(dep.blockerTaskId)!.push(dep.blockedTaskId);
    inDegree.set(dep.blockedTaskId, (inDegree.get(dep.blockedTaskId) || 0) + 1);
  }

  // Kahn's Algorithm
  // Deterministic priority: sort initial queue alphabetically to ensure stable tie-breaking
  const queue: string[] = [];
  for (const [id, deg] of inDegree.entries()) {
    if (deg === 0) {
      queue.push(id);
    }
  }
  queue.sort();

  const topologicalOrder: string[] = [];
  while (queue.length > 0) {
    const node = queue.shift()!;
    topologicalOrder.push(node);

    const neighbors = adj.get(node) || [];
    // Sort neighbors to maintain deterministic order
    const sortedNeighbors = [...neighbors].sort();
    for (const neighbor of sortedNeighbors) {
      const newDeg = (inDegree.get(neighbor) || 0) - 1;
      inDegree.set(neighbor, newDeg);
      if (newDeg === 0) {
        queue.push(neighbor);
        queue.sort();
      }
    }
  }

  if (topologicalOrder.length === taskIds.length) {
    return {
      isAcyclic: true,
      hasCycle: false,
      topologicalOrder,
    };
  }

  // Graph has at least one cycle. Extract participating cycle nodes.
  const cycleNodes = extractCycleNodes(adj, inDegree);

  return {
    isAcyclic: false,
    hasCycle: true,
    topologicalOrder: [],
    cycleNodes,
  };
}

/**
 * Extracts nodes that are part of cycles (nodes whose in-degree remained > 0 after Kahn's pass).
 */
function extractCycleNodes(
  adj: Map<string, string[]>,
  remainingInDegree: Map<string, number>,
): string[] {
  const cycleCandidates = new Set<string>();
  for (const [id, deg] of remainingInDegree.entries()) {
    if (deg > 0) {
      cycleCandidates.add(id);
    }
  }

  // Trace a concrete cycle using DFS among candidates
  const visited = new Set<string>();
  const recursionStack = new Set<string>();
  const detectedCycle: string[] = [];

  function dfs(curr: string): boolean {
    visited.add(curr);
    recursionStack.add(curr);

    const neighbors = adj.get(curr) || [];
    for (const neighbor of neighbors) {
      if (!cycleCandidates.has(neighbor)) continue;

      if (recursionStack.has(neighbor)) {
        detectedCycle.push(neighbor, curr);
        return true;
      }

      if (!visited.has(neighbor)) {
        if (dfs(neighbor)) {
          if (!detectedCycle.includes(curr)) {
            detectedCycle.push(curr);
          }
          return true;
        }
      }
    }

    recursionStack.delete(curr);
    return false;
  }

  for (const node of cycleCandidates) {
    if (!visited.has(node)) {
      if (dfs(node)) break;
    }
  }

  return detectedCycle.length > 0
    ? detectedCycle.reverse()
    : Array.from(cycleCandidates);
}

/**
 * Checks whether adding an edge (blockerTaskId -> blockedTaskId) would introduce a cycle,
 * using reachability check from blockedTaskId to blockerTaskId.
 */
export function wouldCreateCycle(
  existingDependencies: RiskEngineDependency[],
  newBlockerId: string,
  newBlockedId: string,
): boolean {
  if (newBlockerId === newBlockedId) {
    return true;
  }

  const adj = new Map<string, string[]>();
  for (const dep of existingDependencies) {
    if (!adj.has(dep.blockerTaskId)) {
      adj.set(dep.blockerTaskId, []);
    }
    adj.get(dep.blockerTaskId)!.push(dep.blockedTaskId);
  }

  // Check if newBlockerId is reachable from newBlockedId
  const visited = new Set<string>();
  const queue: string[] = [newBlockedId];
  visited.add(newBlockedId);

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current === newBlockerId) {
      return true;
    }

    const neighbors = adj.get(current) || [];
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        queue.push(neighbor);
      }
    }
  }

  return false;
}
