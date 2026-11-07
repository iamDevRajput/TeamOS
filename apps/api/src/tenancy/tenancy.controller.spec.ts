import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OrgsController } from './orgs.controller';
import { InvitationsController } from './invitations.controller';
import { TenancyService } from './tenancy.service';
import { OrgMembershipGuard } from './guards/org-membership.guard';
import { Reflector } from '@nestjs/core';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { OrgRole } from '@teamos/contracts';
import { SessionUser } from '@teamos/database';

describe('Tenancy Controllers & Guard Specification', () => {
  let orgsController: OrgsController;
  let invitationsController: InvitationsController;
  let mockTenancyService: Partial<TenancyService>;

  const testOrgId = 'a0000000-0000-0000-0000-000000000001';
  const testUserId = '10000000-0000-0000-0000-000000000001';
  const targetUserId = '20000000-0000-0000-0000-000000000002';

  const mockUser: SessionUser = {
    sessionId: 'session-uuid-1',
    userId: testUserId,
    login: 'testuser',
    displayName: 'Test User',
    avatarUrl: null,
    expiresAt: new Date(Date.now() + 86400000),
    lastActiveAt: new Date(),
  };

  const mockMembership = {
    orgId: testOrgId,
    userId: testUserId,
    role: OrgRole.OWNER,
    createdAt: new Date(),
  };

  beforeEach(() => {
    mockTenancyService = {
      createOrg: vi.fn().mockResolvedValue({
        id: testOrgId,
        name: 'Alpha Corp',
        slug: 'alpha-corp',
        role: OrgRole.OWNER,
        createdAt: new Date().toISOString(),
      }),
      listUserOrgs: vi.fn().mockResolvedValue([
        {
          id: testOrgId,
          name: 'Alpha Corp',
          slug: 'alpha-corp',
          role: OrgRole.OWNER,
          createdAt: new Date().toISOString(),
        },
      ]),
      getOrgDetails: vi.fn().mockResolvedValue({
        id: testOrgId,
        name: 'Alpha Corp',
        slug: 'alpha-corp',
        role: OrgRole.OWNER,
        createdAt: new Date().toISOString(),
      }),
      listMembers: vi.fn().mockResolvedValue([
        {
          id: 'mem-1',
          userId: testUserId,
          login: 'testuser',
          displayName: 'Test User',
          role: OrgRole.OWNER,
          joinedAt: new Date().toISOString(),
        },
      ]),
      updateRole: vi.fn().mockResolvedValue({
        id: 'mem-2',
        userId: targetUserId,
        login: 'teammate',
        displayName: 'Teammate',
        role: OrgRole.ADMIN,
        joinedAt: new Date().toISOString(),
      }),
      removeMember: vi.fn().mockResolvedValue({ success: true }),
      transferOwnership: vi.fn().mockResolvedValue({ success: true }),
      listInvitations: vi.fn().mockResolvedValue([
        {
          id: 'inv-1',
          email: 'colleague@example.com',
          role: OrgRole.MEMBER,
          expiresAt: new Date(Date.now() + 86400000).toISOString(),
          createdAt: new Date().toISOString(),
        },
      ]),
      inviteTeammate: vi.fn().mockResolvedValue({
        invitationId: 'inv-1',
        inviteUrl: 'http://localhost:3000/invite/raw_random_token_32',
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
        role: OrgRole.MEMBER,
      }),
      revokeInvitation: vi.fn().mockResolvedValue({ success: true }),
      inspectInvitation: vi.fn().mockResolvedValue({
        orgName: 'Alpha Corp',
        role: OrgRole.MEMBER,
        inviterName: 'Test User',
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
        isValid: true,
      }),
      acceptInvitation: vi.fn().mockResolvedValue({
        success: true,
        orgId: testOrgId,
        orgSlug: 'alpha-corp',
        role: OrgRole.MEMBER,
        message: 'Invitation accepted successfully',
      }),
      getMembership: vi.fn(),
    };

    orgsController = new OrgsController(mockTenancyService as TenancyService);
    invitationsController = new InvitationsController(mockTenancyService as TenancyService);
  });

  describe('OrgsController', () => {
    it('creates an organization and automatically assigns creator', async () => {
      const res = await orgsController.createOrg(mockUser, { name: 'Alpha Corp' });
      expect(res.name).toBe('Alpha Corp');
      expect(mockTenancyService.createOrg).toHaveBeenCalledWith(mockUser.userId, {
        name: 'Alpha Corp',
      });
    });

    it('lists organizations belonging to authenticated user', async () => {
      const res = await orgsController.listUserOrgs(mockUser);
      expect(res.length).toBe(1);
      expect(res[0].slug).toBe('alpha-corp');
      expect(mockTenancyService.listUserOrgs).toHaveBeenCalledWith(mockUser.userId);
    });

    it('retrieves organization details', async () => {
      const res = await orgsController.getOrgDetails(testOrgId, mockUser);
      expect(res.id).toBe(testOrgId);
      expect(mockTenancyService.getOrgDetails).toHaveBeenCalledWith(testOrgId, mockUser.userId);
    });

    it('lists organization members', async () => {
      const res = await orgsController.listMembers(testOrgId, mockUser, mockMembership as any);
      expect(res.length).toBe(1);
      expect(res[0].role).toBe(OrgRole.OWNER);
      expect(mockTenancyService.listMembers).toHaveBeenCalledWith(
        testOrgId,
        mockUser.userId,
        OrgRole.OWNER,
      );
    });

    it('updates member role', async () => {
      const res = await orgsController.updateMemberRole(
        testOrgId,
        mockUser,
        mockMembership as any,
        targetUserId,
        { role: OrgRole.ADMIN },
      );
      expect(res.role).toBe(OrgRole.ADMIN);
      expect(mockTenancyService.updateRole).toHaveBeenCalledWith(
        testOrgId,
        mockUser.userId,
        OrgRole.OWNER,
        targetUserId,
        OrgRole.ADMIN,
      );
    });

    it('removes member from organization', async () => {
      const res = await orgsController.removeMember(
        testOrgId,
        mockUser,
        mockMembership as any,
        targetUserId,
      );
      expect(res.success).toBe(true);
      expect(mockTenancyService.removeMember).toHaveBeenCalledWith(
        testOrgId,
        mockUser.userId,
        OrgRole.OWNER,
        targetUserId,
      );
    });

    it('transfers ownership', async () => {
      const res = await orgsController.transferOwnership(
        testOrgId,
        mockUser,
        mockMembership as any,
        { newOwnerUserId: targetUserId },
      );
      expect(res.success).toBe(true);
      expect(mockTenancyService.transferOwnership).toHaveBeenCalledWith(
        testOrgId,
        mockUser.userId,
        OrgRole.OWNER,
        targetUserId,
      );
    });

    it('creates and issues teammate invitation', async () => {
      const res = await orgsController.inviteTeammate(
        testOrgId,
        mockUser,
        mockMembership as any,
        { role: OrgRole.MEMBER, email: 'colleague@example.com' },
      );
      expect(res.inviteUrl).toContain('/invite/');
      expect(mockTenancyService.inviteTeammate).toHaveBeenCalledWith(
        testOrgId,
        mockUser.userId,
        OrgRole.OWNER,
        { role: OrgRole.MEMBER, email: 'colleague@example.com' },
      );
    });

    it('lists pending invitations', async () => {
      const res = await orgsController.listInvitations(
        testOrgId,
        mockUser,
        mockMembership as any,
      );
      expect(res.length).toBe(1);
      expect(mockTenancyService.listInvitations).toHaveBeenCalledWith(
        testOrgId,
        mockUser.userId,
        OrgRole.OWNER,
      );
    });

    it('revokes an invitation', async () => {
      const res = await orgsController.revokeInvitation(
        testOrgId,
        mockUser,
        mockMembership as any,
        'inv-1',
      );
      expect(res.success).toBe(true);
      expect(mockTenancyService.revokeInvitation).toHaveBeenCalledWith(
        testOrgId,
        mockUser.userId,
        OrgRole.OWNER,
        'inv-1',
      );
    });
  });

  describe('InvitationsController', () => {
    it('inspects invitation details without revealing token hash', async () => {
      const res = await invitationsController.inspectInvitation('raw_sample_token');
      expect(res.isValid).toBe(true);
      expect(res.orgName).toBe('Alpha Corp');
      expect(mockTenancyService.inspectInvitation).toHaveBeenCalledWith('raw_sample_token');
    });

    it('accepts invitation for authenticated user', async () => {
      const res = await invitationsController.acceptInvitation('raw_sample_token', mockUser);
      expect(res.success).toBe(true);
      expect(res.orgSlug).toBe('alpha-corp');
      expect(mockTenancyService.acceptInvitation).toHaveBeenCalledWith(
        'raw_sample_token',
        mockUser.userId,
      );
    });
  });

  describe('OrgMembershipGuard & RBAC Hierarchy', () => {
    let guard: OrgMembershipGuard;
    let reflector: Reflector;

    beforeEach(() => {
      reflector = new Reflector();
      guard = new OrgMembershipGuard(reflector, mockTenancyService as TenancyService);
    });

    const createExecutionContext = (params: any, user: any, requiredRole?: OrgRole): any => {
      const req: any = {
        params,
        headers: {},
        user,
      };

      vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(requiredRole);

      return {
        switchToHttp: () => ({
          getRequest: () => req,
        }),
        getHandler: () => ({}),
        getClass: () => ({}),
      };
    };

    it('throws BadRequestException when orgId is missing from request params', async () => {
      const context = createExecutionContext({}, mockUser);
      await expect(guard.canActivate(context)).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when orgId is not a valid UUID', async () => {
      const context = createExecutionContext({ orgId: 'invalid-uuid' }, mockUser);
      await expect(guard.canActivate(context)).rejects.toThrow(BadRequestException);
    });

    it('throws ForbiddenException when user is not a member of the organization', async () => {
      const context = createExecutionContext({ orgId: testOrgId }, mockUser);
      (mockTenancyService.getMembership as any).mockResolvedValueOnce(null);

      await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
    });

    it('allows access when user is a MEMBER and no higher role is required', async () => {
      const context = createExecutionContext({ orgId: testOrgId }, mockUser, undefined);
      (mockTenancyService.getMembership as any).mockResolvedValueOnce({
        orgId: testOrgId,
        userId: mockUser.userId,
        role: OrgRole.MEMBER,
        createdAt: new Date(),
      });

      const allowed = await guard.canActivate(context);
      expect(allowed).toBe(true);
    });

    it('allows access when user is OWNER and ADMIN role is required (Role Hierarchy)', async () => {
      const context = createExecutionContext({ orgId: testOrgId }, mockUser, OrgRole.ADMIN);
      (mockTenancyService.getMembership as any).mockResolvedValueOnce({
        orgId: testOrgId,
        userId: mockUser.userId,
        role: OrgRole.OWNER,
        createdAt: new Date(),
      });

      const allowed = await guard.canActivate(context);
      expect(allowed).toBe(true);
    });

    it('denies access (throws ForbiddenException) when user is MEMBER and ADMIN role is required', async () => {
      const context = createExecutionContext({ orgId: testOrgId }, mockUser, OrgRole.ADMIN);
      (mockTenancyService.getMembership as any).mockResolvedValueOnce({
        orgId: testOrgId,
        userId: mockUser.userId,
        role: OrgRole.MEMBER,
        createdAt: new Date(),
      });

      await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
    });

    it('denies access when user is ADMIN and OWNER role is required', async () => {
      const context = createExecutionContext({ orgId: testOrgId }, mockUser, OrgRole.OWNER);
      (mockTenancyService.getMembership as any).mockResolvedValueOnce({
        orgId: testOrgId,
        userId: mockUser.userId,
        role: OrgRole.ADMIN,
        createdAt: new Date(),
      });

      await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
    });
  });
});
