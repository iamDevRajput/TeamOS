import { Prisma } from "@prisma/client";

export interface CreateMeetingParams {
  projectId: string;
  title: string;
  meetingDate?: Date;
  participants?: string[];
  audioUrl?: string;
  transcript?: string;
  createdByUserId?: string;
}

export interface CreateTranscriptSegmentParams {
  speaker: string;
  startTimeSeconds: number;
  endTimeSeconds: number;
  text: string;
}

export interface CreateActionProposalParams {
  actionItem: string;
  suggestedAssigneeId?: string;
  suggestedDeadline?: Date;
  confidence?: number;
  supportingEvidence?: string;
}

export async function createMeeting(
  tx: Prisma.TransactionClient,
  orgId: string,
  params: CreateMeetingParams
) {
  return tx.meeting.create({
    data: {
      orgId,
      projectId: params.projectId,
      title: params.title,
      meetingDate: params.meetingDate ?? new Date(),
      participants: params.participants ?? [],
      audioUrl: params.audioUrl,
      transcript: params.transcript,
      createdByUserId: params.createdByUserId,
      status: "COMPLETED",
    },
    include: {
      actionProposals: true,
      transcriptSegments: {
        orderBy: { startTimeSeconds: "asc" },
      },
    },
  });
}

export async function listMeetings(
  tx: Prisma.TransactionClient,
  orgId: string,
  projectId: string
) {
  return tx.meeting.findMany({
    where: {
      orgId,
      projectId,
    },
    include: {
      actionProposals: {
        include: {
          suggestedAssignee: {
            select: { id: true, login: true, displayName: true, avatarUrl: true },
          },
        },
      },
      transcriptSegments: {
        orderBy: { startTimeSeconds: "asc" },
      },
    },
    orderBy: {
      meetingDate: "desc",
    },
  });
}

export async function getMeetingById(
  tx: Prisma.TransactionClient,
  orgId: string,
  meetingId: string
) {
  return tx.meeting.findFirst({
    where: {
      id: meetingId,
      orgId,
    },
    include: {
      actionProposals: {
        include: {
          suggestedAssignee: {
            select: { id: true, login: true, displayName: true, avatarUrl: true },
          },
        },
      },
      transcriptSegments: {
        orderBy: { startTimeSeconds: "asc" },
      },
    },
  });
}

export async function addTranscriptSegments(
  tx: Prisma.TransactionClient,
  orgId: string,
  meetingId: string,
  segments: CreateTranscriptSegmentParams[]
) {
  if (segments.length === 0) return [];
  const records = segments.map((s) => ({
    orgId,
    meetingId,
    speaker: s.speaker,
    startTimeSeconds: s.startTimeSeconds,
    endTimeSeconds: s.endTimeSeconds,
    text: s.text,
  }));

  await tx.transcriptSegment.createMany({
    data: records,
  });

  return tx.transcriptSegment.findMany({
    where: { orgId, meetingId },
    orderBy: { startTimeSeconds: "asc" },
  });
}

export async function addMeetingActionProposals(
  tx: Prisma.TransactionClient,
  orgId: string,
  projectId: string,
  meetingId: string,
  proposals: CreateActionProposalParams[]
) {
  if (proposals.length === 0) return [];

  const created = [];
  for (const p of proposals) {
    const row = await tx.meetingActionProposal.create({
      data: {
        orgId,
        projectId,
        meetingId,
        actionItem: p.actionItem,
        suggestedAssigneeId: p.suggestedAssigneeId,
        suggestedDeadline: p.suggestedDeadline,
        confidence: p.confidence ?? 0.9,
        supportingEvidence: p.supportingEvidence,
        status: "PENDING",
      },
      include: {
        suggestedAssignee: {
          select: { id: true, login: true, displayName: true, avatarUrl: true },
        },
      },
    });
    created.push(row);
  }

  return created;
}

export async function updateMeetingActionProposalStatus(
  tx: Prisma.TransactionClient,
  orgId: string,
  proposalId: string,
  status: "PENDING" | "CONVERTED" | "DISMISSED",
  convertedTaskId?: string
) {
  return tx.meetingActionProposal.update({
    where: {
      id: proposalId,
      orgId,
    },
    data: {
      status,
      convertedTaskId: convertedTaskId ?? null,
      updatedAt: new Date(),
    },
  });
}
