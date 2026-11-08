import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { Pool } from 'pg';
import crypto from 'crypto';
import {
  createApiPrismaClient,
  createOrganization,
  reserveAiBudget,
  settleAiBudget,
  releaseAiBudget,
  markAiBudgetAwaitingReconciliation,
  getOrganizationAiBudgetSummary,
  listAuditEvents,
  OrgRole,
  TenantContext,
  AiReservationState,
} from '../src/index';

const API_DB_URL =
  process.env.DATABASE_URL ||
  'postgresql://teamos_api_role:teamos_api_password@localhost:5432/teamos?schema=public';

const OWNER_DB_URL =
  process.env.DATABASE_URL_MIGRATION ||
  'postgresql://teamos_owner:teamos_owner_password@localhost:5432/teamos?schema=public';

describe('AI Budget, Reservation & Accounting Specification (Gap 1)', () => {
  let apiPrisma: ReturnType<typeof createApiPrismaClient>;
  let ownerPool: Pool;

  const testUserId = '96000000-0000-0000-0000-000000000001';
  let orgId: string;
  let context: TenantContext;
  let run1ReservationId: string;
  let runIdempotentReservationId: string;

  beforeAll(async () => {
    apiPrisma = createApiPrismaClient(API_DB_URL);
    ownerPool = new Pool({ connectionString: OWNER_DB_URL });
    await apiPrisma.$connect();

    // Ensure user exists
    await ownerPool.query(`
      INSERT INTO public.users (id, github_user_id, login, display_name)
      VALUES ('${testUserId}', 9601, 'ai-budget-tester', 'AI Budget Tester')
      ON CONFLICT (id) DO NOTHING;
    `);

    // Create organization with $1.00 (100 cents) monthly budget
    const slug = `ai-budget-org-${crypto.randomBytes(4).toString('hex')}`;
    const orgResult = await createOrganization(
      apiPrisma,
      testUserId,
      'AI Budget Test Org',
      slug,
    );
    orgId = orgResult.organization.id;

    // Grant 100 cents budget for testing
    await ownerPool.query(`
      UPDATE public.organizations 
      SET ai_budget_cents_monthly = 100 
      WHERE id = '${orgId}'
    `);

    context = {
      orgId,
      userId: testUserId,
      role: OrgRole.OWNER,
      requestId: 'req-ai-budget-test',
    };
  });

  afterAll(async () => {
    await apiPrisma.$disconnect();
    await ownerPool.end();
  });

  it('atomically reserves budget within organization limit', async () => {
    const reservation = await reserveAiBudget(context, {
      idempotencyKey: 'run-1',
      estimatedCostCents: 30,
      modelId: 'gemini-1.5-pro',
      periodKey: '2026-03',
    });

    run1ReservationId = reservation.id;
    expect(reservation.id).toBeDefined();
    expect(reservation.state).toBe(AiReservationState.RESERVED);
    expect(reservation.reservedAmountCents).toBe(30);

    const summary = await getOrganizationAiBudgetSummary(context, '2026-03');
    expect(summary.budgetLimitCents).toBe(100);
    expect(summary.committedCents).toBe(30);
    expect(summary.remainingCents).toBe(70);

    // Audit verification
    const audit = await listAuditEvents(context, {
      entityType: 'ai_budget_reservation',
      entityId: reservation.id,
    });
    expect(audit.length).toBeGreaterThan(0);
    expect(audit[0].action).toBe('ai.budget.reserved');
  });

  it('guarantees idempotency: duplicate reservation request returns existing reservation without double-charging', async () => {
    const first = await reserveAiBudget(context, {
      idempotencyKey: 'run-idempotent-key',
      estimatedCostCents: 25,
      modelId: 'gemini-1.5-pro',
      periodKey: '2026-03',
    });

    const second = await reserveAiBudget(context, {
      idempotencyKey: 'run-idempotent-key',
      estimatedCostCents: 25,
      modelId: 'gemini-1.5-pro',
      periodKey: '2026-03',
    });

    expect(first.id).toBe(second.id);
    runIdempotentReservationId = first.id;

    // Total committed should include 30 (from test 1) + 25 (from this test) = 55 (NOT 80)
    const summary = await getOrganizationAiBudgetSummary(context, '2026-03');
    expect(summary.committedCents).toBe(55);
  });

  it('fails closed when reservation request exceeds available monthly budget', async () => {
    // Current committed is 55¢, limit is 100¢. Remaining is 45¢.
    // Attempting to reserve 50¢ must fail closed.
    await expect(
      reserveAiBudget(context, {
        idempotencyKey: 'run-overspend',
        estimatedCostCents: 50,
        modelId: 'gemini-1.5-pro',
        periodKey: '2026-03',
      }),
    ).rejects.toThrow(/ERR_AI_BUDGET_EXCEEDED/);

    // Verify committed did not increase
    const summary = await getOrganizationAiBudgetSummary(context, '2026-03');
    expect(summary.committedCents).toBe(55);
  });

  it('settles reservation with actual usage cost and adjusts committed balance', async () => {
    // Settle run-1 (reserved 30¢, actual usage 15¢)
    const settled = await settleAiBudget(context, run1ReservationId, 15);
    expect(settled.state).toBe(AiReservationState.SETTLED);
    expect(settled.settledAmountCents).toBe(15);

    // Committed is now: 15 (settled run-1) + 25 (reserved run-idempotent-key) = 40¢
    const summary = await getOrganizationAiBudgetSummary(context, '2026-03');
    expect(summary.committedCents).toBe(40);
    expect(summary.remainingCents).toBe(60);
  });

  it('releases reservation on failure and restores available budget', async () => {
    // Release run-idempotent-key (reserved 25¢)
    const released = await releaseAiBudget(context, runIdempotentReservationId, 'Provider pre-call error');
    expect(released.state).toBe(AiReservationState.RELEASED);

    // Committed is now: 15¢ (only the settled run-1)
    const summary = await getOrganizationAiBudgetSummary(context, '2026-03');
    expect(summary.committedCents).toBe(15);
    expect(summary.remainingCents).toBe(85);
  });

  it('transitions timed-out/ambiguous requests to AWAITING_RECONCILIATION and retains budget hold', async () => {
    const reservation = await reserveAiBudget(context, {
      idempotencyKey: 'run-timeout',
      estimatedCostCents: 20,
      modelId: 'gemini-1.5-pro',
      periodKey: '2026-03',
    });

    const held = await markAiBudgetAwaitingReconciliation(
      context,
      reservation.id,
      'Gateway Timeout 504: provider did not reply in 15000ms',
    );
    expect(held.state).toBe(AiReservationState.AWAITING_RECONCILIATION);

    // Funds must remain held (not released blindly): 15 + 20 = 35¢
    const summary = await getOrganizationAiBudgetSummary(context, '2026-03');
    expect(summary.committedCents).toBe(35);
  });

  it('prevents concurrent race-condition overspending via serialized row locking', async () => {
    // Remaining budget is 100 - 35 = 65¢.
    // Launch 3 concurrent reservation attempts of 40¢ each.
    // Exactly one must succeed, and the other two must fail closed with ERR_AI_BUDGET_EXCEEDED!
    const ts = Date.now();
    const attempts = [
      reserveAiBudget(context, { idempotencyKey: `race-1-${ts}`, estimatedCostCents: 40, modelId: 'm', periodKey: '2026-03' }),
      reserveAiBudget(context, { idempotencyKey: `race-2-${ts}`, estimatedCostCents: 40, modelId: 'm', periodKey: '2026-03' }),
      reserveAiBudget(context, { idempotencyKey: `race-3-${ts}`, estimatedCostCents: 40, modelId: 'm', periodKey: '2026-03' }),
    ];

    const results = await Promise.allSettled(attempts);
    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(2);

    const summary = await getOrganizationAiBudgetSummary(context, '2026-03');
    // Total committed: 35 + 40 = 75 <= 100
    expect(summary.committedCents).toBe(75);
    expect(summary.committedCents).toBeLessThanOrEqual(100);
  });
});
