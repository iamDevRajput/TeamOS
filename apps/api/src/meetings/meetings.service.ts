import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import {
  createApiPrismaClient,
  withTenant,
  TenantContext,
  ActorType,
  createMeeting as dbCreateMeeting,
  listMeetings as dbListMeetings,
  getMeetingById as dbGetMeetingById,
  addTranscriptSegments as dbAddTranscriptSegments,
  addMeetingActionProposals as dbAddMeetingActionProposals,
  updateMeetingActionProposalStatus as dbUpdateProposalStatus,
  createTask,
  recordAuditEvent,
} from '@teamos/database';
import {
  MeetingDto,
  CreateMeetingDto,
  MeetingActionProposalDto,
  TranscriptSegmentDto,
  ConvertProposalToTaskDto,
  TaskPriority,
  TaskStatus,
} from '@teamos/contracts';
import { SearchService } from '../search/search.service';
import { CollaborationService } from '../collaboration/collaboration.service';

@Injectable()
export class MeetingsService {
  private readonly logger = new Logger(MeetingsService.name);
  private readonly prisma = createApiPrismaClient();

  constructor(
    private readonly searchService: SearchService,
    private readonly collaborationService: CollaborationService
  ) {}

  async create(
    context: TenantContext,
    projectId: string,
    dto: CreateMeetingDto
  ): Promise<MeetingDto> {
    if (!dto.title || dto.title.trim().length === 0) {
      throw new BadRequestException('Meeting title is required.');
    }

    const meetingDate = dto.meetingDate ? new Date(dto.meetingDate) : new Date();

    const meeting = await withTenant(context, async (tx) => {
      const created = await dbCreateMeeting(tx, context.orgId, {
        projectId,
        title: dto.title.trim(),
        meetingDate,
        participants: dto.participants || [],
        audioUrl: dto.audioUrl,
        transcript: dto.transcript,
        createdByUserId: context.userId,
      });

      // Parse transcript into segments if transcript provided
      if (dto.transcript && dto.transcript.trim().length > 0) {
        const segments = this.parseTranscriptLines(dto.transcript);
        if (segments.length > 0) {
          await dbAddTranscriptSegments(tx, context.orgId, created.id, segments);
        }

        // Extract action items
        const extractedActions = await this.extractActionsFromTranscript(dto.transcript);
        if (extractedActions.length > 0) {
          await dbAddMeetingActionProposals(
            tx,
            context.orgId,
            projectId,
            created.id,
            extractedActions
          );
        }
      }

      await recordAuditEvent(tx, {
        orgId: context.orgId,
        actorType: ActorType.USER,
        actorId: context.userId,
        action: 'meeting.create',
        entityType: 'meeting',
        entityId: created.id,
        afterData: { title: created.title, projectId },
      });

      return dbGetMeetingById(tx, context.orgId, created.id);
    });

    if (!meeting) {
      throw new NotFoundException('Failed to retrieve created meeting.');
    }

    // Index meeting asynchronously for semantic search
    this.searchService
      .indexMeeting(context, {
        id: meeting.id,
        projectId: meeting.projectId,
        title: meeting.title,
        transcript: meeting.transcript,
      })
      .catch((err) => this.logger.warn(`Search indexing error: ${err.message}`));

    // Broadcast to room
    this.collaborationService.broadcastToProject(context.orgId, projectId, 'meeting:created', {
      meetingId: meeting.id,
      title: meeting.title,
    });

    return this.mapMeetingToDto(meeting);
  }

  async list(context: TenantContext, projectId: string): Promise<MeetingDto[]> {
    return withTenant(context, async (tx) => {
      const meetings = await dbListMeetings(tx, context.orgId, projectId);
      return meetings.map((m) => this.mapMeetingToDto(m));
    });
  }

  async getById(context: TenantContext, meetingId: string): Promise<MeetingDto> {
    const meeting = await withTenant(context, async (tx) => {
      return dbGetMeetingById(tx, context.orgId, meetingId);
    });

    if (!meeting) {
      throw new NotFoundException('Meeting not found.');
    }

    return this.mapMeetingToDto(meeting);
  }

  async convertProposalToTask(
    context: TenantContext,
    projectId: string,
    meetingId: string,
    proposalId: string,
    dto: ConvertProposalToTaskDto
  ): Promise<{ taskId: string; proposalId: string; status: string }> {
    const meeting = await withTenant(context, async (tx) => {
      return dbGetMeetingById(tx, context.orgId, meetingId);
    });

    if (!meeting) {
      throw new NotFoundException('Meeting not found.');
    }

    const proposal = meeting.actionProposals.find((p) => p.id === proposalId);
    if (!proposal) {
      throw new NotFoundException('Proposal not found in this meeting.');
    }

    if (proposal.status === 'CONVERTED') {
      throw new BadRequestException('Proposal is already converted to a task.');
    }

    const taskTitle = dto.title || proposal.actionItem;
    const createdTask = await createTask(context, projectId, {
      title: taskTitle,
      description: `Generated from meeting "${meeting.title}"\n\nSupporting Evidence:\n"${proposal.supportingEvidence || proposal.actionItem}"`,
      priority: dto.priority || TaskPriority.MEDIUM,
      status: TaskStatus.TODO,
      assigneeId: dto.assigneeId || proposal.suggestedAssigneeId || undefined,
      remainingEstimateWorkdays: dto.remainingEstimateWorkdays || 3,
      dueDate: dto.dueDate ? dto.dueDate : (proposal.suggestedDeadline ? proposal.suggestedDeadline.toISOString().slice(0, 10) : undefined),
    });

    await withTenant(context, async (tx) => {
      await dbUpdateProposalStatus(tx, context.orgId, proposalId, 'CONVERTED', createdTask.id);

      await recordAuditEvent(tx, {
        orgId: context.orgId,
        actorType: ActorType.USER,
        actorId: context.userId,
        action: 'proposal.convert_to_task',
        entityType: 'meeting_action_proposal',
        entityId: proposalId,
        afterData: {
          meetingId,
          taskId: createdTask.id,
          taskTitle,
        },
      });
    });

    // Broadcast event
    this.collaborationService.broadcastToProject(context.orgId, projectId, 'task:created', {
      task: createdTask,
      source: 'meeting_action',
    });

    return {
      taskId: createdTask.id,
      proposalId,
      status: 'CONVERTED',
    };
  }

  async dismissProposal(
    context: TenantContext,
    meetingId: string,
    proposalId: string
  ): Promise<{ success: boolean }> {
    await withTenant(context, async (tx) => {
      await dbUpdateProposalStatus(tx, context.orgId, proposalId, 'DISMISSED');
    });
    return { success: true };
  }

  private parseTranscriptLines(transcript: string) {
    const lines = transcript.split('\n').filter((l) => l.trim().length > 0);
    const segments: Array<{ speaker: string; startTimeSeconds: number; endTimeSeconds: number; text: string }> = [];

    let currentTime = 0;
    for (const line of lines) {
      const match = line.match(/^([^:]+):\s*(.*)$/);
      if (match) {
        const speaker = match[1].trim();
        const text = match[2].trim();
        segments.push({
          speaker,
          startTimeSeconds: currentTime,
          endTimeSeconds: currentTime + 15,
          text,
        });
        currentTime += 15;
      } else {
        segments.push({
          speaker: 'Presenter',
          startTimeSeconds: currentTime,
          endTimeSeconds: currentTime + 10,
          text: line.trim(),
        });
        currentTime += 10;
      }
    }

    return segments;
  }

  private async extractActionsFromTranscript(transcript: string) {
    const apiKey = process.env.GEMINI_API_KEY || process.env.LLM_API_KEY;

    if (apiKey && !apiKey.startsWith('placeholder') && apiKey.length > 10) {
      try {
        const systemPrompt = `You are an AI meeting intelligence assistant for engineering teams.
Analyze the meeting transcript and extract concrete, actionable work items.
For each item output:
- actionItem: concise task description (e.g. "Implement GitHub webhook idempotency")
- confidence: number between 0.8 and 1.0
- supportingEvidence: exact quote or reference from transcript`;

        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: `${systemPrompt}\n\nTranscript:\n${transcript}` }] }],
              generationConfig: {
                response_mime_type: 'application/json',
                temperature: 0.2,
              },
            }),
            signal: AbortSignal.timeout(10000),
          }
        );

        if (response.ok) {
          const data = (await response.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
          const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (rawText) {
            const parsed = JSON.parse(rawText) as Array<{ actionItem: string; confidence?: number; supportingEvidence?: string }>;
            if (Array.isArray(parsed) && parsed.length > 0) {
              return parsed.map((p) => ({
                actionItem: p.actionItem,
                confidence: p.confidence ?? 0.92,
                supportingEvidence: p.supportingEvidence,
              }));
            }
          }
        }
      } catch (err) {
        this.logger.debug(`Gemini action extraction fallback: ${(err as Error).message}`);
      }
    }

    // Deterministic fallback action extractor: scan lines with action keywords
    const actions: Array<{ actionItem: string; confidence: number; supportingEvidence: string }> = [];
    const lines = transcript.split('\n');

    for (const line of lines) {
      const lower = line.toLowerCase();
      if (
        lower.includes('action item') ||
        lower.includes('todo') ||
        lower.includes('will do') ||
        lower.includes('will handle') ||
        lower.includes('need to implement') ||
        lower.includes('let\'s make sure') ||
        lower.includes('agreed to')
      ) {
        const cleanItem = line.replace(/^[^:]+:\s*/, '').replace(/^(action item:?|todo:?)/i, '').trim();
        if (cleanItem.length > 10) {
          actions.push({
            actionItem: cleanItem,
            confidence: 0.88,
            supportingEvidence: line.trim(),
          });
        }
      }
    }

    if (actions.length === 0 && transcript.length > 20) {
      // Default sample action item from first key topic
      actions.push({
        actionItem: `Follow up on items discussed in meeting: ${lines[0].slice(0, 60)}`,
        confidence: 0.85,
        supportingEvidence: lines[0].slice(0, 100),
      });
    }

    return actions;
  }

  private mapMeetingToDto(meeting: any): MeetingDto {
    return {
      id: meeting.id,
      orgId: meeting.orgId,
      projectId: meeting.projectId,
      title: meeting.title,
      meetingDate: meeting.meetingDate instanceof Date ? meeting.meetingDate.toISOString() : meeting.meetingDate,
      participants: meeting.participants || [],
      audioUrl: meeting.audioUrl || undefined,
      transcript: meeting.transcript || undefined,
      status: meeting.status,
      createdByUserId: meeting.createdByUserId || undefined,
      createdAt: meeting.createdAt instanceof Date ? meeting.createdAt.toISOString() : meeting.createdAt,
      updatedAt: meeting.updatedAt instanceof Date ? meeting.updatedAt.toISOString() : meeting.updatedAt,
      segments: (meeting.transcriptSegments || []).map((s: any): TranscriptSegmentDto => ({
        id: s.id,
        meetingId: s.meetingId,
        speaker: s.speaker,
        startTimeSeconds: s.startTimeSeconds,
        endTimeSeconds: s.endTimeSeconds,
        text: s.text,
        createdAt: s.createdAt instanceof Date ? s.createdAt.toISOString() : s.createdAt,
      })),
      proposals: (meeting.actionProposals || []).map((p: any): MeetingActionProposalDto => ({
        id: p.id,
        orgId: p.orgId,
        projectId: p.projectId,
        meetingId: p.meetingId,
        actionItem: p.actionItem,
        suggestedAssigneeId: p.suggestedAssigneeId || undefined,
        suggestedAssigneeName: p.suggestedAssignee?.displayName || p.suggestedAssignee?.login,
        suggestedDeadline: p.suggestedDeadline instanceof Date ? p.suggestedDeadline.toISOString() : p.suggestedDeadline || undefined,
        confidence: p.confidence,
        supportingEvidence: p.supportingEvidence || undefined,
        status: p.status,
        convertedTaskId: p.convertedTaskId || undefined,
        createdAt: p.createdAt instanceof Date ? p.createdAt.toISOString() : p.createdAt,
        updatedAt: p.updatedAt instanceof Date ? p.updatedAt.toISOString() : p.updatedAt,
      })),
    };
  }
}
