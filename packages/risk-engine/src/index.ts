/**
 * TeamOS Risk Engine — Public Interface
 *
 * Rules:
 * - Pure deterministic risk calculation engine.
 * - Zero database, network, or framework imports.
 * - Graph calculations adhere to Kahn's algorithm and Critical Path Method (CPM).
 */

import { RiskEngineDependency } from "./types";
import { validateAndSortGraph } from "./dag";

export * from "./types";
export * from "./calendar";
export * from "./dag";
export * from "./cpm";
export * from "./impact";
export * from "./what-if";
export * from "./engine";
export * from "./snapshot";

/**
 * Validates that the finish-to-start dependency graph is a Directed Acyclic Graph (DAG).
 * Preserves backwards compatibility for existing consumers and tests.
 */
export function validateAcyclicGraph(
  taskIds: string[],
  dependencies: RiskEngineDependency[],
): { isAcyclic: boolean; cycleNodes?: string[] } {
  const result = validateAndSortGraph(taskIds, dependencies);
  return {
    isAcyclic: result.isAcyclic,
    cycleNodes: result.cycleNodes,
  };
}
