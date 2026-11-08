import { Prisma } from "@prisma/client";

export interface RecordCopilotMessageParams {
  projectId: string;
  userId: string;
  role: string;
  content: string;
  simulationPayload?: Record<string, unknown> | null;
  citations?: Array<Record<string, unknown>>;
}

export async function recordCopilotMessage(
  tx: Prisma.TransactionClient,
  orgId: string,
  params: RecordCopilotMessageParams
) {
  return tx.copilotMessage.create({
    data: {
      orgId,
      projectId: params.projectId,
      userId: params.userId,
      role: params.role,
      content: params.content,
      simulationPayload: params.simulationPayload
        ? (params.simulationPayload as Prisma.InputJsonValue)
        : Prisma.JsonNull,
      citations: (params.citations ?? []) as Prisma.InputJsonValue,
    },
    include: {
      user: {
        select: { id: true, login: true, displayName: true, avatarUrl: true },
      },
    },
  });
}

export async function listCopilotMessages(
  tx: Prisma.TransactionClient,
  orgId: string,
  projectId: string,
  limit = 50
) {
  return tx.copilotMessage.findMany({
    where: {
      orgId,
      projectId,
    },
    include: {
      user: {
        select: { id: true, login: true, displayName: true, avatarUrl: true },
      },
    },
    orderBy: {
      createdAt: "asc",
    },
    take: limit,
  });
}

export async function clearCopilotHistory(
  tx: Prisma.TransactionClient,
  orgId: string,
  projectId: string
) {
  return tx.copilotMessage.deleteMany({
    where: {
      orgId,
      projectId,
    },
  });
}
