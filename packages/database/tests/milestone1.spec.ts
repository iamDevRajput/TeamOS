import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { Pool } from "pg";
import {
  withTenant,
  TenantContext,
  createWorkerPrismaClient,
  claimNextOutboxEvent,
  completeOutboxEvent,
  failOutboxEvent,
} from "../src/index";

// Database URLs for real non-owner runtime roles
const API_DB_URL =
  process.env.DATABASE_URL ||
  "postgresql://teamos_api_role:teamos_api_password@localhost:5432/teamos?schema=public";

const WORKER_DB_URL =
  process.env.DATABASE_URL_WORKER ||
  "postgresql://teamos_worker_role:teamos_worker_password@localhost:5432/teamos?schema=public";

const MIGRATION_DB_URL =
  process.env.DATABASE_URL_MIGRATION ||
  "postgresql://teamos_owner:teamos_owner_password@localhost:5432/teamos?schema=public";

describe("Milestone 1: Database Architecture, Multi-Tenant RLS & Outbox Lifecycle", () => {
  let ownerPool: Pool;
  let apiPool: Pool;
  let workerPrisma: ReturnType<typeof createWorkerPrismaClient>;

  // Test UUIDs
  const orgAId = "a0000000-0000-0000-0000-000000000001";
  const orgBId = "b0000000-0000-0000-0000-000000000002";
  const user1Id = "10000000-0000-0000-0000-000000000001";
  const user2Id = "20000000-0000-0000-0000-000000000002";
  const userExternalId = "90000000-0000-0000-0000-000000000009";

  beforeAll(async () => {
    ownerPool = new Pool({ connectionString: MIGRATION_DB_URL });
    apiPool = new Pool({ connectionString: API_DB_URL });
    workerPrisma = createWorkerPrismaClient(WORKER_DB_URL);

    // Clean test state using owner role (scoped to test fixtures only to preserve real user workspaces)
    await ownerPool.query(`
      DELETE FROM public.outbox_events WHERE org_id IN ('${orgAId}', '${orgBId}');
      DELETE FROM public.audit_events WHERE org_id IN ('${orgAId}', '${orgBId}');
      DELETE FROM public.github_repositories WHERE org_id IN ('${orgAId}', '${orgBId}');
      DELETE FROM public.github_installations WHERE org_id IN ('${orgAId}', '${orgBId}');
      DELETE FROM public.ai_budget_reservations WHERE org_id IN ('${orgAId}', '${orgBId}');
      DELETE FROM public.task_dependencies WHERE org_id IN ('${orgAId}', '${orgBId}');
      DELETE FROM public.tasks WHERE org_id IN ('${orgAId}', '${orgBId}');
      DELETE FROM public.projects WHERE org_id IN ('${orgAId}', '${orgBId}');
      DELETE FROM public.memberships WHERE org_id IN ('${orgAId}', '${orgBId}');
      DELETE FROM public.organizations WHERE id IN ('${orgAId}', '${orgBId}');
      DELETE FROM public.users WHERE id IN ('${user1Id}', '${user2Id}', '${userExternalId}', '30000000-0000-0000-0000-000000000003');
    `);

    // Bootstrap baseline test records
    await ownerPool.query(`
      INSERT INTO public.users (id, github_user_id, login, display_name) VALUES
        ('${user1Id}', 1001, 'user-one', 'User One'),
        ('${user2Id}', 1002, 'user-two', 'User Two'),
        ('${userExternalId}', 1009, 'user-ext', 'External User');

      INSERT INTO public.organizations (id, name, slug) VALUES
        ('${orgAId}', 'Org Alpha', 'org-alpha'),
        ('${orgBId}', 'Org Beta', 'org-beta');

      -- user1 is member in Org A; user2 is member in Org B
      INSERT INTO public.memberships (org_id, user_id, role) VALUES
        ('${orgAId}', '${user1Id}', 'OWNER'),
        ('${orgBId}', '${user2Id}', 'OWNER');

      -- Project A in Org A, Project B in Org B
      INSERT INTO public.projects (id, org_id, key, name, created_by) VALUES
        ('a1111111-1111-1111-1111-111111111111', '${orgAId}', 'ALPHA', 'Alpha Core', '${user1Id}'),
        ('b2222222-2222-2222-2222-222222222222', '${orgBId}', 'BETA', 'Beta Core', '${user2Id}');
    `);
  });

  afterAll(async () => {
    await ownerPool.end();
    await apiPool.end();
    await workerPrisma.$disconnect();
  });

  // 1. withTenant Parameterization & GUC Verification
  it("1. withTenant sets transaction-local app.org_id and app.user_id via parameterized $queryRaw", async () => {
    const context: TenantContext = {
      orgId: orgAId,
      userId: user1Id,
      role: "OWNER",
    };

    const gucs = await withTenant(context, async (tx) => {
      const orgGuc = await tx.$queryRaw<
        { current_setting: string }[]
      >`SELECT current_setting('app.org_id', true)`;
      const userGuc = await tx.$queryRaw<
        { current_setting: string }[]
      >`SELECT current_setting('app.user_id', true)`;
      return {
        org: orgGuc[0].current_setting,
        user: userGuc[0].current_setting,
      };
    });

    expect(gucs.org).toBe(orgAId);
    expect(gucs.user).toBe(user1Id);
  });

  // 2. Tenant Read/Write Isolation via withTenant
  it("2. Tenant A cannot read, update, or delete Tenant B records under teamos_api_role", async () => {
    const contextA: TenantContext = { orgId: orgAId, userId: user1Id };
    const contextB: TenantContext = { orgId: orgBId, userId: user2Id };

    // Tenant B creates a task
    const taskB = await withTenant(contextB, async (tx) => {
      return tx.task.create({
        data: {
          orgId: orgBId,
          projectId: "b2222222-2222-2222-2222-222222222222",
          number: 1,
          title: "Secret Beta Task",
          createdBy: user2Id,
        },
      });
    });

    expect(taskB.title).toBe("Secret Beta Task");

    // Tenant A attempts to read Tenant B's tasks -> must return empty array
    const tasksSeenByA = await withTenant(contextA, async (tx) => {
      return tx.task.findMany({
        where: { id: taskB.id },
      });
    });
    expect(tasksSeenByA.length).toBe(0);

    // Tenant A attempts to update Tenant B's task -> throws P2025 (Record not found)
    await expect(
      withTenant(contextA, async (tx) => {
        return tx.task.update({
          where: { id: taskB.id },
          data: { title: "Compromised Task" },
        });
      }),
    ).rejects.toThrow();

    // Verify Tenant B's task was NOT updated
    const taskBAfter = await withTenant(contextB, async (tx) => {
      return tx.task.findUnique({ where: { id: taskB.id } });
    });
    expect(taskBAfter?.title).toBe("Secret Beta Task");
  });

  // 3. Fail-Closed Test (Absent / invalid tenant context returns 0 rows)
  it("3. Executing queries with absent tenant context returns 0 rows (Fails Closed)", async () => {
    // Connect directly as teamos_api_role without setting app.org_id
    const client = await apiPool.connect();
    try {
      const result = await client.query("SELECT * FROM public.tasks");
      expect(result.rows.length).toBe(0);

      const orgs = await client.query("SELECT * FROM public.organizations");
      expect(orgs.rows.length).toBe(0);
    } finally {
      client.release();
    }
  });

  // 4. PostgreSQL 16 Partial ON DELETE SET NULL (assignee_id)
  it("4. PostgreSQL 16 partial SET NULL: deleting a membership sets assignee_id=NULL while keeping org_id intact", async () => {
    const contextA: TenantContext = { orgId: orgAId, userId: user1Id };

    // Add temporary member in Org A
    const tempUserId = "30000000-0000-0000-0000-000000000003";
    await ownerPool.query(`
      INSERT INTO public.users (id, github_user_id, login) VALUES ('${tempUserId}', 1003, 'temp-user');
      INSERT INTO public.memberships (org_id, user_id) VALUES ('${orgAId}', '${tempUserId}');
    `);

    // Create a task assigned to tempUser in Org A
    const task = await withTenant(contextA, async (tx) => {
      return tx.task.create({
        data: {
          orgId: orgAId,
          projectId: "a1111111-1111-1111-1111-111111111111",
          number: 10,
          title: "Assigned to Temp User",
          assigneeId: tempUserId,
          createdBy: user1Id,
        },
      });
    });

    expect(task.assigneeId).toBe(tempUserId);
    expect(task.orgId).toBe(orgAId);

    // Delete the membership of tempUser in Org A
    await withTenant(contextA, async (tx) => {
      await tx.membership.delete({
        where: {
          orgId_userId: {
            orgId: orgAId,
            userId: tempUserId,
          },
        },
      });
    });

    // Verify task is still in Org A, but assignee_id is now NULL
    const updatedTask = await withTenant(contextA, async (tx) => {
      return tx.task.findUnique({ where: { id: task.id } });
    });

    expect(updatedTask).not.toBeNull();
    expect(updatedTask!.orgId).toBe(orgAId);
    expect(updatedTask!.assigneeId).toBeNull();
  });

  // 5. Cross-Tenant Composite Foreign Key Rejection
  it("5. Cross-tenant foreign key: creating a task in Org A referencing a project in Org B fails FK constraint", async () => {
    const contextA: TenantContext = { orgId: orgAId, userId: user1Id };

    await expect(
      withTenant(contextA, async (tx) => {
        return tx.task.create({
          data: {
            orgId: orgAId,
            projectId: "b2222222-2222-2222-2222-222222222222", // Org B project!
            number: 99,
            title: "Illegal Cross-Tenant Task",
            createdBy: user1Id,
          },
        });
      }),
    ).rejects.toThrow();
  });

  // 6. Assignee Membership Validation
  it("6. Assignee membership: assigning task in Org A to external user (not in Org A) fails FK constraint", async () => {
    const contextA: TenantContext = { orgId: orgAId, userId: user1Id };

    await expect(
      withTenant(contextA, async (tx) => {
        return tx.task.create({
          data: {
            orgId: orgAId,
            projectId: "a1111111-1111-1111-1111-111111111111",
            number: 101,
            title: "Task Assigned to Non-Member",
            assigneeId: userExternalId, // Not a member in Org A!
            createdBy: user1Id,
          },
        });
      }),
    ).rejects.toThrow();
  });

  // 7. Audit Events Append-Only Enforcement
  it("7. Audit events: teamos_api_role can INSERT audit row, but UPDATE or DELETE throws permission denied", async () => {
    const contextA: TenantContext = { orgId: orgAId, userId: user1Id };

    // Insert an audit event via withTenant
    const audit = await withTenant(contextA, async (tx) => {
      return tx.auditEvent.create({
        data: {
          orgId: orgAId,
          actorType: "USER",
          actorId: user1Id,
          action: "PROJECT_CREATED",
          entityType: "PROJECT",
          entityId: "a1111111-1111-1111-1111-111111111111",
        },
      });
    });

    expect(audit.id).toBeDefined();

    // Attempting to UPDATE audit event as teamos_api_role must fail
    const client = await apiPool.connect();
    try {
      await client.query(`SELECT set_config('app.org_id', '${orgAId}', true)`);
      await expect(
        client.query(
          `UPDATE public.audit_events SET action = 'TAMPERED' WHERE id = '${audit.id}'`,
        ),
      ).rejects.toThrow(/permission denied/);

      // Attempting to DELETE audit event as teamos_api_role must fail
      await expect(
        client.query(
          `DELETE FROM public.audit_events WHERE id = '${audit.id}'`,
        ),
      ).rejects.toThrow(/permission denied/);
    } finally {
      client.release();
    }
  });

  // 8. Worker Competing Claims & FOR UPDATE SKIP LOCKED
  it("8. Outbox worker: claim_next_outbox_event atomically claims jobs and locks by workerId", async () => {
    await ownerPool.query("DELETE FROM public.outbox_events;");
    const contextA: TenantContext = { orgId: orgAId, userId: user1Id };

    // API creates an outbox event
    await withTenant(contextA, async (tx) => {
      return tx.outboxEvent.create({
        data: {
          orgId: orgAId,
          type: "TASK_CREATED",
          payload: { taskId: "dummy-task-id" },
          dedupeKey: "task-created-1",
          availableAt: new Date(Date.now() - 5000),
        },
      });
    });

    // Worker claims the event
    const worker1Id = "worker-node-1";
    const claimed = await claimNextOutboxEvent(workerPrisma, worker1Id, 30);

    expect(claimed).not.toBeNull();
    expect(claimed!.org_id).toBe(orgAId);
    expect(claimed!.type).toBe("TASK_CREATED");
    expect(claimed!.lease_token).toBeDefined();
    expect(claimed!.lease_token).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );

    // A second worker attempting to claim receives null (because 1st is locked)
    const worker2Id = "worker-node-2";
    const secondClaim = await claimNextOutboxEvent(workerPrisma, worker2Id, 30);
    expect(secondClaim).toBeNull();

    // Worker 1 completes the job using matching workerId and leaseToken
    const completed = await completeOutboxEvent(
      workerPrisma,
      claimed!.id,
      worker1Id,
      claimed!.lease_token,
    );
    expect(completed).toBe(true);
  });

  // 9. Unauthorized Outbox Completion Rejection
  it("9. Unauthorized completion: worker B or mismatched lease token cannot complete a job", async () => {
    await ownerPool.query("DELETE FROM public.outbox_events;");
    const contextA: TenantContext = { orgId: orgAId, userId: user1Id };

    await withTenant(contextA, async (tx) => {
      return tx.outboxEvent.create({
        data: {
          orgId: orgAId,
          type: "SEND_NOTIFICATION",
          payload: { note: "test" },
          dedupeKey: "notif-1",
          availableAt: new Date(Date.now() - 5000),
        },
      });
    });

    const claimed = await claimNextOutboxEvent(
      workerPrisma,
      "worker-alpha",
      30,
    );
    expect(claimed).not.toBeNull();

    // 1. Impostor worker with legitimate token fails
    const impostorCompleted = await completeOutboxEvent(
      workerPrisma,
      claimed!.id,
      "worker-impostor",
      claimed!.lease_token,
    );
    expect(impostorCompleted).toBe(false);

    // 2. Legitimate worker with wrong lease token fails
    const wrongTokenCompleted = await completeOutboxEvent(
      workerPrisma,
      claimed!.id,
      "worker-alpha",
      "00000000-0000-0000-0000-000000000000",
    );
    expect(wrongTokenCompleted).toBe(false);

    // 3. Legitimate worker with legitimate token completes
    const legitCompleted = await completeOutboxEvent(
      workerPrisma,
      claimed!.id,
      "worker-alpha",
      claimed!.lease_token,
    );
    expect(legitCompleted).toBe(true);
  });

  // 10. Expired Lease Recovery & Stale Worker Rejection
  it("10. Expired lease recovery: event past locked_until is reclaimed by next worker; stale worker cannot complete or fail", async () => {
    await ownerPool.query("DELETE FROM public.outbox_events;");
    const contextA: TenantContext = { orgId: orgAId, userId: user1Id };

    await withTenant(contextA, async (tx) => {
      return tx.outboxEvent.create({
        data: {
          orgId: orgAId,
          type: "EXPIRING_JOB",
          payload: { run: true },
          dedupeKey: "expiring-1",
          availableAt: new Date(Date.now() - 5000),
        },
      });
    });

    // Worker 1 claims with 5s lease
    const claimed1 = await claimNextOutboxEvent(
      workerPrisma,
      "crashed-worker",
      5,
    );
    expect(claimed1).not.toBeNull();
    const staleToken = claimed1!.lease_token;

    // Fast-forward locked_until into the past to simulate worker crash
    await ownerPool.query(`
      UPDATE public.outbox_events
      SET locked_until = NOW() - INTERVAL '1 second'
      WHERE id = '${claimed1!.id}'
    `);

    // Recovery worker reclaims it and gets a NEW lease token
    const reclaimed = await claimNextOutboxEvent(
      workerPrisma,
      "recovery-worker",
      30,
    );
    expect(reclaimed).not.toBeNull();
    expect(reclaimed!.id).toBe(claimed1!.id);
    expect(reclaimed!.attempts).toBe(2);
    expect(reclaimed!.lease_token).not.toBe(staleToken);

    // Stale worker tries to complete with old lease token -> must fail
    const staleCompleted = await completeOutboxEvent(
      workerPrisma,
      claimed1!.id,
      "crashed-worker",
      staleToken,
    );
    expect(staleCompleted).toBe(false);

    // Stale worker tries to fail with old lease token -> must return STALE_LEASE_OR_UNAUTHORIZED
    const staleFailed = await failOutboxEvent(
      workerPrisma,
      claimed1!.id,
      "crashed-worker",
      staleToken,
      "Stale attempt error",
    );
    expect(staleFailed).toBe("STALE_LEASE_OR_UNAUTHORIZED");

    // Recovery worker completes successfully with new lease token
    const recoveryCompleted = await completeOutboxEvent(
      workerPrisma,
      reclaimed!.id,
      "recovery-worker",
      reclaimed!.lease_token,
    );
    expect(recoveryCompleted).toBe(true);
  });

  // 11. Retry and Dead-Letter State Transition
  it("11. Outbox retry and dead-letter: failing an event increments attempts and transitions to DEAD at max", async () => {
    await ownerPool.query("DELETE FROM public.outbox_events;");
    const contextA: TenantContext = { orgId: orgAId, userId: user1Id };

    await withTenant(contextA, async (tx) => {
      return tx.outboxEvent.create({
        data: {
          orgId: orgAId,
          type: "DOOMED_JOB",
          payload: { fails: true },
          dedupeKey: "doomed-1",
          maxAttempts: 2, // low max attempts for test
          availableAt: new Date(Date.now() - 5000),
        },
      });
    });

    // 1st attempt: fail -> status should be PENDING (with backoff)
    const claimed1 = await claimNextOutboxEvent(
      workerPrisma,
      "worker-tester",
      30,
    );
    expect(claimed1).not.toBeNull();
    const failStatus1 = await failOutboxEvent(
      workerPrisma,
      claimed1!.id,
      "worker-tester",
      claimed1!.lease_token,
      "Temporary error",
    );
    expect(failStatus1).toBe("PENDING");

    // Fast-forward available_at
    await ownerPool.query(
      `UPDATE public.outbox_events SET available_at = NOW() - INTERVAL '1 second' WHERE id = '${claimed1!.id}'`,
    );

    // 2nd attempt: reaches maxAttempts (2) -> status must be DEAD
    const claimed2 = await claimNextOutboxEvent(
      workerPrisma,
      "worker-tester",
      30,
    );
    expect(claimed2).not.toBeNull();
    expect(claimed2!.attempts).toBe(2);
    const failStatus2 = await failOutboxEvent(
      workerPrisma,
      claimed2!.id,
      "worker-tester",
      claimed2!.lease_token,
      "Final failure",
    );
    expect(failStatus2).toBe("DEAD");

    // Confirm error was safely stored in database
    const finalEvent = await ownerPool.query(
      `SELECT status, last_error FROM public.outbox_events WHERE id = '${claimed1!.id}'`,
    );
    expect(finalEvent.rows[0].status).toBe("DEAD");
    expect(finalEvent.rows[0].last_error).toBe("Final failure");
  });

  // 12. Security Boundary: teamos_api_role cannot call claim_next_outbox_event or run DDL
  it("12. Security privileges: teamos_api_role cannot execute claim function or run DDL", async () => {
    const client = await apiPool.connect();
    try {
      // API role cannot call claim function
      await expect(
        client.query(
          "SELECT * FROM public.claim_next_outbox_event('api-worker', 30)",
        ),
      ).rejects.toThrow(/permission denied/);

      // API role cannot run DDL
      await expect(
        client.query("CREATE TABLE public.malicious (id int)"),
      ).rejects.toThrow(/permission denied/);
    } finally {
      client.release();
    }
  });

  // 13. Atomic Failure Handling on Expired Lease
  it("13. Atomic failure handling: failing an event with expired lease returns STALE_LEASE_OR_UNAUTHORIZED and leaves event untouched", async () => {
    await ownerPool.query("DELETE FROM public.outbox_events;");
    const contextA: TenantContext = { orgId: orgAId, userId: user1Id };

    await withTenant(contextA, async (tx) => {
      return tx.outboxEvent.create({
        data: {
          orgId: orgAId,
          type: "EXPIRED_FAIL_JOB",
          payload: { test: true },
          dedupeKey: "expired-fail-1",
          availableAt: new Date(Date.now() - 5000),
        },
      });
    });

    const claimed = await claimNextOutboxEvent(workerPrisma, "worker-slow", 5);
    expect(claimed).not.toBeNull();

    // Expire lease
    await ownerPool.query(`
      UPDATE public.outbox_events
      SET locked_until = NOW() - INTERVAL '5 seconds'
      WHERE id = '${claimed!.id}'
    `);

    // Worker attempts to fail with expired lease
    const result = await failOutboxEvent(
      workerPrisma,
      claimed!.id,
      "worker-slow",
      claimed!.lease_token,
      "Slow worker failure",
    );
    expect(result).toBe("STALE_LEASE_OR_UNAUTHORIZED");

    // Event must still be in PROCESSING status with locked_by set
    const dbEvent = await ownerPool.query(
      `SELECT status, locked_by, last_error FROM public.outbox_events WHERE id = '${claimed!.id}'`,
    );
    expect(dbEvent.rows[0].status).toBe("PROCESSING");
    expect(dbEvent.rows[0].locked_by).toBe("worker-slow");
    expect(dbEvent.rows[0].last_error).toBeNull();
  });

  // 14. Crash Recovery at Max Attempts (Sweep to DEAD)
  it("14. Crash recovery: expired PROCESSING event that already reached max_attempts transitions to DEAD upon next claim sweep", async () => {
    await ownerPool.query("DELETE FROM public.outbox_events;");
    const contextA: TenantContext = { orgId: orgAId, userId: user1Id };

    await withTenant(contextA, async (tx) => {
      return tx.outboxEvent.create({
        data: {
          orgId: orgAId,
          type: "CRASH_JOB",
          payload: { crash: true },
          dedupeKey: "crash-1",
          maxAttempts: 2,
          availableAt: new Date(Date.now() - 5000),
        },
      });
    });

    // Claim 1 (attempts = 1)
    const claimed1 = await claimNextOutboxEvent(
      workerPrisma,
      "worker-crasher-1",
      5,
    );
    expect(claimed1).not.toBeNull();
    expect(claimed1!.attempts).toBe(1);

    // Simulate crash 1
    await ownerPool.query(`
      UPDATE public.outbox_events
      SET locked_until = NOW() - INTERVAL '1 second'
      WHERE id = '${claimed1!.id}'
    `);

    // Claim 2 (attempts = 2 = maxAttempts)
    const claimed2 = await claimNextOutboxEvent(
      workerPrisma,
      "worker-crasher-2",
      5,
    );
    expect(claimed2).not.toBeNull();
    expect(claimed2!.attempts).toBe(2);

    // Simulate crash 2 (lease expires while attempts >= maxAttempts)
    await ownerPool.query(`
      UPDATE public.outbox_events
      SET locked_until = NOW() - INTERVAL '1 second'
      WHERE id = '${claimed2!.id}'
    `);

    // Another worker calls claim_next_outbox_event.
    // The sweep inside claim_next_outbox_event must move the crashed event to DEAD.
    const claimed3 = await claimNextOutboxEvent(
      workerPrisma,
      "worker-sweep-trigger",
      30,
    );
    // There are no other available jobs, so claimed3 is null
    expect(claimed3).toBeNull();

    // Verify the crashed event was transitioned to DEAD by the sweep
    const deadEvent = await ownerPool.query(
      `SELECT status, attempts, locked_by, lease_token, last_error FROM public.outbox_events WHERE id = '${claimed2!.id}'`,
    );
    expect(deadEvent.rows[0].status).toBe("DEAD");
    expect(deadEvent.rows[0].attempts).toBe(2);
    expect(deadEvent.rows[0].locked_by).toBeNull();
    expect(deadEvent.rows[0].lease_token).toBeNull();
    expect(deadEvent.rows[0].last_error).toContain(
      "Exhausted maximum retry attempts",
    );
  });

  // 15. Error Sanitization & Redaction
  it("15. Error redaction: sensitive credentials, JWTs, API tokens, and passwords are fully redacted from last_error", async () => {
    await ownerPool.query("DELETE FROM public.outbox_events;");
    const contextA: TenantContext = { orgId: orgAId, userId: user1Id };

    await withTenant(contextA, async (tx) => {
      return tx.outboxEvent.create({
        data: {
          orgId: orgAId,
          type: "SENSITIVE_JOB",
          payload: { leak: false },
          dedupeKey: "sensitive-1",
          maxAttempts: 1, // Will die on first failure
          availableAt: new Date(Date.now() - 5000),
        },
      });
    });

    const claimed = await claimNextOutboxEvent(
      workerPrisma,
      "worker-redactor",
      30,
    );
    expect(claimed).not.toBeNull();

    const dirtyError =
      "Failed DB connect postgresql://admin:super_secret_pw@postgres-db:5432/team with " +
      "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.doNotLeakThisToken and " +
      'github_pat_11ABCDEFG123456789012345 and {"password": "confidential_pass"} and token=secret_val_123';

    await failOutboxEvent(
      workerPrisma,
      claimed!.id,
      "worker-redactor",
      claimed!.lease_token,
      dirtyError,
    );

    const saved = await ownerPool.query(
      `SELECT last_error FROM public.outbox_events WHERE id = '${claimed!.id}'`,
    );
    const lastError: string = saved.rows[0].last_error;

    // Verify all sensitive items were scrubbed
    expect(lastError).not.toContain("super_secret_pw");
    expect(lastError).not.toContain("doNotLeakThisToken");
    expect(lastError).not.toContain("github_pat_11ABCDEFG123456789012345");
    expect(lastError).not.toContain("confidential_pass");
    expect(lastError).not.toContain("secret_val_123");

    expect(lastError).toContain(
      "postgresql://admin:[REDACTED]@postgres-db:5432/team",
    );
    expect(lastError).toContain("Bearer [REDACTED]");
    expect(lastError).toContain("[REDACTED_TOKEN]");
    expect(lastError).toContain("[REDACTED]");
  });

  // 16. Outbox Tenant Isolation and Role Permissions
  it("16. Outbox tenant isolation & permissions: teamos_api_role only sees own tenant events and cannot browse cross-tenant or execute claim", async () => {
    await ownerPool.query("DELETE FROM public.outbox_events;");
    const contextA: TenantContext = { orgId: orgAId, userId: user1Id };
    const contextB: TenantContext = { orgId: orgBId, userId: user2Id };

    // Org A inserts an outbox event
    await withTenant(contextA, async (tx) => {
      return tx.outboxEvent.create({
        data: {
          orgId: orgAId,
          type: "EVENT_A",
          payload: { tenant: "A" },
          dedupeKey: "tenant-a-event",
        },
      });
    });

    // Org B inserts an outbox event
    await withTenant(contextB, async (tx) => {
      return tx.outboxEvent.create({
        data: {
          orgId: orgBId,
          type: "EVENT_B",
          payload: { tenant: "B" },
          dedupeKey: "tenant-b-event",
        },
      });
    });

    // API role under Org A context: sees ONLY Org A event (1 row), 0 from Org B
    const eventsA = await withTenant(contextA, async (tx) => {
      return tx.outboxEvent.findMany();
    });
    expect(eventsA.length).toBe(1);
    expect(eventsA[0].type).toBe("EVENT_A");

    // API role under Org B context: sees ONLY Org B event (1 row), 0 from Org A
    const eventsB = await withTenant(contextB, async (tx) => {
      return tx.outboxEvent.findMany();
    });
    expect(eventsB.length).toBe(1);
    expect(eventsB[0].type).toBe("EVENT_B");

    // API role without tenant context: returns 0 rows (fails closed)
    const client = await apiPool.connect();
    try {
      const emptyResult = await client.query(
        "SELECT count(*) FROM public.outbox_events",
      );
      expect(Number(emptyResult.rows[0].count)).toBe(0);

      // API role cannot UPDATE or DELETE outbox events
      await client.query(`SELECT set_config('app.org_id', '${orgAId}', true)`);
      await expect(
        client.query("UPDATE public.outbox_events SET status = 'COMPLETED'"),
      ).rejects.toThrow(/permission denied/);
      await expect(
        client.query("DELETE FROM public.outbox_events"),
      ).rejects.toThrow(/permission denied/);
    } finally {
      client.release();
    }

    // Worker role cannot directly SELECT outbox events
    const workerClient = new Pool({ connectionString: WORKER_DB_URL });
    try {
      await expect(
        workerClient.query("SELECT * FROM public.outbox_events"),
      ).rejects.toThrow(/permission denied/);
    } finally {
      await workerClient.end();
    }
  });
});
