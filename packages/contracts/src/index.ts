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
  readonly role: OrgRole;
  readonly requestId: string;
}

export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED';

export interface TaskDto {
  id: string;
  orgId: string;
  projectId: string;
  number: number;
  title: string;
  description?: string;
  status: TaskStatus;
  assigneeId?: string;
  remainingEstimateWorkdays?: number;
  dueDate?: string;
  version: number;
  createdAt: string;
  updatedAt: string;
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


