import { Injectable, Logger } from '@nestjs/common';
import {
  createApiPrismaClient,
  withTenant,
  TenantContext,
  searchWorkspaceEmbeddings,
  upsertWorkspaceEmbedding,
  listTasks,
  listMeetings,
} from '@teamos/database';
import { SemanticSearchResultDto, EmbeddingSourceType } from '@teamos/contracts';
import { EmbeddingService } from './embedding.service';

@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);
  private readonly prisma = createApiPrismaClient();

  constructor(private readonly embeddingService: EmbeddingService) {}

  async search(
    context: TenantContext,
    query: string,
    projectId?: string,
    limit = 10
  ): Promise<SemanticSearchResultDto[]> {
    if (!query || query.trim().length === 0) {
      return [];
    }

    const queryEmbedding = await this.embeddingService.generateEmbedding(query);

    return withTenant(context, async (tx) => {
      const results = await searchWorkspaceEmbeddings(tx, context.orgId, {
        queryEmbedding,
        queryText: query,
        projectId,
        limit,
      });

      return results.map((r) => {
        const metadata = (r.metadata as Record<string, unknown>) || {};
        const title = (metadata.title as string) || `${r.sourceType} Item`;
        return {
          id: r.id,
          sourceType: r.sourceType as EmbeddingSourceType,
          sourceId: r.sourceId,
          projectId: r.projectId,
          title,
          snippet: r.contentText.length > 220 ? `${r.contentText.slice(0, 220)}...` : r.contentText,
          score: Number(r.score.toFixed(3)),
          metadata,
        };
      });
    });
  }

  async indexTask(
    context: TenantContext,
    task: { id: string; projectId: string; number: number; title: string; description?: string | null; status: string }
  ): Promise<void> {
    const textToEmbed = `${task.title}. ${task.description || ''}`.trim();
    const embedding = await this.embeddingService.generateEmbedding(textToEmbed);

    await withTenant(context, async (tx) => {
      await upsertWorkspaceEmbedding(tx, context.orgId, {
        projectId: task.projectId,
        sourceType: 'TASK',
        sourceId: task.id,
        contentText: textToEmbed,
        embedding,
        metadata: {
          title: `#${task.number} - ${task.title}`,
          taskNumber: task.number,
          status: task.status,
        },
      });
    });
  }

  async indexMeeting(
    context: TenantContext,
    meeting: { id: string; projectId: string; title: string; transcript?: string | null }
  ): Promise<void> {
    const textToEmbed = `Meeting: ${meeting.title}. Transcript: ${meeting.transcript || ''}`.trim();
    const embedding = await this.embeddingService.generateEmbedding(textToEmbed.slice(0, 3000));

    await withTenant(context, async (tx) => {
      await upsertWorkspaceEmbedding(tx, context.orgId, {
        projectId: meeting.projectId,
        sourceType: 'MEETING',
        sourceId: meeting.id,
        contentText: textToEmbed.slice(0, 3000),
        embedding,
        metadata: {
          title: `Meeting: ${meeting.title}`,
        },
      });
    });
  }

  async indexAll(context: TenantContext, projectId?: string): Promise<{ indexedTasks: number; indexedMeetings: number }> {
    let taskCount = 0;
    let meetingCount = 0;

    if (projectId) {
      const tasks = await listTasks(context, projectId);
      for (const task of tasks) {
        await this.indexTask(context, task);
        taskCount++;
      }
      const meetings = await withTenant(context, async (tx) => listMeetings(tx, context.orgId, projectId));
      for (const m of meetings) {
        await this.indexMeeting(context, m);
        meetingCount++;
      }
    }

    return { indexedTasks: taskCount, indexedMeetings: meetingCount };
  }
}
