import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Param,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { AuthGuard } from '../identity/guards/auth.guard';
import { OrgMembershipGuard } from '../tenancy/guards/org-membership.guard';
import { CurrentUser } from '../identity/decorators/current-user.decorator';
import { CurrentOrgId, CurrentMembership } from '../tenancy/decorators/current-org.decorator';
import {
  TenantContext,
  SemanticSearchResultDto,
  DuplicateTaskCandidateDto,
  TaskStatus,
  OrgRole,
} from '@teamos/contracts';
import { SessionUser, Membership } from '@teamos/database';
import { SearchService } from './search.service';
import { EmbeddingService } from './embedding.service';
import {
  createApiPrismaClient,
  withTenant,
  findSimilarTasks,
} from '@teamos/database';

@Controller('orgs/:orgId')
@UseGuards(AuthGuard, OrgMembershipGuard)
export class SearchController {
  private readonly prisma = createApiPrismaClient();

  constructor(
    private readonly searchService: SearchService,
    private readonly embeddingService: EmbeddingService
  ) {}

  @Get('search')
  async search(
    @CurrentOrgId() orgId: string,
    @CurrentUser() user: SessionUser,
    @CurrentMembership() membership: Membership,
    @Query('q') query: string,
    @Query('projectId') projectId?: string,
    @Query('limit') limitStr?: string
  ): Promise<SemanticSearchResultDto[]> {
    if (!query || query.trim().length === 0) {
      return [];
    }
    const context: TenantContext = { orgId, userId: user.userId, role: membership.role as OrgRole };
    const limit = limitStr ? parseInt(limitStr, 10) : 10;
    return this.searchService.search(context, query.trim(), projectId, limit);
  }

  @Post('search/index-all')
  async indexAll(
    @CurrentOrgId() orgId: string,
    @CurrentUser() user: SessionUser,
    @CurrentMembership() membership: Membership,
    @Query('projectId') projectId?: string
  ) {
    const context: TenantContext = { orgId, userId: user.userId, role: membership.role as OrgRole };
    return this.searchService.indexAll(context, projectId);
  }

  @Post('projects/:projectId/tasks/check-duplicates')
  async checkDuplicates(
    @CurrentOrgId() orgId: string,
    @CurrentUser() user: SessionUser,
    @CurrentMembership() membership: Membership,
    @Param('projectId') projectId: string,
    @Body() body: { title: string; description?: string; excludeTaskId?: string }
  ): Promise<DuplicateTaskCandidateDto[]> {
    if (!body.title || body.title.trim().length === 0) {
      throw new BadRequestException('Task title is required to check for duplicates.');
    }

    const context: TenantContext = { orgId, userId: user.userId, role: membership.role as OrgRole };
    const textToEmbed = `${body.title}. ${body.description || ''}`.trim();
    const taskEmbedding = await this.embeddingService.generateEmbedding(textToEmbed);

    return withTenant(context, async (tx) => {
      const candidates = await findSimilarTasks(tx, context.orgId, {
        projectId,
        taskEmbedding,
        title: body.title,
        description: body.description,
        excludeTaskId: body.excludeTaskId,
        limit: 5,
      });

      return candidates.map((c) => {
        let reason = 'High semantic and conceptual overlap with your proposed title.';
        if (c.score > 0.88) {
          reason = `Nearly identical scope and wording to existing task "${c.title}".`;
        } else if (c.score > 0.78) {
          reason = `Covers similar functionality to "${c.title}" (${c.status}). Consider linking or merging to prevent double work.`;
        }

        return {
          taskId: c.sourceId,
          number: 0,
          title: c.title,
          status: c.status as TaskStatus,
          similarityScore: Number(c.score.toFixed(3)),
          reason,
        };
      });
    });
  }
}
