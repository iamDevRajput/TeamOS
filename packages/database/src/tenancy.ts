/**
 * TeamOS Database Package — Organizations, Memberships, Invitations & RBAC
 *
 * Rules:
 * - Atomic organization creation with automatic OWNER assignment.
 * - Enforces last-owner protection on demotion or removal.
 * - Cryptographic token hashing for invitations.
 * - Forced RLS compatibility and transactional integrity.
 */

import { PrismaClient, Prisma, Organization, Membership, OrgRole, Invitation, ActorType } from '@prisma/client';
import { recordAuditEvent } from './audit';
import {
  OrgDto,
  OrgMemberDto,
  InvitationDetailsDto,
  AcceptInvitationResponseDto,
} from '@teamos/contracts';

export interface CreateOrgResult {
  organization: Organization;
  membership: Membership;
}

/**
 * Creates an API-scoped Prisma Client using DATABASE_URL (teamos_api_role).
 */
export function createApiPrismaClient(databaseUrl?: string): PrismaClient {
  return new PrismaClient({
    datasources: {
      db: {
        url:
          databaseUrl ||
          process.env.DATABASE_URL ||
          'postgresql://teamos_api_role:teamos_api_password@localhost:5432/teamos?schema=public',
      },
    },
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });
}

/**
 * Helper to run operations within a tenant context, setting app.org_id for forced RLS.
 */
async function withTenantContext<T>(
  prisma: PrismaClient,
  orgId: string,
  userId: string,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw(
      Prisma.sql`SELECT set_config('app.org_id', ${orgId}, true)`
    );
    await tx.$executeRaw(
      Prisma.sql`SELECT set_config('app.user_id', ${userId}, true)`
    );
    return fn(tx);
  });
}

/**
 * Creates an organization and automatically assigns the creator as OWNER.
 * Runs atomically via hardened stored procedure.
 */
export async function createOrganization(
  prisma: PrismaClient,
  userId: string,
  name: string,
  slug: string,
): Promise<CreateOrgResult> {
  interface RawCreateOrg {
    org_id: string;
    org_name: string;
    org_slug: string;
    user_role: OrgRole;
    created_at: Date;
  }

  const rows = await prisma.$queryRaw<RawCreateOrg[]>(
    Prisma.sql`SELECT * FROM public.create_organization(${userId}::uuid, ${name}::text, ${slug}::text)`
  );

  if (rows.length === 0) {
    throw new Error('Failed to create organization');
  }

  const row = rows[0];
  return {
    organization: {
      id: row.org_id,
      name: row.org_name,
      slug: row.org_slug,
      aiBudgetCentsMonthly: 0,
      createdAt: row.created_at,
    },
    membership: {
      orgId: row.org_id,
      userId,
      role: row.user_role,
      createdAt: row.created_at,
    },
  };
}

/**
 * Lists all organizations that the authenticated user is a member of.
 * Includes user's role and member count.
 * Prevents unauthorized organization enumeration.
 */
export async function listUserOrganizations(
  prisma: PrismaClient,
  userId: string,
): Promise<OrgDto[]> {
  interface RawUserOrg {
    org_id: string;
    org_name: string;
    org_slug: string;
    user_role: OrgRole;
    member_count: bigint | number;
    created_at: Date;
  }

  const rows = await prisma.$queryRaw<RawUserOrg[]>(
    Prisma.sql`SELECT * FROM public.list_user_organizations(${userId}::uuid)`
  );

  return rows.map((r) => ({
    id: r.org_id,
    name: r.org_name,
    slug: r.org_slug,
    role: r.user_role,
    memberCount: Number(r.member_count),
    createdAt: r.created_at.toISOString(),
  }));
}

/**
 * Retrieves a user's active membership in an organization.
 * Calls public.check_membership.
 */
export async function getOrganizationMembership(
  prisma: PrismaClient,
  orgId: string,
  userId: string,
): Promise<Membership | null> {
  const rows = await prisma.$queryRaw<any[]>(
    Prisma.sql`SELECT * FROM public.check_membership(${orgId}::uuid, ${userId}::uuid)`
  );

  if (rows.length === 0) return null;
  const row = rows[0];
  return {
    orgId: row.org_id || row.orgId,
    userId: row.user_id || row.userId,
    role: row.role,
    createdAt: row.created_at || row.createdAt,
  } as Membership;
}

/**
 * Retrieves organization details by ID within tenant context.
 */
export async function getOrganizationById(
  prisma: PrismaClient,
  orgId: string,
  userId = '00000000-0000-0000-0000-000000000000',
): Promise<Organization | null> {
  return withTenantContext(prisma, orgId, userId, async (tx) => {
    return tx.organization.findUnique({
      where: { id: orgId },
    });
  });
}

/**
 * Lists all members of an organization with profile information.
 */
export async function listOrganizationMembers(
  prisma: PrismaClient,
  orgId: string,
  userId = '00000000-0000-0000-0000-000000000000',
): Promise<OrgMemberDto[]> {
  return withTenantContext(prisma, orgId, userId, async (tx) => {
    const members = await tx.membership.findMany({
      where: { orgId },
      include: {
        user: {
          select: {
            id: true,
            login: true,
            displayName: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: [
        { role: 'asc' }, // OWNER before ADMIN before MEMBER
        { createdAt: 'asc' },
      ],
    });

    return members.map((m) => ({
      userId: m.user.id,
      login: m.user.login,
      displayName: m.user.displayName,
      avatarUrl: m.user.avatarUrl,
      role: m.role,
      createdAt: m.createdAt.toISOString(),
    }));
  });
}

/**
 * Updates a member's role with last-owner protection.
 */
export async function updateMemberRole(
  prisma: PrismaClient,
  orgId: string,
  targetUserId: string,
  newRole: OrgRole,
  callerUserId?: string,
): Promise<Membership> {
  if (newRole === OrgRole.OWNER) {
    throw new Error('Direct role elevation to OWNER is not permitted. Use ownership transfer.');
  }

  const effectiveCaller = callerUserId || targetUserId;

  return withTenantContext(prisma, orgId, effectiveCaller, async (tx) => {
    const existing = await tx.membership.findUnique({
      where: { orgId_userId: { orgId, userId: targetUserId } },
    });

    if (!existing) {
      throw new Error('Member not found in organization.');
    }

    // Last owner protection
    if (existing.role === OrgRole.OWNER) {
      const ownerCount = await tx.membership.count({
        where: { orgId, role: OrgRole.OWNER },
      });
      if (ownerCount <= 1) {
        throw new Error('Cannot demote the final owner of the organization.');
      }
    }

    const updated = await tx.membership.update({
      where: { orgId_userId: { orgId, userId: targetUserId } },
      data: { role: newRole },
    });

    await recordAuditEvent(tx, {
      orgId,
      actorType: ActorType.USER,
      actorId: effectiveCaller,
      action: 'MEMBER_ROLE_UPDATED',
      entityType: 'MEMBERSHIP',
      entityId: targetUserId,
      beforeData: { role: existing.role },
      afterData: { role: newRole },
    });

    return updated;
  });
}

/**
 * Removes a member from an organization with last-owner protection.
 */
export async function removeMember(
  prisma: PrismaClient,
  orgId: string,
  targetUserId: string,
  callerUserId?: string,
): Promise<void> {
  const effectiveCaller = callerUserId || targetUserId;

  await withTenantContext(prisma, orgId, effectiveCaller, async (tx) => {
    const existing = await tx.membership.findUnique({
      where: { orgId_userId: { orgId, userId: targetUserId } },
    });

    if (!existing) {
      throw new Error('Member not found in organization.');
    }

    // Last owner protection
    if (existing.role === OrgRole.OWNER) {
      const ownerCount = await tx.membership.count({
        where: { orgId, role: OrgRole.OWNER },
      });
      if (ownerCount <= 1) {
        throw new Error('Cannot remove the final owner of the organization.');
      }
    }

    await tx.membership.delete({
      where: { orgId_userId: { orgId, userId: targetUserId } },
    });

    await recordAuditEvent(tx, {
      orgId,
      actorType: ActorType.USER,
      actorId: effectiveCaller,
      action: 'MEMBER_REMOVED',
      entityType: 'MEMBERSHIP',
      entityId: targetUserId,
      beforeData: { userId: targetUserId, role: existing.role },
    });
  });
}

/**
 * Atomically transfers organization ownership to another existing member.
 * The current owner is stepped down to ADMIN.
 */
export async function transferOwnership(
  prisma: PrismaClient,
  orgId: string,
  currentOwnerUserId: string,
  newOwnerUserId: string,
): Promise<{ success: boolean }> {
  if (currentOwnerUserId === newOwnerUserId) {
    throw new Error('Target user is already an owner.');
  }

  return withTenantContext(prisma, orgId, currentOwnerUserId, async (tx) => {
    const currentOwner = await tx.membership.findUnique({
      where: { orgId_userId: { orgId, userId: currentOwnerUserId } },
    });
    if (!currentOwner || currentOwner.role !== OrgRole.OWNER) {
      throw new Error('Caller is not an owner of the organization.');
    }

    const newOwner = await tx.membership.findUnique({
      where: { orgId_userId: { orgId, userId: newOwnerUserId } },
    });
    if (!newOwner) {
      throw new Error('Target user must already be a member of the organization.');
    }

    // Promote new owner
    await tx.membership.update({
      where: { orgId_userId: { orgId, userId: newOwnerUserId } },
      data: { role: OrgRole.OWNER },
    });

    // Step down current owner to ADMIN
    await tx.membership.update({
      where: { orgId_userId: { orgId, userId: currentOwnerUserId } },
      data: { role: OrgRole.ADMIN },
    });

    await recordAuditEvent(tx, {
      orgId,
      actorType: ActorType.USER,
      actorId: currentOwnerUserId,
      action: 'OWNERSHIP_TRANSFERRED',
      entityType: 'ORGANIZATION',
      entityId: orgId,
      beforeData: { ownerUserId: currentOwnerUserId },
      afterData: { ownerUserId: newOwnerUserId },
    });

    return { success: true };
  });
}

/**
 * Creates an invitation storing only the cryptographic token hash.
 */
export async function createInvitation(
  prisma: PrismaClient,
  orgId: string,
  creatorUserId: string,
  tokenHash: string,
  role: OrgRole = OrgRole.MEMBER,
  email?: string,
  ttlDays = 7,
): Promise<Invitation> {
  const expiresAt = new Date(Date.now() + ttlDays * 86400 * 1000);

  return withTenantContext(prisma, orgId, creatorUserId, async (tx) => {
    const inv = await tx.invitation.create({
      data: {
        orgId,
        tokenHash,
        role,
        email: email || null,
        createdBy: creatorUserId,
        expiresAt,
      },
    });

    await recordAuditEvent(tx, {
      orgId,
      actorType: ActorType.USER,
      actorId: creatorUserId,
      action: 'INVITATION_CREATED',
      entityType: 'INVITATION',
      entityId: inv.id,
      afterData: { role, email: email || null, expiresAt: expiresAt.toISOString() },
    });

    return inv;
  });
}

/**
 * Lists pending, unexpired, and unrevoked invitations for an organization.
 */
export async function listPendingInvitations(
  prisma: PrismaClient,
  orgId: string,
  callerUserId = '00000000-0000-0000-0000-000000000000',
): Promise<Invitation[]> {
  return withTenantContext(prisma, orgId, callerUserId, async (tx) => {
    return tx.invitation.findMany({
      where: {
        orgId,
        revokedAt: null,
        acceptedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });
  });
}

/**
 * Revokes a pending invitation.
 */
export async function revokeInvitation(
  prisma: PrismaClient,
  orgId: string,
  invitationId: string,
  callerUserId = '00000000-0000-0000-0000-000000000000',
): Promise<boolean> {
  return withTenantContext(prisma, orgId, callerUserId, async (tx) => {
    const result = await tx.invitation.updateMany({
      where: {
        id: invitationId,
        orgId,
        revokedAt: null,
        acceptedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });

    if (result.count > 0) {
      await recordAuditEvent(tx, {
        orgId,
        actorType: ActorType.USER,
        actorId: callerUserId,
        action: 'INVITATION_REVOKED',
        entityType: 'INVITATION',
        entityId: invitationId,
      });
    }

    return result.count > 0;
  });
}

/**
 * Inspects invitation metadata and organization info using the token hash.
 * Calls SECURITY DEFINER function public.get_invitation_by_token.
 */
export async function getInvitationByTokenHash(
  prisma: PrismaClient,
  tokenHash: string,
): Promise<InvitationDetailsDto | null> {
  interface RawInvitationDetails {
    invitation_id: string;
    org_id: string;
    org_name: string;
    org_slug: string;
    email: string | null;
    role: OrgRole;
    expires_at: Date;
    created_at: Date;
    is_valid: boolean;
    invalid_reason: string | null;
  }

  const rows = await prisma.$queryRaw<RawInvitationDetails[]>(
    Prisma.sql`SELECT * FROM public.get_invitation_by_token(${tokenHash}::text)`
  );

  if (rows.length === 0) {
    return null;
  }

  const row = rows[0];
  return {
    id: row.invitation_id,
    orgId: row.org_id,
    orgName: row.org_name,
    orgSlug: row.org_slug,
    role: row.role,
    email: row.email,
    expiresAt: row.expires_at.toISOString(),
    isValid: row.is_valid,
    invalidReason: row.invalid_reason,
  };
}

/**
 * Accepts an invitation with atomic membership creation and concurrency lock.
 * Calls SECURITY DEFINER function public.accept_invitation.
 */
export async function acceptInvitationByTokenHash(
  prisma: PrismaClient,
  tokenHash: string,
  userId: string,
): Promise<AcceptInvitationResponseDto> {
  interface RawAcceptResult {
    success: boolean;
    org_id: string | null;
    org_slug: string | null;
    role: OrgRole | null;
    message: string;
  }

  const rows = await prisma.$queryRaw<RawAcceptResult[]>(
    Prisma.sql`SELECT * FROM public.accept_invitation(${tokenHash}::text, ${userId}::uuid)`
  );

  if (rows.length === 0) {
    return {
      success: false,
      orgId: '',
      orgSlug: '',
      role: OrgRole.MEMBER,
      message: 'Unknown invitation acceptance error',
    };
  }

  const row = rows[0];
  return {
    success: row.success,
    orgId: row.org_id || '',
    orgSlug: row.org_slug || '',
    role: row.role || OrgRole.MEMBER,
    message: row.message,
  };
}
