/**
 * TeamOS Centralized Database Package
 *
 * Rules:
 * - All tenant database access must pass through `withTenant(context, tx)`.
 * - Raw Prisma client instances are not exported outside this package.
 */

export { withTenant } from "./with-tenant";
export type { TenantContext, TransactionOptions } from "./with-tenant";

export {
  createWorkerPrismaClient,
  claimNextOutboxEvent,
  completeOutboxEvent,
  failOutboxEvent,
  sanitizeErrorMessage,
} from "./outbox";
export type { OutboxClaimedEvent } from "./outbox";

export {
  createIdentityPrismaClient,
  createSession,
  resolveSessionByHash,
  touchSession,
  revokeSession,
  cleanupExpiredSessions,
  upsertUserFromOAuth,
} from "./session";
export type { SessionUser } from "./session";

export {
  createApiPrismaClient,
  createOrganization,
  listUserOrganizations,
  getOrganizationMembership,
  getOrganizationById,
  listOrganizationMembers,
  updateMemberRole,
  removeMember,
  transferOwnership,
  createInvitation,
  listPendingInvitations,
  revokeInvitation,
  getInvitationByTokenHash,
  acceptInvitationByTokenHash,
} from "./tenancy";
export type { CreateOrgResult } from "./tenancy";

export { recordAuditEvent, listAuditEvents } from "./audit";
export type { RecordAuditParams, ListAuditOptions } from "./audit";

export {
  createProject,
  listProjects,
  getProjectById,
  updateProject,
} from "./projects";

export {
  createTask,
  listTasks,
  listTasksWithDependencies,
  getTaskById,
  updateTask,
  deleteTask,
  createTaskComment,
  listTaskComments,
  deleteTaskComment,
  linkPrToTask,
  listTaskGithubLinks,
  recordProjectRiskHistory,
  listProjectRiskHistory,
} from "./tasks";

export {
  addDependency,
  removeDependency,
  listProjectDependencies,
} from "./dependencies";

export {
  createProposal,
  listProjectProposals,
  getProposalById,
  rejectProposal,
  approveProposal,
} from "./proposals";

export {
  createProjectReport,
  listProjectReports,
  getReportById,
} from "./reports";
export type { CreateReportParams } from "./reports";

export {
  reserveAiBudget,
  settleAiBudget,
  releaseAiBudget,
  markAiBudgetAwaitingReconciliation,
  getOrganizationAiBudgetSummary,
  getCurrentPeriodKey,
} from "./ai-budget";
export type { ReserveBudgetParams } from "./ai-budget";

export {
  saveGithubInstallation,
  listGithubInstallations,
  listGithubRepositories,
  linkGithubRepositoryToProject,
  saveWebhookDelivery,
  cleanupExpiredWebhookDeliveries,
} from "./github";
export type { SaveInstallationParams } from "./github";

export {
  createMeeting,
  listMeetings,
  getMeetingById,
  addTranscriptSegments,
  addMeetingActionProposals,
  updateMeetingActionProposalStatus,
} from "./meetings";
export type {
  CreateMeetingParams,
  CreateTranscriptSegmentParams,
  CreateActionProposalParams,
} from "./meetings";

export {
  upsertWorkspaceEmbedding,
  searchWorkspaceEmbeddings,
  findSimilarTasks,
  deleteWorkspaceEmbedding,
} from "./embeddings";
export type {
  UpsertEmbeddingParams,
  SearchEmbeddingParams,
  SimilarTaskResult,
} from "./embeddings";

export {
  createNotification,
  listNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  getUnreadNotificationCount,
} from "./notifications";
export type { CreateNotificationParams } from "./notifications";

export {
  recordCopilotMessage,
  listCopilotMessages,
  clearCopilotHistory,
} from "./copilot";
export type { RecordCopilotMessageParams } from "./copilot";

// Re-export safe types and enums from Prisma Client
export { TaskStatus, TaskPriority, ActorType, OutboxStatus, OrgRole, ProposalKind, ProposalState, AiReservationState, Prisma } from "@prisma/client";

export type {
  User,
  Session,
  Organization,
  Membership,
  Invitation,
  AuditEvent,
  Project,
  Task,
  TaskDependency,
  Proposal,
  OutboxEvent,
  AiBudgetReservation,
  GithubInstallation,
  GithubRepository,
  GithubWebhookDelivery,
  Meeting,
  TranscriptSegment,
  MeetingActionProposal,
  WorkspaceEmbedding,
  Notification,
  CopilotMessage,
} from "@prisma/client";
