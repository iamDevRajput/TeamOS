/**
 * Shared contracts, DTOs, and system-wide type definitions for TeamOS.
 */

export interface HealthResponse {
  status: 'ok' | 'degraded';
  timestamp: string;
  uptimeSeconds: number;
  environment: string;
}

export type OrgRole = 'OWNER' | 'ADMIN' | 'MEMBER';

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

