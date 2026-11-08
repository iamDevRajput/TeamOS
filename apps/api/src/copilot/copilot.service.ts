import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  createApiPrismaClient,
  withTenant,
  TenantContext,
  recordCopilotMessage,
  listCopilotMessages,
  listTasks,
  listMeetings,
} from '@teamos/database';
import {
  CopilotMessageDto,
  CopilotSimulationResultDto,
  CopilotCitationDto,
} from '@teamos/contracts';
import { RiskService } from '../risk/risk.service';
import { CollaborationService } from '../collaboration/collaboration.service';

@Injectable()
export class CopilotService {
  private readonly logger = new Logger(CopilotService.name);
  private readonly prisma = createApiPrismaClient();

  constructor(
    private readonly riskService: RiskService,
    private readonly collaborationService: CollaborationService
  ) {}

  async listMessages(context: TenantContext, projectId: string): Promise<CopilotMessageDto[]> {
    return withTenant(context, async (tx) => {
      const messages = await listCopilotMessages(tx, context.orgId, projectId);
      return messages.map((m) => ({
        id: m.id,
        orgId: m.orgId,
        projectId: m.projectId,
        userId: m.userId,
        role: m.role as any,
        content: m.content,
        simulationPayload: (m.simulationPayload as unknown as CopilotSimulationResultDto) || null,
        citations: (m.citations as unknown as CopilotCitationDto[]) || [],
        createdAt: m.createdAt.toISOString(),
      }));
    });
  }

  async chat(
    context: TenantContext,
    projectId: string,
    prompt: string
  ): Promise<CopilotMessageDto> {
    const cleanPrompt = prompt.trim();
    if (!cleanPrompt) {
      throw new NotFoundException('Empty message.');
    }

    // 1. Record user message
    await withTenant(context, async (tx) => {
      await recordCopilotMessage(tx, context.orgId, {
        projectId,
        userId: context.userId,
        role: 'user',
        content: cleanPrompt,
      });
    });

    // 2. Fetch current project risk and tasks
    const riskReport = await this.riskService.getProjectRisk(context, projectId);
    const tasks = await listTasks(context, projectId);
    const meetings = await withTenant(context, async (tx) => listMeetings(tx, context.orgId, projectId));

    // 3. Check for What-If Simulation intent
    const simulationMatch = this.detectSimulationIntent(cleanPrompt, tasks);

    let assistantContent = '';
    let simulationPayload: CopilotSimulationResultDto | null = null;
    const citations: CopilotCitationDto[] = [];

    if (simulationMatch) {
      const targetTask = simulationMatch.task;
      const delayDays = simulationMatch.delayDays;
      const currentEstimate = targetTask.remainingEstimateWorkdays || 3;
      const simulatedEstimate = currentEstimate + delayDays;

      // Pure in-memory CPM simulation (Zero database writes!)
      const whatIfResult = await this.riskService.simulateWhatIf(context, projectId, {
        estimateOverrides: [
          {
            taskId: targetTask.id,
            remainingEstimateWorkdays: simulatedEstimate,
          },
        ],
      });

      const originalForecast = riskReport.forecastDeliveryDate || 'TBD';
      const newForecast = whatIfResult.scenarioForecastDeliveryDate || 'TBD';
      const varianceChange = whatIfResult.varianceWorkdays;

      const impactedTasks = whatIfResult.tasks
        .filter((t) => whatIfResult.impactedTaskIds.includes(t.taskId))
        .map((t) => ({
          id: t.taskId,
          number: t.taskNumber,
          title: t.taskTitle,
          slackChangeDays: t.slackWorkdays,
          newlyCritical: t.isCritical,
        }));

      simulationPayload = {
        simulatedDelayDays: delayDays,
        targetTaskId: targetTask.id,
        targetTaskTitle: `#${targetTask.number} ${targetTask.title}`,
        originalForecastDate: originalForecast,
        newForecastDate: newForecast,
        scheduleVarianceChangeDays: varianceChange,
        impactedTasks,
        recommendation: varianceChange > 0
          ? `Introduce fast-tracking or parallelize testing to absorb the ${delayDays}-day slip.`
          : 'Buffer absorption confirmed. Critical delivery date is maintained.',
      };

      citations.push({
        type: 'task',
        id: targetTask.id,
        title: `#${targetTask.number} - ${targetTask.title}`,
      });

      for (const it of impactedTasks.slice(0, 3)) {
        citations.push({
          type: 'task',
          id: it.id,
          title: `#${it.number} - ${it.title}`,
        });
      }

      assistantContent = `### What-If Simulation Analysis
Simulating a **+${delayDays}-day delay** on **#${targetTask.number} (${targetTask.title})**:

- **Forecast Completion:** Moves from \`${originalForecast}\` to \`${newForecast}\` (**+${Math.max(0, varianceChange)} days variance**).
- **Downstream Impact:** ${impactedTasks.length} dependent task(s) affected.
${impactedTasks.map((it) => `  - **#${it.number} ${it.title}**: slack ${it.slackChangeDays} days${it.newlyCritical ? ' (**Now Critical**)' : ''}`).join('\n')}

**Delivery Recommendation:**
${simulationPayload.recommendation}

Would you like to draft a mitigation proposal to adjust task assignments or reschedule non-critical tasks?`;
    } else {
      // General Copilot inquiry
      assistantContent = await this.generateCopilotAnswer(cleanPrompt, riskReport, tasks, meetings, citations);
    }

    // 4. Record assistant message
    const savedAssistantMessage = await withTenant(context, async (tx) => {
      const row = await recordCopilotMessage(tx, context.orgId, {
        projectId,
        userId: context.userId,
        role: 'assistant',
        content: assistantContent,
        simulationPayload: simulationPayload ? (simulationPayload as any) : null,
        citations: citations as unknown as Array<Record<string, unknown>>,
      });

      return {
        id: row.id,
        orgId: row.orgId,
        projectId: row.projectId,
        userId: row.userId,
        role: row.role as any,
        content: row.content,
        simulationPayload,
        citations,
        createdAt: row.createdAt.toISOString(),
      };
    });

    // 5. Broadcast live to room
    this.collaborationService.broadcastToProject(context.orgId, projectId, 'copilot:message', savedAssistantMessage);

    return savedAssistantMessage;
  }

  private detectSimulationIntent(prompt: string, tasks: any[]): { task: any; delayDays: number } | null {
    const lower = prompt.toLowerCase();
    const hasDelayWord = lower.includes('delay') || lower.includes('slip') || lower.includes('take') || lower.includes('late') || lower.includes('what if');
    if (!hasDelayWord) return null;

    // Extract delay days
    const daysMatch = lower.match(/(\d+)\s*(days?|workdays?)/);
    const delayDays = daysMatch ? parseInt(daysMatch[1], 10) : 3;

    // Find referenced task
    for (const task of tasks) {
      const taskNumStr = `#${task.number}`;
      const taskPlainNum = `task ${task.number}`;
      const titleLower = task.title.toLowerCase();

      if (lower.includes(taskNumStr.toLowerCase()) || lower.includes(taskPlainNum) || lower.includes(titleLower.slice(0, 15))) {
        return { task, delayDays };
      }
    }

    // Default to the first critical task if "what if" is asked generally
    const firstCritical = tasks.find((t: any) => t.isCritical) || tasks[0];
    if (firstCritical && (lower.includes('what if') || lower.includes('delay'))) {
      return { task: firstCritical, delayDays };
    }

    return null;
  }

  private async generateCopilotAnswer(
    prompt: string,
    risk: any,
    tasks: any[],
    meetings: any[],
    citations: CopilotCitationDto[]
  ): Promise<string> {
    const apiKey = process.env.GEMINI_API_KEY || process.env.LLM_API_KEY;

    const criticalTasks = tasks.filter((t: any) => risk.criticalPathTaskIds?.includes(t.id));
    const blockedTasks = tasks.filter((t: any) => t.isBlocked);

    for (const t of criticalTasks.slice(0, 3)) {
      citations.push({ type: 'task', id: t.id, title: `#${t.number} - ${t.title}` });
    }

    if (meetings.length > 0) {
      citations.push({ type: 'meeting', id: meetings[0].id, title: `Meeting: ${meetings[0].title}` });
    }

    const contextSummary = `Project: ${risk.projectName} (${risk.projectKey})
Target Date: ${risk.targetDeliveryDate || 'None'}
Forecast Delivery Date: ${risk.forecastDeliveryDate || 'Unknown'}
Schedule Variance: ${risk.deliveryVarianceWorkdays || 0} workdays
Is Delayed: ${risk.isDelayed ? 'YES' : 'NO'}
Critical Tasks (${criticalTasks.length}): ${criticalTasks.map((t: any) => `#${t.number} ${t.title}`).join(', ')}
Blocked Tasks (${blockedTasks.length}): ${blockedTasks.map((t: any) => `#${t.number} ${t.title}`).join(', ')}
Recent Meetings: ${meetings.slice(0, 2).map((m: any) => `"${m.title}"`).join(', ')}`;

    if (apiKey && !apiKey.startsWith('placeholder') && apiKey.length > 10) {
      try {
        const systemPrompt = `You are the TeamOS AI Delivery Copilot.
Provide concise, factual answers grounded in the provided project delivery data.
Cite task numbers (e.g. #1) and dates.
Never invent dates or tasks not present in context.`;

        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: `${systemPrompt}\n\nProject Context:\n${contextSummary}\n\nUser Question: ${prompt}` }] }],
              generationConfig: {
                temperature: 0.2,
              },
            }),
            signal: AbortSignal.timeout(10000),
          }
        );

        if (response.ok) {
          const data = (await response.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
          const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (reply) return reply.trim();
        }
      } catch (err) {
        this.logger.debug(`Gemini copilot fallback: ${(err as Error).message}`);
      }
    }

    // Deterministic intelligence briefing
    const lower = prompt.toLowerCase();
    if (lower.includes('date') || lower.includes('target') || lower.includes('on time') || lower.includes('hit')) {
      if (risk.isDelayed) {
        return `⚠️ **Delivery Date Warning**: The current forecast completion is **${risk.forecastDeliveryDate}**, which is **${risk.deliveryVarianceWorkdays} workday(s) behind** the target date (${risk.targetDeliveryDate}). The delay is driven by the critical path: ${criticalTasks.map((t: any) => `\`#${t.number} ${t.title}\``).join(' → ')}.`;
      }
      return `✅ **On Schedule**: The team is currently on track to hit the target date (${risk.targetDeliveryDate}). Current forecast completion is **${risk.forecastDeliveryDate}** with zero schedule variance.`;
    }

    if (lower.includes('block') || lower.includes('stuck') || lower.includes('waiting')) {
      if (blockedTasks.length > 0) {
        return `🚫 **Current Delivery Blockers**: There are **${blockedTasks.length} blocked task(s)** in this project:\n${blockedTasks.map((t: any) => `- **#${t.number} ${t.title}** is waiting on prerequisites.`).join('\n')}\n\nFocus on clearing blocker dependencies to unblock work.`;
      }
      return `🎉 **No Blocked Tasks**: All actionable tasks are unblocked and ready for execution.`;
    }

    return `### TeamOS Delivery Intelligence Briefing
- **Target Delivery Date:** \`${risk.targetDeliveryDate || 'Not Set'}\`
- **Forecast Delivery Date:** \`${risk.forecastDeliveryDate || 'In Progress'}\` (${risk.isDelayed ? `⚠️ +${risk.deliveryVarianceWorkdays} days late` : '✅ On Schedule'})
- **Critical Path Tasks:** ${criticalTasks.length > 0 ? criticalTasks.map((t: any) => `\`#${t.number}\``).join(', ') : 'None'}
- **Total Workdays Remaining:** ${risk.maxDurationWorkdays || 0} workdays
- **Active Meetings Analyzed:** ${meetings.length}

*Tip: You can ask "What happens if #2 is delayed by 4 days?" to simulate schedule impact in memory.*`;
  }
}
