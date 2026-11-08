import { Prisma } from "@prisma/client";

export interface UpsertEmbeddingParams {
  projectId?: string;
  sourceType: string;
  sourceId: string;
  chunkIndex?: number;
  contentText: string;
  embedding?: number[];
  metadata?: Record<string, unknown>;
}

export interface SearchEmbeddingParams {
  queryEmbedding?: number[];
  projectId?: string;
  queryText?: string;
  limit?: number;
}

export interface SimilarTaskResult {
  sourceId: string;
  title: string;
  status: string;
  score: number;
  snippet: string;
}

export async function upsertWorkspaceEmbedding(
  tx: Prisma.TransactionClient,
  orgId: string,
  params: UpsertEmbeddingParams
) {
  const metadataJson = JSON.stringify(params.metadata ?? {});
  const chunkIndex = params.chunkIndex ?? 0;

  // Delete existing embedding for this source and chunk within the org
  await tx.$executeRaw`
    DELETE FROM public.workspace_embeddings
    WHERE org_id = ${orgId}::uuid
      AND source_type = ${params.sourceType}
      AND source_id = ${params.sourceId}::uuid
      AND chunk_index = ${chunkIndex}
  `;

  if (params.embedding && params.embedding.length > 0) {
    const vectorString = `[${params.embedding.join(",")}]`;
    if (params.projectId) {
      await tx.$executeRaw`
        INSERT INTO public.workspace_embeddings (
          id, org_id, project_id, source_type, source_id, chunk_index, content_text, embedding, metadata, created_at, updated_at
        ) VALUES (
          gen_random_uuid(),
          ${orgId}::uuid,
          ${params.projectId}::uuid,
          ${params.sourceType},
          ${params.sourceId}::uuid,
          ${chunkIndex},
          ${params.contentText},
          ${vectorString}::vector,
          ${metadataJson}::jsonb,
          now(),
          now()
        )
      `;
    } else {
      await tx.$executeRaw`
        INSERT INTO public.workspace_embeddings (
          id, org_id, project_id, source_type, source_id, chunk_index, content_text, embedding, metadata, created_at, updated_at
        ) VALUES (
          gen_random_uuid(),
          ${orgId}::uuid,
          NULL,
          ${params.sourceType},
          ${params.sourceId}::uuid,
          ${chunkIndex},
          ${params.contentText},
          ${vectorString}::vector,
          ${metadataJson}::jsonb,
          now(),
          now()
        )
      `;
    }
  } else {
    // Insert text only without vector
    await tx.workspaceEmbedding.create({
      data: {
        orgId,
        projectId: params.projectId ?? null,
        sourceType: params.sourceType,
        sourceId: params.sourceId,
        chunkIndex,
        contentText: params.contentText,
        metadata: (params.metadata ?? {}) as Prisma.InputJsonValue,
      },
    });
  }
}

export async function searchWorkspaceEmbeddings(
  tx: Prisma.TransactionClient,
  orgId: string,
  params: SearchEmbeddingParams
) {
  const limit = params.limit ?? 10;

  if (params.queryEmbedding && params.queryEmbedding.length > 0) {
    const vectorString = `[${params.queryEmbedding.join(",")}]`;

    if (params.projectId) {
      const results = await tx.$queryRaw<
        Array<{
          id: string;
          source_type: string;
          source_id: string;
          project_id: string | null;
          content_text: string;
          metadata: Record<string, unknown>;
          score: number;
        }>
      >`
        SELECT
          id,
          source_type,
          source_id,
          project_id,
          content_text,
          metadata,
          (1 - (embedding <=> ${vectorString}::vector))::float AS score
        FROM public.workspace_embeddings
        WHERE org_id = ${orgId}::uuid
          AND project_id = ${params.projectId}::uuid
          AND embedding IS NOT NULL
        ORDER BY embedding <=> ${vectorString}::vector ASC
        LIMIT ${limit}
      `;
      return results.map((r) => ({
        id: r.id,
        sourceType: r.source_type,
        sourceId: r.source_id,
        projectId: r.project_id ?? undefined,
        contentText: r.content_text,
        metadata: r.metadata,
        score: Math.max(0, Math.min(1, r.score)),
      }));
    } else {
      const results = await tx.$queryRaw<
        Array<{
          id: string;
          source_type: string;
          source_id: string;
          project_id: string | null;
          content_text: string;
          metadata: Record<string, unknown>;
          score: number;
        }>
      >`
        SELECT
          id,
          source_type,
          source_id,
          project_id,
          content_text,
          metadata,
          (1 - (embedding <=> ${vectorString}::vector))::float AS score
        FROM public.workspace_embeddings
        WHERE org_id = ${orgId}::uuid
          AND embedding IS NOT NULL
        ORDER BY embedding <=> ${vectorString}::vector ASC
        LIMIT ${limit}
      `;
      return results.map((r) => ({
        id: r.id,
        sourceType: r.source_type,
        sourceId: r.source_id,
        projectId: r.project_id ?? undefined,
        contentText: r.content_text,
        metadata: r.metadata,
        score: Math.max(0, Math.min(1, r.score)),
      }));
    }
  }

  // Fallback / text keyword search when embedding is not supplied
  const query = params.queryText ?? "";
  const rows = await tx.workspaceEmbedding.findMany({
    where: {
      orgId,
      ...(params.projectId ? { projectId: params.projectId } : {}),
      contentText: {
        contains: query,
        mode: "insensitive",
      },
    },
    take: limit,
    orderBy: { createdAt: "desc" },
  });

  return rows.map((r) => ({
    id: r.id,
    sourceType: r.sourceType,
    sourceId: r.sourceId,
    projectId: r.projectId ?? undefined,
    contentText: r.contentText,
    metadata: (r.metadata as Record<string, unknown>) ?? {},
    score: 0.85,
  }));
}

export async function findSimilarTasks(
  tx: Prisma.TransactionClient,
  orgId: string,
  params: {
    projectId: string;
    taskEmbedding?: number[];
    title: string;
    description?: string;
    excludeTaskId?: string;
    limit?: number;
  }
): Promise<SimilarTaskResult[]> {
  const limit = params.limit ?? 5;

  if (params.taskEmbedding && params.taskEmbedding.length > 0) {
    const vectorString = `[${params.taskEmbedding.join(",")}]`;
    const results = await tx.$queryRaw<
      Array<{
        source_id: string;
        content_text: string;
        metadata: Record<string, unknown>;
        score: number;
      }>
    >`
      SELECT
        source_id,
        content_text,
        metadata,
        (1 - (embedding <=> ${vectorString}::vector))::float AS score
      FROM public.workspace_embeddings
      WHERE org_id = ${orgId}::uuid
        AND project_id = ${params.projectId}::uuid
        AND source_type = 'TASK'
        AND (${params.excludeTaskId ? Prisma.sql`source_id != ${params.excludeTaskId}::uuid` : Prisma.sql`TRUE`})
        AND embedding IS NOT NULL
      ORDER BY embedding <=> ${vectorString}::vector ASC
      LIMIT ${limit}
    `;

    return results
      .filter((r) => r.score >= 0.65)
      .map((r) => ({
        sourceId: r.source_id,
        title: (r.metadata?.title as string) || r.content_text.slice(0, 60),
        status: (r.metadata?.status as string) || "TODO",
        score: Math.max(0, Math.min(1, r.score)),
        snippet: r.content_text.slice(0, 140),
      }));
  }

  // Fallback: title keyword overlap
  const words = params.title.split(/\s+/).filter((w) => w.length > 3);
  if (words.length === 0) return [];

  const existingTasks = await tx.task.findMany({
    where: {
      orgId,
      projectId: params.projectId,
      ...(params.excludeTaskId ? { id: { not: params.excludeTaskId } } : {}),
      OR: words.map((w) => ({
        title: { contains: w, mode: "insensitive" },
      })),
    },
    take: limit,
  });

  return existingTasks.map((t) => ({
    sourceId: t.id,
    title: t.title,
    status: t.status,
    score: 0.78,
    snippet: t.description ? t.description.slice(0, 140) : t.title,
  }));
}

export async function deleteWorkspaceEmbedding(
  tx: Prisma.TransactionClient,
  orgId: string,
  sourceType: string,
  sourceId: string
) {
  return tx.workspaceEmbedding.deleteMany({
    where: {
      orgId,
      sourceType,
      sourceId,
    },
  });
}
