import { Injectable } from '@nestjs/common';
import { AuditEventDto, AuditQueryDto, OrgRole, ActorType } from '@teamos/contracts';
import { listAuditEvents, TenantContext } from '@teamos/database';

@Injectable()
export class AuditService {
  async getAuditTimeline(
    orgId: string,
    userId: string,
    userRole: OrgRole,
    query: AuditQueryDto,
  ): Promise<AuditEventDto[]> {
    const context: TenantContext = {
      orgId,
      userId,
      role: userRole,
    };

    const events = await listAuditEvents(context, {
      entityType: query.entityType,
      entityId: query.entityId,
      limit: query.limit ? Number(query.limit) : 50,
    });

    return events.map((e) => ({
      id: e.id,
      orgId: e.orgId,
      actorType: e.actorType as ActorType,
      actorId: e.actorId,
      action: e.action,
      entityType: e.entityType,
      entityId: e.entityId,
      beforeData: e.beforeData as Record<string, any> | null,
      afterData: e.afterData as Record<string, any> | null,
      requestId: e.requestId,
      createdAt: e.createdAt.toISOString(),
    }));
  }
}

