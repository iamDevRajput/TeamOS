export interface LlmPlanTask {
  tempId: string;
  title: string;
  description?: string;
  remainingEstimateWorkdays: number;
}

export interface LlmPlanDependency {
  blockerTempId: string;
  dependentTempId: string;
}

export interface LlmPlanGenerationRequest {
  brief: string;
  projectContext?: {
    name: string;
    key: string;
  };
}

export interface LlmPlanGenerationResponse {
  title: string;
  description: string;
  tasks: LlmPlanTask[];
  dependencies: LlmPlanDependency[];
  tokensUsed?: number;
  costCents?: number;
}

export interface LlmProvider {
  generatePlan(request: LlmPlanGenerationRequest): Promise<LlmPlanGenerationResponse>;
}

