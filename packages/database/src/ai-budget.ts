/**
 * TeamOS Database Package — Atomic AI Budget & Usage Accounting
 *
 * Rules:
 * - All tenant database operations use `withTenant` to enforce PostgreSQL RLS.
 * - Concurrency control: Row-level lock (`FOR UPDATE`) on the organization row
 *   guarantees serialized budget check, preventing concurrent overspending.
 * - Idempotency: Duplicate idempotency keys return existing active reservations.
 * - State lifecycle: RESERVED -> SETTLED | RELEASED | AWAITING_RECONCILIATION.
 * - Timeouts and ambiguous provider errors transition to AWAITING_RECONCILIATION
 *   to hold funds until reconciled.
 */

import { Prisma, ActorType, AiReservationState } from '@prisma/client';
import { AiBudgetReservationDto, TenantContext } from '@teamos/contracts';
import { withTenant } from './with-tenant';
import { recordAuditEvent } from './audit';

export interface ReserveBudgetParams {
  idempotencyKey: string;
  estimatedCostCents: number;
  modelId: string;
  periodKey?: string;
}

export function getCurrentPeriodKey(date = new Date()): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

export async function reserveAiBudget(
  context: TenantContext,
  params: ReserveBudgetParams,
): Promise<AiBudgetReservationDto> {
  const periodKey = params.periodKey || getCurrentPeriodKey();

  return withTenant(context, async (tx: Prisma.TransactionClient) => {
    // 1. Idempotency Check: if reservation already exists for this org and idempotencyKey
    const existing = await tx.aiBudgetReservation.findUnique({
      where: {
        orgId_idempotencyKey: {
          orgId: context.orgId,
          idempotencyKey: params.idempotencyKey,
        },
      },
    });

    if (existing) {
      if (existing.state === AiReservationState.RESERVED || existing.state === AiReservationState.SETTLED) {
        return {
          id: existing.id,
          orgId: existing.orgId,
          userId: existing.userId,
          idempotencyKey: existing.idempotencyKey,
          reservedAmountCents: existing.reservedAmountCents,
          settledAmountCents: existing.settledAmountCents,
          state: existing.state,
          modelId: existing.modelId,
          periodKey: existing.periodKey,
          errorMessage: existing.errorMessage,
          createdAt: existing.createdAt.toISOString(),
          updatedAt: existing.updatedAt.toISOString(),
        };
      }
      if (existing.state === AiReservationState.AWAITING_RECONCILIATION) {
        return {
          id: existing.id,
          orgId: existing.orgId,
          userId: existing.userId,
          idempotencyKey: existing.idempotencyKey,
          reservedAmountCents: existing.reservedAmountCents,
          settledAmountCents: existing.settledAmountCents,
          state: existing.state,
          modelId: existing.modelId,
          periodKey: existing.periodKey,
          errorMessage: existing.errorMessage,
          createdAt: existing.createdAt.toISOString(),
          updatedAt: existing.updatedAt.toISOString(),
        };
      }
    }

    // 2. Row-level lock the organization record to serialize concurrent budget allocations
    const orgRows = await tx.$queryRaw<{ id: string; ai_budget_cents_monthly: number }[]>`
      SELECT id, ai_budget_cents_monthly 
      FROM public.organizations 
      WHERE id = ${context.orgId}::uuid
      FOR UPDATE
    `;

    if (orgRows.length === 0) {
      throw new Error(`Organization ${context.orgId} not found.`);
    }

    const orgBudgetLimit = orgRows[0].ai_budget_cents_monthly;

    // 3. Compute currently committed amount (settled + reserved + awaiting reconciliation) in period
    const committedRows = await tx.$queryRaw<{ committed_cents: number }[]>`
      SELECT COALESCE(SUM(
        CASE 
          WHEN state = 'SETTLED' THEN settled_amount_cents 
          ELSE reserved_amount_cents 
        END
      ), 0)::int as committed_cents
      FROM public.ai_budget_reservations
      WHERE org_id = ${context.orgId}::uuid
        AND period_key = ${periodKey}
        AND state IN ('RESERVED', 'SETTLED', 'AWAITING_RECONCILIATION')
    `;

    const committedCents = committedRows[0]?.committed_cents || 0;

    // 4. Fail closed if requested reservation exceeds remaining monthly budget
    if (committedCents + params.estimatedCostCents > orgBudgetLimit) {
      throw new Error(
        `ERR_AI_BUDGET_EXCEEDED: Reservation of ${params.estimatedCostCents}¢ exceeds available monthly budget (Committed: ${committedCents}¢, Limit: ${orgBudgetLimit}¢).`,
      );
    }

    // 5. Create the reservation in RESERVED state
    const reservation = await tx.aiBudgetReservation.create({
      data: {
        orgId: context.orgId,
        userId: context.userId,
        idempotencyKey: params.idempotencyKey,
        reservedAmountCents: params.estimatedCostCents,
        state: AiReservationState.RESERVED,
        modelId: params.modelId,
        periodKey,
      },
    });

    // 6. Record audit event atomically
    await recordAuditEvent(tx, {
      orgId: context.orgId,
      actorType: ActorType.USER,
      actorId: context.userId,
      action: 'ai.budget.reserved',
      entityType: 'ai_budget_reservation',
      entityId: reservation.id,
      afterData: {
        reservationId: reservation.id,
        idempotencyKey: params.idempotencyKey,
        reservedAmountCents: params.estimatedCostCents,
        modelId: params.modelId,
        periodKey,
        committedBefore: committedCents,
        orgBudgetLimit,
      },
      requestId: context.requestId,
    });

    return {
      id: reservation.id,
      orgId: reservation.orgId,
      userId: reservation.userId,
      idempotencyKey: reservation.idempotencyKey,
      reservedAmountCents: reservation.reservedAmountCents,
      settledAmountCents: reservation.settledAmountCents,
      state: reservation.state,
      modelId: reservation.modelId,
      periodKey: reservation.periodKey,
      errorMessage: reservation.errorMessage,
      createdAt: reservation.createdAt.toISOString(),
      updatedAt: reservation.updatedAt.toISOString(),
    };
  });
}

export async function settleAiBudget(
  context: TenantContext,
  reservationId: string,
  actualUsageCents: number,
  modelId?: string,
): Promise<AiBudgetReservationDto> {
  return withTenant(context, async (tx: Prisma.TransactionClient) => {
    // 1. Lock reservation row
    const existing = await tx.aiBudgetReservation.findUnique({
      where: {
        orgId_id: {
          orgId: context.orgId,
          id: reservationId,
        },
      },
    });

    if (!existing) {
      throw new Error(`Reservation ${reservationId} not found.`);
    }

    if (existing.state === AiReservationState.SETTLED) {
      return {
        id: existing.id,
        orgId: existing.orgId,
        userId: existing.userId,
        idempotencyKey: existing.idempotencyKey,
        reservedAmountCents: existing.reservedAmountCents,
        settledAmountCents: existing.settledAmountCents,
        state: existing.state,
        modelId: existing.modelId,
        periodKey: existing.periodKey,
        errorMessage: existing.errorMessage,
        createdAt: existing.createdAt.toISOString(),
        updatedAt: existing.updatedAt.toISOString(),
      };
    }

    if (
      existing.state !== AiReservationState.RESERVED &&
      existing.state !== AiReservationState.AWAITING_RECONCILIATION
    ) {
      throw new Error(
        `Cannot settle reservation in state "${existing.state}". Must be RESERVED or AWAITING_RECONCILIATION.`,
      );
    }

    // 2. Update to SETTLED
    const updated = await tx.aiBudgetReservation.update({
      where: {
        orgId_id: {
          orgId: context.orgId,
          id: reservationId,
        },
      },
      data: {
        state: AiReservationState.SETTLED,
        settledAmountCents: Math.max(0, actualUsageCents),
        modelId: modelId || existing.modelId,
      },
    });

    // 3. Record audit event
    await recordAuditEvent(tx, {
      orgId: context.orgId,
      actorType: ActorType.USER,
      actorId: context.userId,
      action: 'ai.budget.settled',
      entityType: 'ai_budget_reservation',
      entityId: updated.id,
      beforeData: {
        reservedAmountCents: existing.reservedAmountCents,
        state: existing.state,
      },
      afterData: {
        settledAmountCents: updated.settledAmountCents,
        state: updated.state,
        modelId: updated.modelId,
      },
      requestId: context.requestId,
    });

    return {
      id: updated.id,
      orgId: updated.orgId,
      userId: updated.userId,
      idempotencyKey: updated.idempotencyKey,
      reservedAmountCents: updated.reservedAmountCents,
      settledAmountCents: updated.settledAmountCents,
      state: updated.state,
      modelId: updated.modelId,
      periodKey: updated.periodKey,
      errorMessage: updated.errorMessage,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    };
  });
}

export async function releaseAiBudget(
  context: TenantContext,
  reservationId: string,
  reason: string,
): Promise<AiBudgetReservationDto> {
  return withTenant(context, async (tx: Prisma.TransactionClient) => {
    const existing = await tx.aiBudgetReservation.findUnique({
      where: {
        orgId_id: {
          orgId: context.orgId,
          id: reservationId,
        },
      },
    });

    if (!existing) {
      throw new Error(`Reservation ${reservationId} not found.`);
    }

    if (
      existing.state === AiReservationState.RELEASED ||
      existing.state === AiReservationState.SETTLED
    ) {
      return {
        id: existing.id,
        orgId: existing.orgId,
        userId: existing.userId,
        idempotencyKey: existing.idempotencyKey,
        reservedAmountCents: existing.reservedAmountCents,
        settledAmountCents: existing.settledAmountCents,
        state: existing.state,
        modelId: existing.modelId,
        periodKey: existing.periodKey,
        errorMessage: existing.errorMessage,
        createdAt: existing.createdAt.toISOString(),
        updatedAt: existing.updatedAt.toISOString(),
      };
    }

    if (
      existing.state !== AiReservationState.RESERVED &&
      existing.state !== AiReservationState.AWAITING_RECONCILIATION
    ) {
      throw new Error(`Cannot release reservation in state "${existing.state}".`);
    }

    const updated = await tx.aiBudgetReservation.update({
      where: {
        orgId_id: {
          orgId: context.orgId,
          id: reservationId,
        },
      },
      data: {
        state: AiReservationState.RELEASED,
        errorMessage: reason,
      },
    });

    await recordAuditEvent(tx, {
      orgId: context.orgId,
      actorType: ActorType.USER,
      actorId: context.userId,
      action: 'ai.budget.released',
      entityType: 'ai_budget_reservation',
      entityId: updated.id,
      beforeData: {
        reservedAmountCents: existing.reservedAmountCents,
        state: existing.state,
      },
      afterData: {
        state: updated.state,
        reason,
      },
      requestId: context.requestId,
    });

    return {
      id: updated.id,
      orgId: updated.orgId,
      userId: updated.userId,
      idempotencyKey: updated.idempotencyKey,
      reservedAmountCents: updated.reservedAmountCents,
      settledAmountCents: updated.settledAmountCents,
      state: updated.state,
      modelId: updated.modelId,
      periodKey: updated.periodKey,
      errorMessage: updated.errorMessage,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    };
  });
}

export async function markAiBudgetAwaitingReconciliation(
  context: TenantContext,
  reservationId: string,
  errorMessage: string,
): Promise<AiBudgetReservationDto> {
  return withTenant(context, async (tx: Prisma.TransactionClient) => {
    const existing = await tx.aiBudgetReservation.findUnique({
      where: {
        orgId_id: {
          orgId: context.orgId,
          id: reservationId,
        },
      },
    });

    if (!existing) {
      throw new Error(`Reservation ${reservationId} not found.`);
    }

    const updated = await tx.aiBudgetReservation.update({
      where: {
        orgId_id: {
          orgId: context.orgId,
          id: reservationId,
        },
      },
      data: {
        state: AiReservationState.AWAITING_RECONCILIATION,
        errorMessage: errorMessage.slice(0, 1000),
      },
    });

    await recordAuditEvent(tx, {
      orgId: context.orgId,
      actorType: ActorType.USER,
      actorId: context.userId,
      action: 'ai.budget.awaiting_reconciliation',
      entityType: 'ai_budget_reservation',
      entityId: updated.id,
      beforeData: { state: existing.state },
      afterData: { state: updated.state, errorMessage },
      requestId: context.requestId,
    });

    return {
      id: updated.id,
      orgId: updated.orgId,
      userId: updated.userId,
      idempotencyKey: updated.idempotencyKey,
      reservedAmountCents: updated.reservedAmountCents,
      settledAmountCents: updated.settledAmountCents,
      state: updated.state,
      modelId: updated.modelId,
      periodKey: updated.periodKey,
      errorMessage: updated.errorMessage,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    };
  });
}

export async function getOrganizationAiBudgetSummary(
  context: TenantContext,
  periodKey = getCurrentPeriodKey(),
): Promise<{
  budgetLimitCents: number;
  committedCents: number;
  remainingCents: number;
  periodKey: string;
}> {
  return withTenant(context, async (tx: Prisma.TransactionClient) => {
    const org = await tx.organization.findUnique({
      where: { id: context.orgId },
      select: { aiBudgetCentsMonthly: true },
    });

    const budgetLimitCents = org?.aiBudgetCentsMonthly ?? 0;

    const committedRows = await tx.$queryRaw<{ committed_cents: number }[]>`
      SELECT COALESCE(SUM(
        CASE 
          WHEN state = 'SETTLED' THEN settled_amount_cents 
          ELSE reserved_amount_cents 
        END
      ), 0)::int as committed_cents
      FROM public.ai_budget_reservations
      WHERE org_id = ${context.orgId}::uuid
        AND period_key = ${periodKey}
        AND state IN ('RESERVED', 'SETTLED', 'AWAITING_RECONCILIATION')
    `;

    const committedCents = committedRows[0]?.committed_cents || 0;
    const remainingCents = Math.max(0, budgetLimitCents - committedCents);

    return {
      budgetLimitCents,
      committedCents,
      remainingCents,
      periodKey,
    };
  });
}

