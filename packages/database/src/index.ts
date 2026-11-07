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

// Re-export safe types and enums from Prisma Client
export { TaskStatus, ActorType, OutboxStatus, OrgRole, Prisma } from "@prisma/client";

export type {
  User,
  Session,
  Organization,
  Membership,
  Invitation,
  Project,
  Task,
  TaskDependency,
  AuditEvent,
  OutboxEvent,
} from "@prisma/client";
