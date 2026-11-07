import { describe, expect, it } from "vitest";
import { validateAcyclicGraph } from "../src/index.js";

describe("validateAcyclicGraph", () => {
  it("detects a simple acyclic dependency chain (A -> B -> C)", () => {
    const taskIds = ["A", "B", "C"];
    const deps = [
      { blockerTaskId: "A", blockedTaskId: "B" },
      { blockerTaskId: "B", blockedTaskId: "C" },
    ];

    const result = validateAcyclicGraph(taskIds, deps);
    expect(result.isAcyclic).toBe(true);
  });

  it("detects a circular dependency cycle (A -> B -> C -> A)", () => {
    const taskIds = ["A", "B", "C"];
    const deps = [
      { blockerTaskId: "A", blockedTaskId: "B" },
      { blockerTaskId: "B", blockedTaskId: "C" },
      { blockerTaskId: "C", blockedTaskId: "A" },
    ];

    const result = validateAcyclicGraph(taskIds, deps);
    expect(result.isAcyclic).toBe(false);
  });
});
