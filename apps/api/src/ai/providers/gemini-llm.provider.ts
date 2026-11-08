import { Injectable, Logger } from '@nestjs/common';
import {
  LlmProvider,
  LlmPlanGenerationRequest,
  LlmPlanGenerationResponse,
} from '../interfaces/llm-provider.interface';
import { MockLlmProvider } from './mock-llm.provider';

@Injectable()
export class GeminiLlmProvider implements LlmProvider {
  private readonly logger = new Logger(GeminiLlmProvider.name);
  private readonly mockFallback = new MockLlmProvider();

  async generatePlan(
    request: LlmPlanGenerationRequest,
  ): Promise<LlmPlanGenerationResponse> {
    const apiKey = process.env.GEMINI_API_KEY || process.env.LLM_API_KEY;

    if (!apiKey || apiKey.startsWith('placeholder') || apiKey.length < 10) {
      this.logger.log('No valid GEMINI_API_KEY configured; utilizing deterministic MockLlmProvider.');
      return this.mockFallback.generatePlan(request);
    }

    try {
      const systemInstruction = `You are an expert software technical lead and delivery planner for TeamOS.
Convert the provided project brief into a structured, dependency-ordered implementation plan.
Output strict JSON with:
- title: string (concise plan name)
- description: string (plan rationale and summary)
- tasks: array of objects with tempId (e.g. "task-1"), title (string), description (string), remainingEstimateWorkdays (number between 1 and 30)
- dependencies: array of objects with blockerTempId (string) and dependentTempId (string) representing finish-to-start constraints. Blocker must finish before dependent can start. The graph MUST be a valid Directed Acyclic Graph (DAG) with zero cycles.`;

      const prompt = `Project: ${request.projectContext?.name || 'Software Project'} (${request.projectContext?.key || 'PROJ'})
<project_brief>
${request.brief}
</project_brief>

Generate a structured plan with 3-7 discrete tasks and appropriate finish-to-start dependencies.`;

      const model = process.env.GEMINI_MODEL || 'gemini-3.5-flash';
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: `${systemInstruction}\n\n${prompt}` }] }],
            generationConfig: {
              response_mime_type: 'application/json',
              temperature: 0.2,
            },
          }),
          signal: AbortSignal.timeout(15000),
        },
      );

      if (!response.ok) {
        throw new Error(`Gemini API returned status ${response.status}`);
      }

      const data = await response.json();
      const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText) {
        throw new Error('Empty response from Gemini API');
      }

      const parsed = JSON.parse(rawText);
      return {
        title: parsed.title || 'Implementation Plan',
        description: parsed.description || 'Generated delivery plan.',
        tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [],
        dependencies: Array.isArray(parsed.dependencies) ? parsed.dependencies : [],
        tokensUsed: data.usageMetadata?.totalTokenCount ?? 350,
        costCents: 1,
      };
    } catch (err: any) {
      this.logger.warn(`Gemini live plan generation failed (${err.message}). Falling back to Mock provider.`);
      return this.mockFallback.generatePlan(request);
    }
  }
}

