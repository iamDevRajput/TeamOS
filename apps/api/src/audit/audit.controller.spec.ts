import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuditController } from './audit.controller';
import { AuditService } from './audit.service';
import { OrgRole, ActorType } from '@teamos/contracts';
import { SessionUser, Membership } from '@teamos/database';

describe('AuditController Specification', () => {
  let controller: AuditController;
  let mockAuditService: Partial<AuditService>;

  const mockUser: SessionUser = {
    sessionId: 'session-uuid-1',
    userId: '10000000-0000-0000-0000-000000000001',
    login: 'audit-admin',
    displayName: 'Audit Admin',
    avatarUrl: null,
    expiresAt: new Date(Date.now() + 86400000),
    lastActiveAt: new Date(),
  };

  const mockMembership: Membership = {
    orgId: 'a0000000-0000-0000-0000-000000000001',
    userId: mockUser.userId,
    role: OrgRole.ADMIN,
    createdAt: new Date(),
  };

  beforeEach(() => {
    mockAuditService = {
      getAuditTimeline: vi.fn().mockResolvedValue([
        {
          id: 'event-uuid-1',
          orgId: mockMembership.orgId,
          actorType: ActorType.USER,
          actorId: mockUser.userId,
          action: 'MEMBER_ROLE_UPDATED',
          entityType: 'MEMBERSHIP',
          entityId: '20000000-0000-0000-0000-000000000002',
          beforeData: { role: 'MEMBER' },
          afterData: { role: 'ADMIN' },
          requestId: 'req-123',
          createdAt: new Date().toISOString(),
        },
      ]),
    };

    controller = new AuditController(mockAuditService as AuditService);
  });

  it('retrieves audit timeline for active organization', async () => {
    const events = await controller.getTimeline(
      mockMembership.orgId,
      mockUser,
      mockMembership,
      { limit: 20 },
    );

    expect(events.length).toBe(1);
    expect(events[0].action).toBe('MEMBER_ROLE_UPDATED');
    expect(mockAuditService.getAuditTimeline).toHaveBeenCalledWith(
      mockMembership.orgId,
      mockUser.userId,
      OrgRole.ADMIN,
      { limit: 20 },
    );
  });
});

