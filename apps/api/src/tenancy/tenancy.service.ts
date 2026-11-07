import {
  Injectable,
  OnModuleDestroy,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import crypto from 'crypto';
import {
  createApiPrismaClient,
  withTenant,
  createOrganization as dbCreateOrganization,
  listUserOrganizations as dbListUserOrganizations,
  getOrganizationMembership as dbGetOrganizationMembership,
  getInvitationByTokenHash as dbGetInvitationByTokenHash,
  acceptInvitationByTokenHash as dbAcceptInvitationByTokenHash,
  OrgRole,
  Membership,
} from '@teamos/database';
import {
  CreateOrgDto,
  OrgDto,
  OrgMemberDto,
  CreateInvitationDto,
  CreatedInvitationResponseDto,
  InvitationDto,
  InvitationDetailsDto,
  AcceptInvitationResponseDto,
} from '@teamos/contracts';
import { config } from '../common/config';

@Injectable()
export class TenancyService implements OnModuleDestroy {
  private readonly prisma: ReturnType<typeof createApiPrismaClient>;

  constructor() {
    this.prisma = createApiPrismaClient();
  }

  async onModuleDestroy(): Promise<void> {
    await this.prisma.$disconnect();
  }

  /**
   * Retrieves active membership for a user in an organization.
   */
  async getMembership(orgId: string, userId: string): Promise<Membership | null> {
    return dbGetOrganizationMembership(this.prisma, orgId, userId);
  }

  /**
   * Creates a new organization and assigns caller as OWNER.
   */
  async createOrg(userId: string, dto: CreateOrgDto): Promise<OrgDto> {
    const name = dto.name?.trim();
    if (!name || name.length < 2 || name.length > 100) {
      throw new BadRequestException('Organization name must be between 2 and 100 characters.');
    }

    let slug = (dto.slug || '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9-]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 45);

    if (!slug) {
      slug = name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 45) || 'org';
    }

    // Ensure slug uniqueness
    const existingSlug = await this.prisma.organization.findUnique({ where: { slug } });
    if (existingSlug) {
      slug = `${slug}-${crypto.randomBytes(2).toString('hex')}`;
    }

    const { organization, membership } = await dbCreateOrganization(
      this.prisma,
      userId,
      name,
      slug,
    );

    return {
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      role: membership.role as OrgRole,
      memberCount: 1,
      createdAt: organization.createdAt.toISOString(),
    };
  }

  /**
   * Lists all organizations the authenticated user belongs to.
   */
  async listUserOrgs(userId: string): Promise<OrgDto[]> {
    return dbListUserOrganizations(this.prisma, userId);
  }

  /**
   * Retrieves organization details with membership check.
   */
  async getOrgDetails(orgId: string, userId: string): Promise<OrgDto> {
    const membership = await this.getMembership(orgId, userId);
    if (!membership) {
      throw new ForbiddenException('Access denied: you are not a member of this organization.');
    }

    return withTenant(
      {
        orgId,
        userId,
        role: membership.role as OrgRole,
        requestId: crypto.randomUUID(),
      },
      async (tx) => {
        const org = await tx.organization.findUnique({
          where: { id: orgId },
          include: {
            _count: {
              select: { memberships: true },
            },
          },
        });

        if (!org) {
          throw new NotFoundException('Organization not found.');
        }

        return {
          id: org.id,
          name: org.name,
          slug: org.slug,
          role: membership.role as OrgRole,
          memberCount: org._count.memberships,
          createdAt: org.createdAt.toISOString(),
        };
      },
    );
  }

  /**
   * Lists organization members with forced RLS.
   */
  async listMembers(orgId: string, userId: string, role: OrgRole): Promise<OrgMemberDto[]> {
    return withTenant(
      {
        orgId,
        userId,
        role,
        requestId: crypto.randomUUID(),
      },
      async (tx) => {
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
          role: m.role as OrgRole,
          createdAt: m.createdAt.toISOString(),
        }));
      },
    );
  }

  /**
   * Updates a member's role (OWNER only).
   */
  async updateRole(
    orgId: string,
    callerUserId: string,
    callerRole: OrgRole,
    targetUserId: string,
    newRole: OrgRole,
  ): Promise<OrgMemberDto> {
    if (callerRole !== OrgRole.OWNER) {
      throw new ForbiddenException('Only organization owners can change member roles.');
    }

    if (newRole === OrgRole.OWNER) {
      throw new BadRequestException('Direct elevation to OWNER is not permitted. Use ownership transfer.');
    }

    return withTenant(
      {
        orgId,
        userId: callerUserId,
        role: callerRole,
        requestId: crypto.randomUUID(),
      },
      async (tx) => {
        const existing = await tx.membership.findUnique({
          where: { orgId_userId: { orgId, userId: targetUserId } },
          include: { user: true },
        });

        if (!existing) {
          throw new NotFoundException('Member not found in organization.');
        }

        // Prevent demoting the final owner
        if (existing.role === OrgRole.OWNER) {
          const ownerCount = await tx.membership.count({
            where: { orgId, role: OrgRole.OWNER },
          });
          if (ownerCount <= 1) {
            throw new BadRequestException('Cannot demote the final owner of the organization.');
          }
        }

        const updated = await tx.membership.update({
          where: { orgId_userId: { orgId, userId: targetUserId } },
          data: { role: newRole },
          include: { user: true },
        });

        return {
          userId: updated.user.id,
          login: updated.user.login,
          displayName: updated.user.displayName,
          avatarUrl: updated.user.avatarUrl,
          role: updated.role as OrgRole,
          createdAt: updated.createdAt.toISOString(),
        };
      },
    );
  }

  /**
   * Removes a member from the organization with last-owner protection.
   */
  async removeMember(
    orgId: string,
    callerUserId: string,
    callerRole: OrgRole,
    targetUserId: string,
  ): Promise<{ success: boolean }> {
    return withTenant(
      {
        orgId,
        userId: callerUserId,
        role: callerRole,
        requestId: crypto.randomUUID(),
      },
      async (tx) => {
        const target = await tx.membership.findUnique({
          where: { orgId_userId: { orgId, userId: targetUserId } },
        });

        if (!target) {
          throw new NotFoundException('Member not found in organization.');
        }

        const isSelf = callerUserId === targetUserId;

        if (isSelf) {
          // Self leaving organization
          if (target.role === OrgRole.OWNER) {
            const ownerCount = await tx.membership.count({
              where: { orgId, role: OrgRole.OWNER },
            });
            if (ownerCount <= 1) {
              throw new BadRequestException('Cannot leave organization as the final owner.');
            }
          }
        } else {
          // Removing another teammate
          if (callerRole === OrgRole.MEMBER) {
            throw new ForbiddenException('Regular members cannot remove teammates.');
          }
          if (callerRole === OrgRole.ADMIN && (target.role === OrgRole.ADMIN || target.role === OrgRole.OWNER)) {
            throw new ForbiddenException('Admins can only remove regular members.');
          }
          if (target.role === OrgRole.OWNER) {
            const ownerCount = await tx.membership.count({
              where: { orgId, role: OrgRole.OWNER },
            });
            if (ownerCount <= 1) {
              throw new BadRequestException('Cannot remove the final owner of the organization.');
            }
          }
        }

        await tx.membership.delete({
          where: { orgId_userId: { orgId, userId: targetUserId } },
        });

        return { success: true };
      },
    );
  }

  /**
   * Atomically transfers organization ownership (OWNER only).
   */
  async transferOwnership(
    orgId: string,
    callerUserId: string,
    callerRole: OrgRole,
    newOwnerUserId: string,
  ): Promise<{ success: boolean }> {
    if (callerRole !== OrgRole.OWNER) {
      throw new ForbiddenException('Only organization owners can transfer ownership.');
    }

    if (callerUserId === newOwnerUserId) {
      throw new BadRequestException('You are already an owner of this organization.');
    }

    return withTenant(
      {
        orgId,
        userId: callerUserId,
        role: callerRole,
        requestId: crypto.randomUUID(),
      },
      async (tx) => {
        const newOwner = await tx.membership.findUnique({
          where: { orgId_userId: { orgId, userId: newOwnerUserId } },
        });

        if (!newOwner) {
          throw new BadRequestException('Target user must already be a member of the organization.');
        }

        // Promote new owner
        await tx.membership.update({
          where: { orgId_userId: { orgId, userId: newOwnerUserId } },
          data: { role: OrgRole.OWNER },
        });

        // Step down current owner to ADMIN
        await tx.membership.update({
          where: { orgId_userId: { orgId, userId: callerUserId } },
          data: { role: OrgRole.ADMIN },
        });

        return { success: true };
      },
    );
  }

  /**
   * Creates a shareable invitation storing only the cryptographic SHA-256 token hash.
   */
  async inviteTeammate(
    orgId: string,
    callerUserId: string,
    callerRole: OrgRole,
    dto: CreateInvitationDto,
  ): Promise<CreatedInvitationResponseDto> {
    if (callerRole === OrgRole.MEMBER) {
      throw new ForbiddenException('Members cannot invite teammates.');
    }

    if (dto.role === OrgRole.OWNER) {
      throw new BadRequestException('Cannot invite directly as OWNER.');
    }

    const role = dto.role || OrgRole.MEMBER;
    const rawToken = crypto.randomBytes(32).toString('base64url');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const ttlDays = 7;
    const expiresAt = new Date(Date.now() + ttlDays * 86400 * 1000);

    return withTenant(
      {
        orgId,
        userId: callerUserId,
        role: callerRole,
        requestId: crypto.randomUUID(),
      },
      async (tx) => {
        const inv = await tx.invitation.create({
          data: {
            orgId,
            tokenHash,
            role,
            email: dto.email ? dto.email.trim() : null,
            createdBy: callerUserId,
            expiresAt,
          },
        });

        const inviteUrl = `${config.appOrigin}/invite/${rawToken}`;

        return {
          invitation: {
            id: inv.id,
            orgId: inv.orgId,
            email: inv.email,
            role: inv.role as OrgRole,
            createdBy: inv.createdBy,
            expiresAt: inv.expiresAt.toISOString(),
            createdAt: inv.createdAt.toISOString(),
            revokedAt: inv.revokedAt ? inv.revokedAt.toISOString() : null,
            acceptedAt: inv.acceptedAt ? inv.acceptedAt.toISOString() : null,
          },
          rawToken,
          inviteUrl,
        };
      },
    );
  }

  /**
   * Lists pending invitations for an organization.
   */
  async listInvitations(
    orgId: string,
    callerUserId: string,
    callerRole: OrgRole,
  ): Promise<InvitationDto[]> {
    if (callerRole === OrgRole.MEMBER) {
      throw new ForbiddenException('Members cannot view organization invitations.');
    }

    return withTenant(
      {
        orgId,
        userId: callerUserId,
        role: callerRole,
        requestId: crypto.randomUUID(),
      },
      async (tx) => {
        const list = await tx.invitation.findMany({
          where: {
            orgId,
            revokedAt: null,
            acceptedAt: null,
            expiresAt: { gt: new Date() },
          },
          orderBy: { createdAt: 'desc' },
        });

        return list.map((inv) => ({
          id: inv.id,
          orgId: inv.orgId,
          email: inv.email,
          role: inv.role as OrgRole,
          createdBy: inv.createdBy,
          expiresAt: inv.expiresAt.toISOString(),
          createdAt: inv.createdAt.toISOString(),
          revokedAt: inv.revokedAt ? inv.revokedAt.toISOString() : null,
          acceptedAt: inv.acceptedAt ? inv.acceptedAt.toISOString() : null,
        }));
      },
    );
  }

  /**
   * Revokes a pending invitation.
   */
  async revokeInvitation(
    orgId: string,
    callerUserId: string,
    callerRole: OrgRole,
    invitationId: string,
  ): Promise<{ success: boolean }> {
    if (callerRole === OrgRole.MEMBER) {
      throw new ForbiddenException('Members cannot revoke invitations.');
    }

    return withTenant(
      {
        orgId,
        userId: callerUserId,
        role: callerRole,
        requestId: crypto.randomUUID(),
      },
      async (tx) => {
        const inv = await tx.invitation.findFirst({
          where: { id: invitationId, orgId },
        });

        if (!inv) {
          throw new NotFoundException('Invitation not found.');
        }

        if (inv.revokedAt) {
          return { success: true };
        }

        await tx.invitation.update({
          where: { id: invitationId },
          data: { revokedAt: new Date() },
        });

        return { success: true };
      },
    );
  }

  /**
   * Inspects invitation details by raw cryptographic token (public to authenticated users).
   */
  async inspectInvitation(rawToken: string): Promise<InvitationDetailsDto> {
    if (!rawToken || typeof rawToken !== 'string') {
      throw new BadRequestException('Missing invitation token.');
    }

    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const details = await dbGetInvitationByTokenHash(this.prisma, tokenHash);

    if (!details) {
      throw new NotFoundException('Invitation not found or invalid token.');
    }

    return details;
  }

  /**
   * Accepts an invitation with atomic membership creation and concurrency locking.
   */
  async acceptInvitation(rawToken: string, userId: string): Promise<AcceptInvitationResponseDto> {
    if (!rawToken || typeof rawToken !== 'string') {
      throw new BadRequestException('Missing invitation token.');
    }

    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const result = await dbAcceptInvitationByTokenHash(this.prisma, tokenHash, userId);

    if (!result.success) {
      throw new BadRequestException(result.message);
    }

    return result;
  }
}

