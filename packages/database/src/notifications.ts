import { Prisma } from "@prisma/client";

export interface CreateNotificationParams {
  userId: string;
  actorId?: string;
  type: string;
  title: string;
  body: string;
  entityType: string;
  entityId: string;
}

export async function createNotification(
  tx: Prisma.TransactionClient,
  orgId: string,
  params: CreateNotificationParams
) {
  return tx.notification.create({
    data: {
      orgId,
      userId: params.userId,
      actorId: params.actorId ?? null,
      type: params.type,
      title: params.title,
      body: params.body,
      entityType: params.entityType,
      entityId: params.entityId,
    },
    include: {
      actor: {
        select: { id: true, login: true, displayName: true, avatarUrl: true },
      },
    },
  });
}

export async function listNotifications(
  tx: Prisma.TransactionClient,
  orgId: string,
  userId: string,
  limit = 30
) {
  return tx.notification.findMany({
    where: {
      orgId,
      userId,
    },
    include: {
      actor: {
        select: { id: true, login: true, displayName: true, avatarUrl: true },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    take: limit,
  });
}

export async function markNotificationRead(
  tx: Prisma.TransactionClient,
  orgId: string,
  notificationId: string,
  userId: string
) {
  return tx.notification.updateMany({
    where: {
      id: notificationId,
      orgId,
      userId,
      readAt: null,
    },
    data: {
      readAt: new Date(),
    },
  });
}

export async function markAllNotificationsRead(
  tx: Prisma.TransactionClient,
  orgId: string,
  userId: string
) {
  return tx.notification.updateMany({
    where: {
      orgId,
      userId,
      readAt: null,
    },
    data: {
      readAt: new Date(),
    },
  });
}

export async function getUnreadNotificationCount(
  tx: Prisma.TransactionClient,
  orgId: string,
  userId: string
): Promise<number> {
  return tx.notification.count({
    where: {
      orgId,
      userId,
      readAt: null,
    },
  });
}
