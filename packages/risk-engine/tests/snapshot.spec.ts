import { describe, it, expect } from "vitest";
import {
  buildProjectSnapshot,
  verifyReportClaims,
  verifyReportSnapshotIntegrity,
  canonicalJsonStringify,
  computeDeterministicHash,
  ReportFact,
} from "../src/snapshot";
import { RiskEngineProject, RiskEngineTask, RiskEngineDependency } from "../src/types";

describe("Risk Engine — Snapshot & Claim Verifier", () => {
  const project: RiskEngineProject & { id: string; key: string; name: string } = {
    id: "proj-1",
    key: "DEL",
    name: "Delivery Intelligence",
    startDate: "2026-03-02",
    targetDate: "2026-03-20",
    evaluationDate: "2026-03-02",
    timezone: "UTC",
  };

  const tasks: (RiskEngineTask & { title: string; status: string })[] = [
    {
      id: "t-1",
      remainingEstimateWorkdays: 3,
      status: "DONE",
      title: "Architecture Plan",
    },
    {
      id: "t-2",
      remainingEstimateWorkdays: 5,
      status: "IN_PROGRESS",
      title: "Backend API",
    },
    {
      id: "t-3",
      remainingEstimateWorkdays: 4,
      status: "TODO",
      title: "Frontend Dashboard",
    },
  ];

  const dependencies: RiskEngineDependency[] = [
    { blockerTaskId: "t-1", blockedTaskId: "t-2" },
    { blockerTaskId: "t-2", blockedTaskId: "t-3" },
  ];

  it("builds a canonical project snapshot with deterministic 64-char SHA-256 digest", () => {
    const snapshot = buildProjectSnapshot(project, tasks, dependencies);

    expect(snapshot.projectId).toBe("proj-1");
    expect(snapshot.projectKey).toBe("DEL");
    expect(snapshot.totalTasks).toBe(3);
    expect(snapshot.completedTasks).toBe(1);
    expect(snapshot.inProgressTasks).toBe(1);
    expect(snapshot.todoTasks).toBe(1);
    expect(snapshot.blockedTasks).toBe(1);
    expect(snapshot.blockedTaskIds).toEqual(["t-3"]);

    // SHA-256 hex digest is exactly 64 characters
    expect(snapshot.snapshotHash).toMatch(/^[a-f0-9]{64}$/);

    // Verify facts exist
    const forecastFact = snapshot.facts.find((f) => f.type === "FORECAST_DATE");
    expect(forecastFact).toBeDefined();
    expect(forecastFact?.value).toBe(snapshot.forecastDate);
  });

  it("produces identical SHA-256 hash regardless of object key insertion order (canonical JSON)", () => {
    const objA = { z: 1, a: "hello", m: [3, 2, 1], b: { y: true, x: false } };
    const objB = { a: "hello", b: { x: false, y: true }, m: [3, 2, 1], z: 1 };

    expect(canonicalJsonStringify(objA)).toBe(canonicalJsonStringify(objB));
    expect(computeDeterministicHash(objA)).toBe(computeDeterministicHash(objB));
  });

  it("verifies cryptographic snapshot integrity passes for untampered snapshot", () => {
    const snapshot = buildProjectSnapshot(project, tasks, dependencies);
    const integrity = verifyReportSnapshotIntegrity(snapshot);

    expect(integrity.valid).toBe(true);
    expect(integrity.error).toBeUndefined();
  });

  it("detects and rejects tampered snapshot data (e.g. modified forecast date)", () => {
    const snapshot = buildProjectSnapshot(project, tasks, dependencies);

    // Tamper with snapshot forecast date while keeping original hash
    const tamperedSnapshot = {
      ...snapshot,
      forecastDate: "2026-12-31",
    };

    const integrity = verifyReportSnapshotIntegrity(tamperedSnapshot);
    expect(integrity.valid).toBe(false);
    expect(integrity.error).toContain("Snapshot integrity violation");

    // verifyReportClaims should also fail closed
    const claimResult = verifyReportClaims(tamperedSnapshot, tamperedSnapshot.facts);
    expect(claimResult.valid).toBe(false);
    expect(claimResult.errors.some((e) => e.includes("Snapshot integrity violation"))).toBe(true);
  });

  it("verifies grounded, authoritative claims successfully", () => {
    const snapshot = buildProjectSnapshot(project, tasks, dependencies);
    const verification = verifyReportClaims(snapshot, snapshot.facts);

    expect(verification.valid).toBe(true);
    expect(verification.errors).toHaveLength(0);
    expect(verification.verifiedClaimsCount).toBe(snapshot.facts.length);
  });

  it("rejects claims that cite a foreign/cross-tenant entity ID", () => {
    const snapshot = buildProjectSnapshot(project, tasks, dependencies);
    const corruptedClaims: ReportFact[] = [
      {
        id: "claim-foreign",
        type: "FORECAST_DATE",
        claim: "Forecast verified",
        value: snapshot.forecastDate,
        evidenceIds: ["foreign-task-999"], // Not in snapshot
      },
    ];

    const result = verifyReportClaims(snapshot, corruptedClaims);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("Citation violation"))).toBe(true);
  });

  it("rejects claims with hallucinated forecast dates", () => {
    const snapshot = buildProjectSnapshot(project, tasks, dependencies);
    const hallucinatedClaims: ReportFact[] = [
      {
        id: "claim-hallucinated-date",
        type: "FORECAST_DATE",
        claim: "Project will finish on 2026-12-31",
        value: "2026-12-31", // Different from ground truth
        evidenceIds: snapshot.criticalPathTaskIds,
      },
    ];

    const result = verifyReportClaims(snapshot, hallucinatedClaims);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("Forecast date mismatch"))).toBe(true);
  });

  it("rejects claims with inaccurate critical path assertions", () => {
    const snapshot = buildProjectSnapshot(project, tasks, dependencies);
    const invalidCriticalClaims: ReportFact[] = [
      {
        id: "claim-bad-critical",
        type: "CRITICAL_PATH",
        claim: "Task t-1 is on critical path",
        value: ["t-1", "non-existent-task"],
        evidenceIds: ["t-1"],
      },
    ];

    const result = verifyReportClaims(snapshot, invalidCriticalClaims);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("Critical path violation"))).toBe(true);
  });

  it("fails closed on empty claims array", () => {
    const snapshot = buildProjectSnapshot(project, tasks, dependencies);
    const result = verifyReportClaims(snapshot, []);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("zero claims");
  });
});
