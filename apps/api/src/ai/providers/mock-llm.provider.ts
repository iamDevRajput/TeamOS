import { Injectable } from '@nestjs/common';
import {
  LlmProvider,
  LlmPlanGenerationRequest,
  LlmPlanGenerationResponse,
  LlmPlanTask,
  LlmPlanDependency,
} from '../interfaces/llm-provider.interface';

@Injectable()
export class MockLlmProvider implements LlmProvider {
  async generatePlan(
    request: LlmPlanGenerationRequest,
  ): Promise<LlmPlanGenerationResponse> {
    const brief = request.brief.trim();
    const lines = brief
      .split('\n')
      .map((l) => l.trim().replace(/^[-*•\d.]+\s*/, ''))
      .filter((l) => l.length > 5);

    let tasks: LlmPlanTask[] = [];
    let dependencies: LlmPlanDependency[] = [];

    if (lines.length >= 3) {
      // Use parsed brief lines directly as work items
      tasks = lines.slice(0, 8).map((line, idx) => ({
        tempId: `task-${idx + 1}`,
        title: line.length > 60 ? line.slice(0, 57) + '...' : line,
        description: `Deliverable generated from specification: ${line}`,
        remainingEstimateWorkdays: ((idx * 2 + 3) % 7) + 2, // 2 to 8 days
      }));

      // Create sequential and branched finish-to-start dependencies
      for (let i = 0; i < tasks.length - 1; i++) {
        dependencies.push({
          blockerTempId: tasks[i].tempId,
          dependentTempId: tasks[i + 1].tempId,
        });
      }
    } else {
      // Standard professional breakdown based on software project engineering phases
      const prefix = request.projectContext?.name || 'Feature';
      tasks = [
        {
          tempId: 'task-1',
          title: `Technical Specification & Schema Design for ${prefix}`,
          description: `Define data contracts, PostgreSQL tables, RLS policies, and API interfaces for: ${brief}`,
          remainingEstimateWorkdays: 3,
        },
        {
          tempId: 'task-2',
          title: `Core Backend Services & Business Logic`,
          description: `Implement domain services, transactions, and validation logic.`,
          remainingEstimateWorkdays: 5,
        },
        {
          tempId: 'task-3',
          title: `API Endpoints & Integration Guards`,
          description: `Expose authenticated REST endpoints with tenant isolation and input validation.`,
          remainingEstimateWorkdays: 4,
        },
        {
          tempId: 'task-4',
          title: `Frontend Interface & Interactive Components`,
          description: `Build reactive UI components, error handling, and state synchronizers.`,
          remainingEstimateWorkdays: 6,
        },
        {
          tempId: 'task-5',
          title: `End-to-End Testing & Security Audit`,
          description: `Validate tenant isolation, security boundaries, and full user journey.`,
          remainingEstimateWorkdays: 3,
        },
      ];

      // Sequential finish-to-start chain (Guaranteed DAG)
      dependencies = [
        { blockerTempId: 'task-1', dependentTempId: 'task-2' },
        { blockerTempId: 'task-2', dependentTempId: 'task-3' },
        { blockerTempId: 'task-2', dependentTempId: 'task-4' },
        { blockerTempId: 'task-3', dependentTempId: 'task-5' },
        { blockerTempId: 'task-4', dependentTempId: 'task-5' },
      ];
    }

    const title =
      brief.length > 50
        ? `Implementation Plan: ${brief.slice(0, 47)}...`
        : `Implementation Plan: ${brief}`;

    return {
      title,
      description: `Structured work breakdown plan generated from brief. Contains ${tasks.length} tasks and ${dependencies.length} finish-to-start constraints.`,
      tasks,
      dependencies,
      tokensUsed: 450,
      costCents: 2,
    };
  }
}

