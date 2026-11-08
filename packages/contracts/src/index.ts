/**
 * Shared contracts, DTOs, and system-wide type definitions for TeamOS.
 */

export interface HealthResponse {
  status: 'ok' | 'degraded';
  timestamp: string;
  uptimeSeconds: number;
  environment: string;
}

export const OrgRole = {
  OWNER: 'OWNER',
  ADMIN: 'ADMIN',
  MEMBER: 'MEMBER',
} as const;

export type OrgRole = (typeof OrgRole)[keyof typeof OrgRole];

export interface TenantContext {
  readonly orgId: string;
  readonly userId: string;
  readonly role?: OrgRole;
  readonly requestId?: string;
}

export const TaskStatus = {
  TODO: 'TODO',
  IN_PROGRESS: 'IN_PROGRESS',
  DONE: 'DONE',
  CANCELLED: 'CANCELLED',
} as const;

export type TaskStatus = (typeof TaskStatus)[keyof typeof TaskStatus];

export const TaskPriority = {
  URGENT: 'URGENT',
  HIGH: 'HIGH',
  MEDIUM: 'MEDIUM',
  LOW: 'LOW',
} as const;

export type TaskPriority = (typeof TaskPriority)[keyof typeof TaskPriority];

export interface TaskDto {
  id: string;
  orgId: string;
  projectId: string;
  number: number;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  assigneeId?: string;
  assigneeName?: string;
  remainingEstimateWorkdays?: number;
  dueDate?: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTaskDto {
  title: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  assigneeId?: string;
  remainingEstimateWorkdays?: number;
  dueDate?: string;
}

export interface UpdateTaskDto {
  title?: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  assigneeId?: string | null;
  remainingEstimateWorkdays?: number | null;
  dueDate?: string | null;
  expectedVersion: number;
}

export interface TaskCommentDto {
  id: string;
  orgId: string;
  taskId: string;
  userId: string;
  userLogin?: string;
  userDisplayName?: string;
  userAvatarUrl?: string;
  body: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTaskCommentDto {
  body: string;
}

export interface TaskGithubLinkDto {
  id: string;
  orgId: string;
  taskId: string;
  prNumber: number;
  prTitle: string;
  prUrl: string;
  prBranch: string;
  prState: string;
  isStalled: boolean;
  lastActivityAt: string;
  createdAt: string;
}

export interface ProjectRiskHistoryDto {
  id: string;
  orgId: string;
  projectId: string;
  snapshotDate: string;
  targetDate?: string;
  forecastDate?: string;
  scheduleVarianceDays: number;
  criticalPathDuration: number;
  criticalTaskCount: number;
  riskLevel: string;
  snapshotHash: string;
  createdAt: string;
}

export interface ProjectDto {
  id: string;
  orgId: string;
  key: string;
  name: string;
  startDate: string | null;
  dueDate: string | null;
  timezone: string;
  nextTaskNumber: number;
  taskCount?: number;
  createdAt: string;
}

export interface CreateProjectDto {
  name: string;
  key: string;
  startDate?: string;
  dueDate?: string;
  timezone?: string;
}

export interface UpdateProjectDto {
  name?: string;
  startDate?: string | null;
  dueDate?: string | null;
  timezone?: string;
}

export interface AuthUserDto {
  id: string;
  login: string;
  displayName: string | null;
  avatarUrl: string | null;
}

export interface AuthMeResponseDto {
  user: AuthUserDto;
  sessionId: string;
  expiresAt: string;
  lastActiveAt: string;
}

export interface LogoutResponseDto {
  success: boolean;
}

// ==========================================
// Organizations, Memberships & Invitations
// ==========================================

export interface CreateOrgDto {
  name: string;
  slug?: string;
}

export interface OrgDto {
  id: string;
  name: string;
  slug: string;
  role: OrgRole;
  memberCount?: number;
  createdAt: string;
}

export interface OrgMemberDto {
  userId: string;
  login: string;
  displayName: string | null;
  avatarUrl: string | null;
  role: OrgRole;
  createdAt: string;
}

export interface UpdateMemberRoleDto {
  role: OrgRole;
}

export interface TransferOwnershipDto {
  newOwnerUserId: string;
}

export interface CreateInvitationDto {
  email?: string;
  role?: OrgRole;
}

export interface InvitationDto {
  id: string;
  orgId: string;
  email: string | null;
  role: OrgRole;
  createdBy: string;
  expiresAt: string;
  createdAt: string;
  revokedAt: string | null;
  acceptedAt: string | null;
}

export interface CreatedInvitationResponseDto {
  invitation: InvitationDto;
  rawToken: string;
  inviteUrl: string;
}

export interface InvitationDetailsDto {
  id: string;
  orgId: string;
  orgName: string;
  orgSlug: string;
  role: OrgRole;
  email: string | null;
  expiresAt: string;
  isValid: boolean;
  invalidReason: string | null;
}

export interface AcceptInvitationResponseDto {
  success: boolean;
  orgId: string;
  orgSlug: string;
  role: OrgRole;
  message: string;
}

export const ActorType = {
  USER: 'USER',
  SYSTEM: 'SYSTEM',
  AI: 'AI',
} as const;

export type ActorType = (typeof ActorType)[keyof typeof ActorType];

export interface AuditEventDto {
  id: string;
  orgId: string;
  actorType: ActorType;
  actorId: string;
  actorName?: string;
  action: string;
  entityType: string;
  entityId: string;
  beforeData?: Record<string, any> | null;
  afterData?: Record<string, any> | null;
  requestId?: string | null;
  createdAt: string;
}

export interface AuditQueryDto {
  entityType?: string;
  entityId?: string;
  limit?: number;
}

// ==========================================
// Dependencies & DAG
// ==========================================

export interface DependencyDto {
  orgId: string;
  projectId: string;
  blockerTaskId: string;
  blockedTaskId: string;
  createdBy: string;
  createdAt: string;
}

export interface CreateDependencyDto {
  blockerTaskId: string;
  blockedTaskId: string;
}

export interface TaskWithDependenciesDto extends TaskDto {
  blockerTaskIds: string[];
  blockedTaskIds: string[];
  isBlocked: boolean;
}

// ==========================================
// Risk Intelligence & What-If Simulation
// ==========================================

export interface TaskRiskDto {
  taskId: string;
  taskNumber: number;
  taskTitle: string;
  status: TaskStatus;
  remainingEstimateWorkdays: number;
  earliestStartWorkday: number;
  earliestFinishWorkday: number;
  latestStartWorkday: number;
  latestFinishWorkday: number;
  slackWorkdays: number;
  isCritical: boolean;
  isBlocked: boolean;
  forecastFinishDate: string | null;
}

export interface ProjectRiskReportDto {
  projectId: string;
  projectKey: string;
  projectName: string;
  calculatedAt: string;
  isAcyclic: boolean;
  cycleNodes?: string[];
  criticalPathTaskIds: string[];
  maxDurationWorkdays: number;
  forecastDeliveryDate: string | null;
  targetDeliveryDate: string | null;
  deliveryVarianceWorkdays: number | null;
  isDelayed: boolean;
  tasks: TaskRiskDto[];
}

export interface WhatIfScenarioInputDto {
  estimateOverrides?: { taskId: string; remainingEstimateWorkdays: number }[];
  addedDependencies?: { blockerTaskId: string; blockedTaskId: string }[];
  removedDependencies?: { blockerTaskId: string; blockedTaskId: string }[];
}

export interface WhatIfScenarioResultDto {
  baselineForecastDeliveryDate: string | null;
  scenarioForecastDeliveryDate: string | null;
  varianceWorkdays: number;
  criticalPathTaskIds: string[];
  impactedTaskIds: string[];
  tasks: TaskRiskDto[];
}

// ==========================================
// Proposals & Change Review
// ==========================================

export const ProposalKind = {
  PLAN: 'PLAN',
  STATUS_CHANGE: 'STATUS_CHANGE',
} as const;
export type ProposalKind = (typeof ProposalKind)[keyof typeof ProposalKind];

export const ProposalState = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
} as const;
export type ProposalState = (typeof ProposalState)[keyof typeof ProposalState];

export interface ProposalTaskCreate {
  tempId: string;
  title: string;
  description?: string;
  status?: TaskStatus;
  remainingEstimateWorkdays?: number;
  dueDate?: string;
}

export interface ProposalTaskUpdate {
  taskId: string;
  expectedVersion: number;
  title?: string;
  description?: string;
  status?: TaskStatus;
  remainingEstimateWorkdays?: number;
  dueDate?: string;
}

export interface ProposalTaskDelete {
  taskId: string;
  expectedVersion: number;
}

export interface ProposalDependencyAdd {
  blockerId: string;
  dependentId: string;
}

export interface ProposalDependencyRemove {
  blockerTaskId: string;
  dependentTaskId: string;
}

export interface ProposalPayload {
  tasksToCreate?: ProposalTaskCreate[];
  tasksToUpdate?: ProposalTaskUpdate[];
  tasksToDelete?: ProposalTaskDelete[];
  dependenciesToAdd?: ProposalDependencyAdd[];
  dependenciesToRemove?: ProposalDependencyRemove[];
}

export interface CreateProposalDto {
  title: string;
  description?: string;
  kind?: ProposalKind;
  payload: ProposalPayload;
}

export interface ProposalDto {
  id: string;
  orgId: string;
  projectId: string;
  kind: ProposalKind;
  state: ProposalState;
  title: string;
  description?: string;
  payload: ProposalPayload;
  rejectionReason?: string;
  createdBy: string;
  creatorLogin?: string;
  reviewedBy?: string;
  reviewerLogin?: string;
  createdAt: string;
  reviewedAt?: string;
}

export interface RejectProposalDto {
  reason?: string;
}

export interface ApproveProposalResponseDto {
  success: boolean;
  proposalId: string;
  state: ProposalState;
  createdTaskCount: number;
  updatedTaskCount: number;
  deletedTaskCount: number;
  addedDependencyCount: number;
  removedDependencyCount: number;
}

export type DeliveryRiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'UNKNOWN';

export interface ReportFactDto {
  id: string;
  type: 'FORECAST_DATE' | 'CRITICAL_PATH' | 'BLOCKED_TASKS' | 'DELIVERY_STATUS' | 'SLACK_WORKDAYS';
  claim: string;
  value: any;
  evidenceIds: string[];
}

export interface ReportSnapshotDto {
  projectId: string;
  projectKey: string;
  projectName: string;
  targetDueDate: string | null;
  forecastDate: string | null;
  deliveryRisk: DeliveryRiskLevel;
  totalTasks: number;
  completedTasks: number;
  inProgressTasks: number;
  todoTasks: number;
  blockedTasks: number;
  criticalPathTaskIds: string[];
  blockedTaskIds: string[];
  validEntityIds: string[];
  facts: ReportFactDto[];
  computedAt: string;
  snapshotHash: string;
}

export interface ProjectReportDto {
  id: string;
  orgId: string;
  projectId: string;
  title: string;
  summary: string;
  deliveryRisk: DeliveryRiskLevel;
  snapshotHash: string;
  snapshot: ReportSnapshotDto;
  claims: ReportFactDto[];
  createdBy: string;
  creatorLogin?: string;
  createdAt: string;
}

export interface CreateReportDto {
  title?: string;
  customNotes?: string;
}

export type AiReservationState = 'RESERVED' | 'SETTLED' | 'RELEASED' | 'AWAITING_RECONCILIATION';

export interface AiBudgetReservationDto {
  id: string;
  orgId: string;
  userId: string;
  idempotencyKey: string;
  reservedAmountCents: number;
  settledAmountCents: number | null;
  state: AiReservationState;
  modelId: string;
  periodKey: string;
  errorMessage?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ReserveAiBudgetDto {
  idempotencyKey: string;
  estimatedCostCents: number;
  modelId: string;
}

export interface SettleAiBudgetDto {
  actualUsageCents: number;
  modelId: string;
}

export interface GithubInstallationDto {
  id: string;
  orgId: string;
  installationId: number;
  accountLogin: string;
  accountId: number;
  accountType: string;
  repositorySelection: string;
  createdBy: string;
  createdAt: string;
}

export interface GithubRepositoryDto {
  id: string;
  orgId: string;
  installationId: number;
  projectId: string | null;
  repoId: number;
  repoName: string;
  repoFullName: string;
  isPrivate: boolean;
  createdAt: string;
}

export interface LinkGithubRepoToProjectDto {
  projectId: string;
}

