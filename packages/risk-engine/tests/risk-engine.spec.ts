import { describe, expect, it } from "vitest";
import {
  calculateProjectRisk,
  simulateWhatIf,
  calculateDownstreamImpact,
  validateAndSortGraph,
  wouldCreateCycle,
  isWorkday,
  isIsoWorkday,
  parseIsoDate,
  formatEpochDay,
  computeEarlyFinish,
  computeLateStart,
  workdaysDifference,
  addWorkdays,
  nextWorkday,
  RiskEngineProject,
  RiskEngineTask,
  RiskEngineDependency,
} from "../src/index";

describe("TeamOS Risk Engine (Milestone 2)", () => {
  // -------------------------------------------------------------
  // 1. Pure Calendar & Workday Arithmetic Tests
  // -------------------------------------------------------------
  describe("1. Work Calendar & Epoch Arithmetic", () => {
    it("correctly identifies workdays (Mon-Fri) and weekends (Sat-Sun)", () => {
      // 2026-03-02 is Monday, 2026-03-06 is Friday, 2026-03-07 is Sat, 2026-03-08 is Sun
      expect(isIsoWorkday("2026-03-02")).toBe(true); // Mon
      expect(isIsoWorkday("2026-03-03")).toBe(true); // Tue
      expect(isIsoWorkday("2026-03-04")).toBe(true); // Wed
      expect(isIsoWorkday("2026-03-05")).toBe(true); // Thu
      expect(isIsoWorkday("2026-03-06")).toBe(true); // Fri
      expect(isIsoWorkday("2026-03-07")).toBe(false); // Sat
      expect(isIsoWorkday("2026-03-08")).toBe(false); // Sun
    });

    it("computes Early Finish crossing weekends accurately", () => {
      const monEpoch = parseIsoDate("2026-03-02");

      // 1 day starting Monday -> finishes Monday
      expect(formatEpochDay(computeEarlyFinish(monEpoch, 1))).toBe(
        "2026-03-02",
      );

      // 5 days starting Monday -> finishes Friday
      expect(formatEpochDay(computeEarlyFinish(monEpoch, 5))).toBe(
        "2026-03-06",
      );

      // 6 days starting Monday -> skips Sat/Sun, finishes next Monday
      expect(formatEpochDay(computeEarlyFinish(monEpoch, 6))).toBe(
        "2026-03-09",
      );

      // 10 days starting Monday -> finishes Friday of week 2
      expect(formatEpochDay(computeEarlyFinish(monEpoch, 10))).toBe(
        "2026-03-13",
      );

      // Saturday start automatically snaps to Monday
      const satEpoch = parseIsoDate("2026-03-07");
      expect(formatEpochDay(computeEarlyFinish(satEpoch, 1))).toBe(
        "2026-03-09",
      );
    });

    it("computes Late Start in backward pass accurately", () => {
      const friEpoch = parseIsoDate("2026-03-06");

      // 1 day ending Friday -> starts Friday
      expect(formatEpochDay(computeLateStart(friEpoch, 1))).toBe("2026-03-06");

      // 5 days ending Friday -> starts Monday
      expect(formatEpochDay(computeLateStart(friEpoch, 5))).toBe("2026-03-02");

      // 6 days ending Monday -> starts previous Monday
      const nextMonEpoch = parseIsoDate("2026-03-09");
      expect(formatEpochDay(computeLateStart(nextMonEpoch, 6))).toBe(
        "2026-03-02",
      );
    });

    it("calculates exact workdays difference with sign", () => {
      const mon = parseIsoDate("2026-03-02");
      const fri = parseIsoDate("2026-03-06");
      const nextMon = parseIsoDate("2026-03-09");

      expect(workdaysDifference(mon, fri)).toBe(4);
      expect(workdaysDifference(mon, nextMon)).toBe(5);
      expect(workdaysDifference(fri, mon)).toBe(-4);
      expect(workdaysDifference(mon, mon)).toBe(0);
    });
  });

  // -------------------------------------------------------------
  // 2. DAG Validation, Topological Sort & Cycle Detection
  // -------------------------------------------------------------
  describe("2. DAG Validation & Cycle Detection", () => {
    it("produces valid deterministic topological order for linear chain", () => {
      const taskIds = ["T3", "T1", "T2"];
      const deps: RiskEngineDependency[] = [
        { blockerTaskId: "T1", blockedTaskId: "T2" },
        { blockerTaskId: "T2", blockedTaskId: "T3" },
      ];

      const res = validateAndSortGraph(taskIds, deps);
      expect(res.isAcyclic).toBe(true);
      expect(res.hasCycle).toBe(false);
      expect(res.topologicalOrder).toEqual(["T1", "T2", "T3"]);
    });

    it("rejects self-dependencies immediately", () => {
      const taskIds = ["T1"];
      const deps: RiskEngineDependency[] = [
        { blockerTaskId: "T1", blockedTaskId: "T1" },
      ];

      const res = validateAndSortGraph(taskIds, deps);
      expect(res.isAcyclic).toBe(false);
      expect(res.hasCycle).toBe(true);
      expect(res.cycleNodes).toEqual(["T1"]);
    });

    it("detects 3-node cycle and returns participating cycle nodes", () => {
      const taskIds = ["A", "B", "C", "D"];
      const deps: RiskEngineDependency[] = [
        { blockerTaskId: "A", blockedTaskId: "B" },
        { blockerTaskId: "B", blockedTaskId: "C" },
        { blockerTaskId: "C", blockedTaskId: "A" }, // Cycle: A -> B -> C -> A
        { blockerTaskId: "C", blockedTaskId: "D" },
      ];

      const res = validateAndSortGraph(taskIds, deps);
      expect(res.isAcyclic).toBe(false);
      expect(res.hasCycle).toBe(true);
      expect(res.cycleNodes).toBeDefined();
      expect(res.cycleNodes!.length).toBeGreaterThanOrEqual(3);
      expect(res.cycleNodes).toContain("A");
      expect(res.cycleNodes).toContain("B");
      expect(res.cycleNodes).toContain("C");
    });

    it("wouldCreateCycle helper detects proposed cyclic edges before insertion", () => {
      const existing: RiskEngineDependency[] = [
        { blockerTaskId: "A", blockedTaskId: "B" },
        { blockerTaskId: "B", blockedTaskId: "C" },
      ];

      expect(wouldCreateCycle(existing, "C", "A")).toBe(true); // C -> A would cycle
      expect(wouldCreateCycle(existing, "A", "C")).toBe(false); // Transitive edge A -> C is fine
      expect(wouldCreateCycle(existing, "A", "A")).toBe(true); // Self-dependency
      expect(wouldCreateCycle(existing, "C", "D")).toBe(false); // New edge to D is fine
    });
  });

  // -------------------------------------------------------------
  // 3. Hand-Calculated Reference Project (CPM Verification)
  // -------------------------------------------------------------
  describe("3. Deterministic CPM on Hand-Calculated Reference Project", () => {
    /**
     * Hand-Calculated Reference Project:
     * Project Start: Monday 2026-03-02
     * Evaluation Date: Monday 2026-03-02
     * Target Date: Friday 2026-03-20
     *
     * Graph:
     * Branch 1: Task A (3d) -> Task B (2d) -> Task C (5d)
     * Branch 2: Task D (4d) -> Task E (3d)
     *
     * Expected Dates:
     * Task A: Mon 2026-03-02 to Wed 2026-03-04 (3d)
     * Task B: Thu 2026-03-05 to Fri 2026-03-06 (2d)
     * Task C: Mon 2026-03-09 to Fri 2026-03-13 (5d)  [Terminal 1, finish = 2026-03-13]
     *
     * Task D: Mon 2026-03-02 to Thu 2026-03-05 (4d)
     * Task E: Fri 2026-03-06 to Tue 2026-03-10 (3d)  [Terminal 2, finish = 2026-03-10]
     *
     * Project Forecast Finish: Max(C, E) = Friday 2026-03-13
     * Critical Path: A -> B -> C (total 10 workdays, Slack = 0)
     * Slack for E: finishes Tue 2026-03-10, late finish = Fri 2026-03-13 -> Slack = +3 workdays
     * Slack for D: late finish = Thu 2026-03-05 + 3 = Wed 2026-03-11 -> Slack = +3 workdays
     * Project Slack against Target (2026-03-20): +5 workdays, isProjectAtRisk = false.
     */
    const project: RiskEngineProject = {
      startDate: "2026-03-02",
      evaluationDate: "2026-03-02",
      targetDate: "2026-03-20",
    };

    const tasks: RiskEngineTask[] = [
      {
        id: "A",
        title: "Task A",
        status: "TODO",
        remainingEstimateWorkdays: 3,
      },
      {
        id: "B",
        title: "Task B",
        status: "TODO",
        remainingEstimateWorkdays: 2,
      },
      {
        id: "C",
        title: "Task C",
        status: "TODO",
        remainingEstimateWorkdays: 5,
        dueDate: "2026-03-13",
      },
      {
        id: "D",
        title: "Task D",
        status: "TODO",
        remainingEstimateWorkdays: 4,
      },
      {
        id: "E",
        title: "Task E",
        status: "TODO",
        remainingEstimateWorkdays: 3,
        dueDate: "2026-03-11",
      },
    ];

    const dependencies: RiskEngineDependency[] = [
      { blockerTaskId: "A", blockedTaskId: "B" },
      { blockerTaskId: "B", blockedTaskId: "C" },
      { blockerTaskId: "D", blockedTaskId: "E" },
    ];

    it("calculates exact hand-verified dates, float, and critical path", () => {
      const res = calculateProjectRisk(project, tasks, dependencies);

      expect(res.isAcyclic).toBe(true);
      expect(res.projectForecastFinish).toBe("2026-03-13");
      expect(res.isProjectAtRisk).toBe(false);
      expect(res.projectSlackWorkdays).toBe(5);

      // Verify Task A
      const schedA = res.schedules["A"];
      expect(schedA.earlyStart).toBe("2026-03-02");
      expect(schedA.earlyFinish).toBe("2026-03-04");
      expect(schedA.slackWorkdays).toBe(0);
      expect(schedA.isCritical).toBe(true);

      // Verify Task B
      const schedB = res.schedules["B"];
      expect(schedB.earlyStart).toBe("2026-03-05");
      expect(schedB.earlyFinish).toBe("2026-03-06");
      expect(schedB.slackWorkdays).toBe(0);
      expect(schedB.isCritical).toBe(true);

      // Verify Task C (Critical Terminal)
      const schedC = res.schedules["C"];
      expect(schedC.earlyStart).toBe("2026-03-09");
      expect(schedC.earlyFinish).toBe("2026-03-13");
      expect(schedC.slackWorkdays).toBe(0);
      expect(schedC.isCritical).toBe(true);
      expect(schedC.isAtRisk).toBe(false);

      // Verify Task D (Non-critical root)
      const schedD = res.schedules["D"];
      expect(schedD.earlyStart).toBe("2026-03-02");
      expect(schedD.earlyFinish).toBe("2026-03-05");
      expect(schedD.slackWorkdays).toBe(3);
      expect(schedD.isCritical).toBe(false);

      // Verify Task E (Non-critical terminal)
      const schedE = res.schedules["E"];
      expect(schedE.earlyStart).toBe("2026-03-06");
      expect(schedE.earlyFinish).toBe("2026-03-10");
      expect(schedE.slackWorkdays).toBe(3);
      expect(schedE.isCritical).toBe(false);
      expect(schedE.isAtRisk).toBe(false);

      // Critical paths verification
      expect(res.criticalTaskIds).toEqual(
        expect.arrayContaining(["A", "B", "C"]),
      );
      expect(res.criticalTaskIds).not.toContain("D");
      expect(res.criticalTaskIds).not.toContain("E");

      expect(res.criticalPaths.length).toBe(1);
      expect(res.criticalPaths[0].taskIds).toEqual(["A", "B", "C"]);
      expect(res.criticalPaths[0].totalWorkdays).toBe(10);
    });

    it("classifies task and project as at-risk when finish exceeds due date", () => {
      // Modify project target date to be earlier than forecast (e.g. 2026-03-10)
      const tightProject: RiskEngineProject = {
        ...project,
        targetDate: "2026-03-10",
      };
      // Give Task C an early due date
      const tightTasks = tasks.map((t) =>
        t.id === "C" ? { ...t, dueDate: "2026-03-11" } : t,
      );

      const res = calculateProjectRisk(tightProject, tightTasks, dependencies);
      expect(res.isProjectAtRisk).toBe(true);
      expect(res.projectSlackWorkdays).toBe(-3); // finishes 2026-03-13 vs target 2026-03-10

      expect(res.schedules["C"].isAtRisk).toBe(true);
      expect(res.schedules["C"].earlyFinish).toBe("2026-03-13");
    });
  });

  // -------------------------------------------------------------
  // 4. Multiple Equal Critical Paths (Diamond Graph)
  // -------------------------------------------------------------
  describe("4. Multiple Equal Critical Paths Preservation", () => {
    it("preserves both parallel equal critical paths in a diamond graph", () => {
      const project: RiskEngineProject = {
        startDate: "2026-03-02",
        evaluationDate: "2026-03-02",
      };

      // Diamond graph:
      // Root: A (2d)
      // Path 1: B (3d)
      // Path 2: C (3d)  <-- exact same duration as B!
      // Join: D (2d)
      const tasks: RiskEngineTask[] = [
        { id: "A", status: "TODO", remainingEstimateWorkdays: 2 },
        { id: "B", status: "TODO", remainingEstimateWorkdays: 3 },
        { id: "C", status: "TODO", remainingEstimateWorkdays: 3 },
        { id: "D", status: "TODO", remainingEstimateWorkdays: 2 },
      ];

      const deps: RiskEngineDependency[] = [
        { blockerTaskId: "A", blockedTaskId: "B" },
        { blockerTaskId: "A", blockedTaskId: "C" },
        { blockerTaskId: "B", blockedTaskId: "D" },
        { blockerTaskId: "C", blockedTaskId: "D" },
      ];

      const res = calculateProjectRisk(project, tasks, deps);
      expect(res.isAcyclic).toBe(true);
      expect(res.projectForecastFinish).toBe("2026-03-10"); // Mon+Tue (A), Wed-Fri (B/C), Mon+Tue (D) = 7 workdays

      // All nodes in diamond are critical because both branches are tied
      expect(res.schedules["A"].isCritical).toBe(true);
      expect(res.schedules["B"].isCritical).toBe(true);
      expect(res.schedules["C"].isCritical).toBe(true);
      expect(res.schedules["D"].isCritical).toBe(true);

      // Verify that BOTH critical paths are explicitly preserved
      expect(res.criticalPaths.length).toBe(2);
      const pathKeys = res.criticalPaths.map((p) => p.taskIds.join("->"));
      expect(pathKeys).toContain("A->B->D");
      expect(pathKeys).toContain("A->C->D");
    });
  });

  // -------------------------------------------------------------
  // 5. Unknown Estimates Integrity (Never Coerced to 0)
  // -------------------------------------------------------------
  describe("5. Unknown Estimates Propagation & Incomplete Forecasts", () => {
    const project: RiskEngineProject = {
      startDate: "2026-03-02",
      evaluationDate: "2026-03-02",
    };

    it("surfaces unknown estimate at root and flags downstream chain as unknown", () => {
      const tasks: RiskEngineTask[] = [
        { id: "A", status: "TODO", remainingEstimateWorkdays: null }, // Unknown estimate!
        { id: "B", status: "TODO", remainingEstimateWorkdays: 3 },
        { id: "C", status: "TODO", remainingEstimateWorkdays: 4 }, // Separate known task
      ];

      const deps: RiskEngineDependency[] = [
        { blockerTaskId: "A", blockedTaskId: "B" },
      ];

      const res = calculateProjectRisk(project, tasks, deps);

      // Root task A has unknown forecast
      expect(res.schedules["A"].hasUnknownForecast).toBe(true);
      expect(res.schedules["A"].earlyFinish).toBeNull();
      expect(res.schedules["A"].unknownReason).toContain("estimate is missing");

      // Dependent task B inherits unknown forecast
      expect(res.schedules["B"].hasUnknownForecast).toBe(true);
      expect(res.schedules["B"].earlyStart).toBeNull();
      expect(res.schedules["B"].earlyFinish).toBeNull();
      expect(res.schedules["B"].unknownReason).toContain("unknown forecast");

      // Task C is known
      expect(res.schedules["C"].hasUnknownForecast).toBe(false);
      expect(res.schedules["C"].earlyFinish).toBe("2026-03-05");

      // Project forecast finish is null because terminal task B has unknown forecast
      expect(res.hasIncompleteForecast).toBe(true);
      expect(res.projectForecastFinish).toBeNull();
    });

    it("surfaces unknown estimate in the middle of a chain", () => {
      const tasks: RiskEngineTask[] = [
        { id: "A", status: "TODO", remainingEstimateWorkdays: 2 },
        { id: "B", status: "TODO", remainingEstimateWorkdays: undefined }, // Missing!
        { id: "C", status: "TODO", remainingEstimateWorkdays: 3 },
      ];

      const deps: RiskEngineDependency[] = [
        { blockerTaskId: "A", blockedTaskId: "B" },
        { blockerTaskId: "B", blockedTaskId: "C" },
      ];

      const res = calculateProjectRisk(project, tasks, deps);

      expect(res.schedules["A"].hasUnknownForecast).toBe(false);
      expect(res.schedules["A"].earlyFinish).toBe("2026-03-03");

      expect(res.schedules["B"].hasUnknownForecast).toBe(true);
      expect(res.schedules["C"].hasUnknownForecast).toBe(true);
      expect(res.hasIncompleteForecast).toBe(true);
    });
  });

  // -------------------------------------------------------------
  // 6. Task Status Handling (DONE, CANCELLED, IN_PROGRESS, TODO)
  // -------------------------------------------------------------
  describe("6. Task Status Handling (DONE, CANCELLED, IN_PROGRESS)", () => {
    const project: RiskEngineProject = {
      startDate: "2026-03-02",
      evaluationDate: "2026-03-09", // Evaluation is week 2 Monday
    };

    it("DONE blocker does not add delay; dependent starts on nextWorkday or evalDate", () => {
      const tasks: RiskEngineTask[] = [
        {
          id: "A",
          status: "DONE",
          actualFinishDate: "2026-03-04",
          remainingEstimateWorkdays: 0,
        },
        {
          id: "B",
          status: "TODO",
          remainingEstimateWorkdays: 3,
        },
      ];

      const deps: RiskEngineDependency[] = [
        { blockerTaskId: "A", blockedTaskId: "B" },
      ];

      const res = calculateProjectRisk(project, tasks, deps);
      // Since A finished on 2026-03-04 in the past, but evaluation date is 2026-03-09,
      // Task B's earliest start is the evaluation date (2026-03-09)
      expect(res.schedules["B"].earlyStart).toBe("2026-03-09");
      expect(res.schedules["B"].earlyFinish).toBe("2026-03-11");
      expect(res.schedules["B"].isBlocked).toBe(false);
    });

    it("CANCELLED blocker is excluded from active schedule and flagged for review", () => {
      const tasks: RiskEngineTask[] = [
        { id: "A", status: "CANCELLED", remainingEstimateWorkdays: 5 },
        { id: "B", status: "TODO", remainingEstimateWorkdays: 2 },
      ];

      const deps: RiskEngineDependency[] = [
        { blockerTaskId: "A", blockedTaskId: "B" },
      ];

      const res = calculateProjectRisk(project, tasks, deps);

      // B is NOT held up indefinitely by cancelled task A
      expect(res.schedules["B"].earlyStart).toBe("2026-03-09");
      expect(res.schedules["B"].earlyFinish).toBe("2026-03-10");
      expect(res.schedules["B"].isBlocked).toBe(false);

      // Flagged for human review
      expect(res.flaggedCancelledDependencies).toEqual([
        { blockerTaskId: "A", blockedTaskId: "B" },
      ]);
      expect(res.schedules["B"].cancelledBlockerIds).toContain("A");
    });

    it("marks TODO task as blocked when blocker is IN_PROGRESS or TODO", () => {
      const tasks: RiskEngineTask[] = [
        { id: "A", status: "IN_PROGRESS", remainingEstimateWorkdays: 2 },
        { id: "B", status: "TODO", remainingEstimateWorkdays: 3 },
      ];

      const deps: RiskEngineDependency[] = [
        { blockerTaskId: "A", blockedTaskId: "B" },
      ];

      const res = calculateProjectRisk(project, tasks, deps);
      expect(res.schedules["A"].isBlocked).toBe(false);
      expect(res.schedules["B"].isBlocked).toBe(true);
      expect(res.schedules["B"].activeBlockerIds).toContain("A");
    });
  });

  // -------------------------------------------------------------
  // 7. Edge Cases: Disconnected Graphs, Single Task, Future Start
  // -------------------------------------------------------------
  describe("7. Edge Cases", () => {
    it("handles a single task with no dependencies", () => {
      const project: RiskEngineProject = {
        startDate: "2026-03-02",
        evaluationDate: "2026-03-02",
        targetDate: "2026-03-05",
      };
      const tasks: RiskEngineTask[] = [
        { id: "SOLO", status: "TODO", remainingEstimateWorkdays: 2 },
      ];

      const res = calculateProjectRisk(project, tasks, []);
      expect(res.projectForecastFinish).toBe("2026-03-03");
      expect(res.criticalTaskIds).toEqual(["SOLO"]);
      expect(res.criticalPaths[0].taskIds).toEqual(["SOLO"]);
      expect(res.schedules["SOLO"].slackWorkdays).toBe(0);
    });

    it("handles completely disconnected subgraphs and aggregates maximum finish", () => {
      const project: RiskEngineProject = {
        startDate: "2026-03-02",
        evaluationDate: "2026-03-02",
      };
      const tasks: RiskEngineTask[] = [
        { id: "G1_A", status: "TODO", remainingEstimateWorkdays: 2 },
        { id: "G1_B", status: "TODO", remainingEstimateWorkdays: 2 }, // Finishes 2026-03-05 (4d)
        { id: "G2_A", status: "TODO", remainingEstimateWorkdays: 6 }, // Finishes 2026-03-09 (6d)
      ];
      const deps: RiskEngineDependency[] = [
        { blockerTaskId: "G1_A", blockedTaskId: "G1_B" },
      ];

      const res = calculateProjectRisk(project, tasks, deps);
      expect(res.projectForecastFinish).toBe("2026-03-09");
      expect(res.criticalTaskIds).toEqual(["G2_A"]); // G2_A is longer (6d vs 4d)
      expect(res.schedules["G1_B"].slackWorkdays).toBe(2);
    });

    it("handles project start date in the future", () => {
      const project: RiskEngineProject = {
        startDate: "2026-04-06", // Future date (Monday)
        evaluationDate: "2026-03-02",
      };
      const tasks: RiskEngineTask[] = [
        { id: "FUTURE", status: "TODO", remainingEstimateWorkdays: 3 },
      ];

      const res = calculateProjectRisk(project, tasks, []);
      expect(res.schedules["FUTURE"].earlyStart).toBe("2026-04-06");
      expect(res.schedules["FUTURE"].earlyFinish).toBe("2026-04-08");
    });
  });

  // -------------------------------------------------------------
  // 8. Downstream Impact & Delay Propagation
  // -------------------------------------------------------------
  describe("8. Downstream Impact Analysis", () => {
    const project: RiskEngineProject = {
      startDate: "2026-03-02",
      evaluationDate: "2026-03-02",
    };
    const tasks: RiskEngineTask[] = [
      { id: "A", status: "TODO", remainingEstimateWorkdays: 3 },
      { id: "B", status: "TODO", remainingEstimateWorkdays: 2 },
      { id: "C", status: "TODO", remainingEstimateWorkdays: 5 },
      { id: "D", status: "TODO", remainingEstimateWorkdays: 4 },
      {
        id: "E",
        status: "TODO",
        remainingEstimateWorkdays: 3,
        dueDate: "2026-03-12",
      },
    ];
    const deps: RiskEngineDependency[] = [
      { blockerTaskId: "A", blockedTaskId: "B" },
      { blockerTaskId: "B", blockedTaskId: "C" },
      { blockerTaskId: "D", blockedTaskId: "E" },
    ];

    it("delaying a critical task directly delays project finish", () => {
      const base = calculateProjectRisk(project, tasks, deps);
      const impact = calculateDownstreamImpact("A", base, tasks, deps, 2);

      expect(impact.affectedTaskIds).toEqual(
        expect.arrayContaining(["B", "C"]),
      );
      expect(impact.directDependentIds).toEqual(["B"]);
      expect(impact.criticalAffectedTaskIds).toEqual(
        expect.arrayContaining(["B", "C"]),
      );
      expect(impact.projectDelayWorkdays).toBe(2);
    });

    it("delaying a non-critical task consumes slack before delaying project", () => {
      const base = calculateProjectRisk(project, tasks, deps);
      // Task D has 3 days of slack
      expect(base.schedules["D"].slackWorkdays).toBe(3);

      // Delay by 2 workdays (within slack): 0 project delay
      const impact2 = calculateDownstreamImpact("D", base, tasks, deps, 2);
      expect(impact2.projectDelayWorkdays).toBe(0);

      // Delay by 5 workdays (exceeds 3 days slack by 2): 2 days project delay
      const impact5 = calculateDownstreamImpact("D", base, tasks, deps, 5);
      expect(impact5.projectDelayWorkdays).toBe(2);

      // E had due date 2026-03-12; slipping D by 5 pushes E past due date
      expect(impact5.newlyAtRiskTaskIds).toContain("E");
    });
  });

  // -------------------------------------------------------------
  // 9. In-Memory What-If Simulation
  // -------------------------------------------------------------
  describe("9. In-Memory What-If Simulation", () => {
    const project: RiskEngineProject = {
      startDate: "2026-03-02",
      evaluationDate: "2026-03-02",
    };
    const tasks: RiskEngineTask[] = [
      {
        id: "A",
        status: "TODO",
        remainingEstimateWorkdays: 3,
        dueDate: "2026-03-10",
      },
      {
        id: "B",
        status: "TODO",
        remainingEstimateWorkdays: 2,
        dueDate: "2026-03-10",
      },
    ];
    const deps: RiskEngineDependency[] = [
      { blockerTaskId: "A", blockedTaskId: "B" },
    ];

    it("simulates increased estimate and computes project finish delta without mutating inputs", () => {
      const originalEstimateA = tasks[0].remainingEstimateWorkdays;

      const sim = simulateWhatIf(project, tasks, deps, {
        modifyTasks: [
          { id: "A", remainingEstimateWorkdays: 6 }, // +3 workdays
        ],
      });

      // Verify immutability of original inputs
      expect(tasks[0].remainingEstimateWorkdays).toBe(originalEstimateA);

      // Verify baseline vs simulated deltas
      expect(sim.baseResult.projectForecastFinish).toBe("2026-03-06");
      expect(sim.simulatedResult.projectForecastFinish).toBe("2026-03-11");
      expect(sim.projectFinishDeltaWorkdays).toBe(3);

      // Task B finishes on 2026-03-11 in simulation, which exceeds its due date (2026-03-10)
      expect(sim.newlyAtRiskTaskIds).toContain("B");
    });

    it("simulates adding an edge and detects changes in critical path", () => {
      const baseTasks: RiskEngineTask[] = [
        { id: "A", status: "TODO", remainingEstimateWorkdays: 2 },
        { id: "B", status: "TODO", remainingEstimateWorkdays: 5 },
      ];

      // Initially independent: project finish is max(A, B) = 5 days (B)
      const sim = simulateWhatIf(project, baseTasks, [], {
        addDependencies: [{ blockerTaskId: "B", blockedTaskId: "A" }],
      });

      // After B -> A: project finish becomes 5 + 2 = 7 days
      expect(sim.baseResult.projectForecastFinish).toBe("2026-03-06");
      expect(sim.simulatedResult.projectForecastFinish).toBe("2026-03-10");
      expect(sim.projectFinishDeltaWorkdays).toBe(2);
      expect(sim.addedCriticalTaskIds).toContain("A");
    });
  });

  // -------------------------------------------------------------
  // 10. Performance Benchmark: 2,000 Tasks & 5,000 Edges
  // -------------------------------------------------------------
  describe("10. Performance Benchmark (2,000 Tasks, 5,000 Edges)", () => {
    it("executes full DAG validation, CPM, slack, and critical path within performance budget", () => {
      const TASK_COUNT = 2000;
      const EDGE_COUNT = 5000;

      const project: RiskEngineProject = {
        startDate: "2026-03-02",
        evaluationDate: "2026-03-02",
        targetDate: "2027-01-01",
      };

      // Generate 2,000 tasks
      const tasks: RiskEngineTask[] = [];
      for (let i = 0; i < TASK_COUNT; i++) {
        tasks.push({
          id: `task_${i}`,
          title: `Benchmark Task ${i}`,
          status: "TODO",
          remainingEstimateWorkdays: (i % 5) + 1, // 1 to 5 workdays
        });
      }

      // Generate 5,000 valid DAG edges (only forward edges i -> j where j > i)
      const dependencies: RiskEngineDependency[] = [];
      const edgeSet = new Set<string>();

      // Chain adjacent tasks to ensure connectedness
      for (let i = 0; i < TASK_COUNT - 1; i++) {
        dependencies.push({
          blockerTaskId: `task_${i}`,
          blockedTaskId: `task_${i + 1}`,
        });
        edgeSet.add(`${i}->${i + 1}`);
      }

      // Add cross-layer forward edges until 5,000 edges are reached
      let attempts = 0;
      while (dependencies.length < EDGE_COUNT && attempts < 20000) {
        attempts++;
        const u = Math.floor(Math.random() * (TASK_COUNT - 2));
        // pick v strictly greater than u to guarantee acyclicity
        const span = Math.min(50, TASK_COUNT - 1 - u);
        const v = u + 1 + Math.floor(Math.random() * span);
        const key = `${u}->${v}`;
        if (!edgeSet.has(key)) {
          edgeSet.add(key);
          dependencies.push({
            blockerTaskId: `task_${u}`,
            blockedTaskId: `task_${v}`,
          });
        }
      }

      expect(tasks.length).toBe(TASK_COUNT);
      expect(dependencies.length).toBe(EDGE_COUNT);

      // Measure execution time
      const startTime = performance.now();
      const result = calculateProjectRisk(project, tasks, dependencies);
      const durationMs = performance.now() - startTime;

      // Assertions
      expect(result.isAcyclic).toBe(true);
      expect(result.hasCycle).toBe(false);
      expect(result.projectForecastFinish).not.toBeNull();
      expect(result.criticalTaskIds.length).toBeGreaterThan(0);
      expect(Object.keys(result.schedules).length).toBe(TASK_COUNT);

      // Target: under 150ms (accommodating virtualized CI runner CPU throttling)
      console.log(
        `[Risk Engine Benchmark] Processed ${TASK_COUNT} tasks and ${EDGE_COUNT} dependencies in ${durationMs.toFixed(2)}ms`,
      );
      expect(durationMs).toBeLessThan(150);
    });
  });
});
