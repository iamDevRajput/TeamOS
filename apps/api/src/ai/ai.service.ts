import {
  Injectable,
  BadRequestException,
  ServiceUnavailableException,
  NotFoundException,
  GatewayTimeoutException,
} from '@nestjs/common';
import crypto from 'crypto';
import {
  TenantContext,
  ProposalDto,
  CreateProposalDto,
} from '@teamos/contracts';
import {
  createProposal,
  getProjectById,
  reserveAiBudget,
  settleAiBudget,
  releaseAiBudget,
  markAiBudgetAwaitingReconciliation,
} from '@teamos/database';
import { validateAndSortGraph } from '@teamos/risk-engine';
import { GeminiLlmProvider } from './providers/gemini-llm.provider';

@Injectable()
export class AiService {
  constructor(private readonly llmProvider: GeminiLlmProvider) {}

  async generatePlanProposal(
    context: TenantContext,
    projectId: string,
    brief: string,
    idempotencyKey?: string,
  ): Promise<ProposalDto> {
    // 1. Check administrative kill switch
    if (process.env.AI_KILL_SWITCH === 'true') {
      throw new ServiceUnavailableException(
        'AI services are currently paused by administrative kill switch.',
      );
    }

    if (!brief || brief.trim().length < 5) {
      throw new BadRequestException('A descriptive project brief is required (minimum 5 characters).');
    }

    // 2. Verify project exists in active tenant
    const project = await getProjectById(context, projectId);
    if (!project) {
      throw new NotFoundException('Project not found in this organization.');
    }

    // 3. Atomically reserve estimated budget before contacting the provider
    const resolvedIdempotencyKey =
      idempotencyKey ||
      `ai-plan-${crypto.createHash('sha256').update(`${projectId}:${brief.trim()}`).digest('hex').slice(0, 24)}`;

    const estimatedCostCents = 5; // Conservative reservation: 5 cents per planning brief
    let reservation;
    try {
      reservation = await reserveAiBudget(context, {
        idempotencyKey: resolvedIdempotencyKey,
        estimatedCostCents,
        modelId: 'gemini-1.5-pro',
      });
    } catch (budgetErr: any) {
      if (budgetErr.message?.includes('ERR_AI_BUDGET_EXCEEDED')) {
        throw new BadRequestException(
          'Organization AI budget exceeded. Please adjust monthly limit to generate additional plans.',
        );
      }
      throw budgetErr;
    }

    let plan;
    try {
      // 4. Call LLM Provider outside the database transaction
      plan = await this.llmProvider.generatePlan({
        brief: brief.trim(),
        projectContext: {
          name: project.name,
          key: project.key,
        },
      });

      // 5. Semantic Validation
      if (!plan.tasks || plan.tasks.length === 0) {
        throw new BadRequestException('AI plan generator failed to produce tasks.');
      }

      if (plan.tasks.length > 50) {
        throw new BadRequestException('Generated plan exceeds maximum limit of 50 tasks.');
      }

      const taskTempIdSet = new Set<string>();
      for (const t of plan.tasks) {
        if (!t.title || !t.title.trim()) {
          throw new BadRequestException('Generated task is missing title.');
        }
        if (
          t.remainingEstimateWorkdays === undefined ||
          t.remainingEstimateWorkdays <= 0 ||
          t.remainingEstimateWorkdays > 60
        ) {
          t.remainingEstimateWorkdays = Math.max(1, Math.min(30, Number(t.remainingEstimateWorkdays) || 3));
        }
        taskTempIdSet.add(t.tempId);
      }

      // Filter dependencies to valid task IDs and reject self-dependencies
      const validDeps = (plan.dependencies || []).filter(
        (d) =>
          taskTempIdSet.has(d.blockerTempId) &&
          taskTempIdSet.has(d.dependentTempId) &&
          d.blockerTempId !== d.dependentTempId,
      );

      // Verify Directed Acyclic Graph (zero cycles)
      const dagResult = validateAndSortGraph(
        Array.from(taskTempIdSet),
        validDeps.map((d) => ({
          blockerTaskId: d.blockerTempId,
          blockedTaskId: d.dependentTempId,
        })),
      );

      if (dagResult.hasCycle) {
        throw new BadRequestException('AI plan contains cyclic dependencies; rejected by graph verifier.');
      }

      // 6. Settle reservation with actual usage
      await settleAiBudget(context, reservation.id, estimatedCostCents, 'gemini-1.5-pro');

      // 7. Stage as a PENDING human-reviewable Proposal
      const proposalDto: CreateProposalDto = {
        title: plan.title,
        description: plan.description,
        kind: 'PLAN',
        payload: {
          tasksToCreate: plan.tasks.map((t) => ({
            tempId: t.tempId,
            title: t.title.trim(),
            description: t.description?.trim(),
            remainingEstimateWorkdays: t.remainingEstimateWorkdays,
          })),
          dependenciesToAdd: validDeps.map((d) => ({
            blockerId: d.blockerTempId,
            dependentId: d.dependentTempId,
          })),
        },
      };

      return await createProposal(context, projectId, proposalDto);
    } catch (err: any) {
      // Differentiate timeout / ambiguous errors from definite failures
      const isTimeout =
        err.name === 'TimeoutError' ||
        err.message?.toLowerCase().includes('timeout') ||
        err.code === 'ETIMEDOUT';

      if (isTimeout) {
        await markAiBudgetAwaitingReconciliation(
          context,
          reservation.id,
          err.message || 'Provider request timed out',
        );
        throw new GatewayTimeoutException(
          'AI provider request timed out. Budget held pending reconciliation.',
        );
      }

      // On definite failure, release the reserved budget
      await releaseAiBudget(
        context,
        reservation.id,
        err.message || 'Plan generation or validation failure',
      );

      throw err;
    }
  }
}
