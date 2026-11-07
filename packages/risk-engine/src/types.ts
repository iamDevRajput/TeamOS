/**
 * TeamOS Risk Engine — Pure Type Definitions
 *
 * Rules:
 * - Pure TypeScript interfaces and types.
 * - Zero database, framework, network, or filesystem imports.
 * - Finish-to-start dependencies: blockerTaskId -> blockedTaskId.
 */

export type TaskStatus = "TODO" | "IN_PROGRESS" | "DONE" | "CANCELLED";

export interface RiskEngineTask {
  id: string;
  title?: string;
  status: TaskStatus;
  /**
   * Remaining work in working days.
   * Unknown estimates must remain undefined or null; never silently coerced to 0.
   */
  remainingEstimateWorkdays?: number | null;
  /**
   * Task target due date (ISO YYYY-MM-DD).
   */
  dueDate?: string | null;
  /**
   * Actual completion date for DONE tasks (ISO YYYY-MM-DD).
   */
  actualFinishDate?: string | null;
}

export interface RiskEngineDependency {
  /** Blocker task must finish before blocked task can start */
  blockerTaskId: string;
  /** Blocked task waits for blocker task to finish */
  blockedTaskId: string;
}

export interface RiskEngineProject {
  id?: string;
  /** Project start date (ISO YYYY-MM-DD) */
  startDate: string;
  /** Optional project-level deadline (ISO YYYY-MM-DD) */
  targetDate?: string | null;
  /** Evaluation date in project timezone (ISO YYYY-MM-DD) */
  evaluationDate: string;
  /** Timezone name for reporting */
  timezone?: string;
}

export interface TaskSchedule {
  taskId: string;
  status: TaskStatus;
  remainingEstimateWorkdays: number | null;
  /** Earliest Start date (ISO YYYY-MM-DD) or null if unknown */
  earlyStart: string | null;
  /** Earliest Finish date (ISO YYYY-MM-DD) or null if unknown */
  earlyFinish: string | null;
  /** Latest Start date (ISO YYYY-MM-DD) or null if unknown */
  lateStart: string | null;
  /** Latest Finish date (ISO YYYY-MM-DD) or null if unknown */
  lateFinish: string | null;
  /** Total slack/float in working days (lateStart - earlyStart), null if unknown or no due date */
  slackWorkdays: number | null;
  /** True if task lies on any critical path (slack <= 0 and forecast is known) */
  isCritical: boolean;
  /** True if known earlyFinish is strictly after dueDate */
  isAtRisk: boolean;
  /** True if task is TODO/IN_PROGRESS and has active unfinished non-cancelled blockers */
  isBlocked: boolean;
  /** Active non-cancelled blocker IDs */
  activeBlockerIds: string[];
  /** Flagged dependencies pointing to CANCELLED blockers */
  cancelledBlockerIds: string[];
  /** True if forecast dates cannot be computed due to missing estimates in chain */
  hasUnknownForecast: boolean;
  /** Human-readable explanation when forecast is unknown */
  unknownReason?: string;
}

export interface CriticalPath {
  taskIds: string[];
  totalWorkdays: number;
}

export interface FlaggedCancelledDependency {
  blockerTaskId: string;
  blockedTaskId: string;
}

export interface RiskEngineResult {
  evaluationDate: string;
  projectStartDate: string;
  /** Earliest project completion date, or null if any active terminal chain has unknown estimate */
  projectForecastFinish: string | null;
  projectTargetDate: string | null;
  isProjectAtRisk: boolean;
  /** Project slack in workdays against targetDate, or null if no targetDate or forecast is unknown */
  projectSlackWorkdays: number | null;
  /** Individual task schedules indexed by task ID */
  schedules: Record<string, TaskSchedule>;
  /** All tied critical paths (preserves multiple equal paths) */
  criticalPaths: CriticalPath[];
  /** Unique set of task IDs belonging to at least one critical path */
  criticalTaskIds: string[];
  /** Valid topological order of active tasks */
  topologicalOrder: string[];
  isAcyclic: boolean;
  hasCycle: boolean;
  cycleNodes?: string[];
  /** True if one or more terminal chains could not be forecasted due to unknown estimates */
  hasIncompleteForecast: boolean;
  /** Dependencies referencing CANCELLED tasks that require human review */
  flaggedCancelledDependencies: FlaggedCancelledDependency[];
}

export interface DownstreamImpact {
  targetTaskId: string;
  /** All direct and indirect tasks depending on targetTaskId */
  affectedTaskIds: string[];
  /** Immediate direct dependent task IDs */
  directDependentIds: string[];
  /** Affected tasks that are currently on the critical path */
  criticalAffectedTaskIds: string[];
  /** How many workdays the project finish is delayed if this task slips by the given workdays */
  projectDelayWorkdays: number;
  /** Tasks that become newly at-risk due to the delay */
  newlyAtRiskTaskIds: string[];
}

export interface WhatIfTaskModification {
  id: string;
  remainingEstimateWorkdays?: number | null;
  dueDate?: string | null;
  status?: TaskStatus;
}

export interface WhatIfScenario {
  modifyTasks?: WhatIfTaskModification[];
  addDependencies?: RiskEngineDependency[];
  removeDependencies?: RiskEngineDependency[];
}

export interface WhatIfSimulationResult {
  baseResult: RiskEngineResult;
  simulatedResult: RiskEngineResult;
  /** Difference in project forecast finish in workdays (positive = delayed, negative = earlier) */
  projectFinishDeltaWorkdays: number | null;
  /** Task IDs that were not at-risk in base but are at-risk in simulation */
  newlyAtRiskTaskIds: string[];
  /** Task IDs that were at-risk in base but are no longer at-risk in simulation */
  recoveredTaskIds: string[];
  /** Task IDs newly added to the critical path */
  addedCriticalTaskIds: string[];
  /** Task IDs removed from the critical path */
  removedCriticalTaskIds: string[];
}
