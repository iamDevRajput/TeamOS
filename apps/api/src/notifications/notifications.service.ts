import { Injectable, Logger } from '@nestjs/common';
import {
  createApiPrismaClient,
  withTenant,
  TenantContext,
  createNotification as dbCreateNotification,
  listNotifications as dbListNotifications,
  markNotificationRead as dbMarkRead,
  markAllNotificationsRead as dbMarkAllRead,
  getUnreadNotificationCount as dbGetUnreadCount,
  listTasks,
} from '@teamos/database';
import { NotificationDto, NotificationType } from '@teamos/contracts';
import { CollaborationService } from '../collaboration/collaboration.service';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly prisma = createApiPrismaClient();

  constructor(private readonly collaborationService: CollaborationService) {}

  async list(context: TenantContext, limit = 30): Promise<NotificationDto[]> {
    return withTenant(context, async (tx) => {
      const records = await dbListNotifications(tx, context.orgId, context.userId, limit);
      return records.map((r) => ({
        id: r.id,
        orgId: r.orgId,
        userId: r.userId,
        actorId: r.actorId || undefined,
        actorName: r.actor?.displayName || r.actor?.login,
        type: r.type as NotificationType,
        title: r.title,
        body: r.body,
        entityType: r.entityType,
        entityId: r.entityId,
        readAt: r.readAt ? r.readAt.toISOString() : null,
        createdAt: r.createdAt.toISOString(),
      }));
    });
  }

  async getUnreadCount(context: TenantContext): Promise<number> {
    return withTenant(context, async (tx) => {
      return dbGetUnreadCount(tx, context.orgId, context.userId);
    });
  }

  async markAsRead(context: TenantContext, notificationId: string) {
    return withTenant(context, async (tx) => {
      await dbMarkRead(tx, context.orgId, notificationId, context.userId);
      return { success: true };
    });
  }

  async markAllAsRead(context: TenantContext) {
    return withTenant(context, async (tx) => {
      await dbMarkAllRead(tx, context.orgId, context.userId);
      return { success: true };
    });
  }

  async createAndPushNotification(
    context: TenantContext,
    params: {
      userId: string;
      actorId?: string;
      type: NotificationType;
      title: string;
      body: string;
      entityType: string;
      entityId: string;
    }
  ): Promise<NotificationDto> {
    const record = await withTenant(context, async (tx) => {
      return dbCreateNotification(tx, context.orgId, params);
    });

    const dto: NotificationDto = {
      id: record.id,
      orgId: record.orgId,
      userId: record.userId,
      actorId: record.actorId || undefined,
      actorName: record.actor?.displayName || record.actor?.login,
      type: record.type as NotificationType,
      title: record.title,
      body: record.body,
      entityType: record.entityType,
      entityId: record.entityId,
      readAt: null,
      createdAt: record.createdAt.toISOString(),
    };

    // Push live to connected user
    this.collaborationService.broadcastToUser(context.orgId, params.userId, 'notification:received', dto);

    return dto;
  }

  async evaluateDeadlines(context: TenantContext, projectId: string): Promise<{ alertedTasks: number }> {
    const tasks = await listTasks(context, projectId);
    const now = new Date();
    let count = 0;

    for (const task of tasks) {
      if (!task.dueDate || task.status === 'DONE' || task.status === 'CANCELLED') continue;

      const dueDateTime = new Date(task.dueDate).getTime();
      const diffDays = Math.ceil((dueDateTime - now.getTime()) / (1000 * 60 * 60 * 24));

      if (diffDays <= 3 && task.assigneeId) {
        const title = diffDays < 0 ? `Overdue Task Alert: #${task.number}` : `Deadline Approaching: #${task.number}`;
        const body = diffDays < 0
          ? `Task "${task.title}" was due ${Math.abs(diffDays)} days ago.`
          : `Task "${task.title}" is due in ${diffDays} day(s).`;

        await withTenant(context, async (tx) => {
          await dbCreateNotification(tx, context.orgId, {
            userId: task.assigneeId!,
            type: 'DEADLINE_APPROACHING',
            title,
            body,
            entityType: 'task',
            entityId: task.id,
          });
        });
        count++;
      }
    }

    return { alertedTasks: count };
  }
}
