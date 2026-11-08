import { Injectable, Logger } from '@nestjs/common';
import { WebSocket } from 'ws';
import { PresenceUserDto, WebSocketEventMessage } from '@teamos/contracts';

export interface ClientConnectionInfo {
  ws: WebSocket;
  userId: string;
  login: string;
  displayName?: string;
  avatarUrl?: string;
  orgId: string;
  rooms: Set<string>;
  lastActiveAt: string;
  currentPath?: string;
  taskId?: string;
}

@Injectable()
export class CollaborationService {
  private readonly logger = new Logger(CollaborationService.name);
  private readonly clients = new Map<WebSocket, ClientConnectionInfo>();
  private readonly roomSubscribers = new Map<string, Set<WebSocket>>();

  registerClient(ws: WebSocket, info: Omit<ClientConnectionInfo, 'ws' | 'rooms'>): ClientConnectionInfo {
    const clientInfo: ClientConnectionInfo = {
      ...info,
      ws,
      rooms: new Set<string>(),
    };
    this.clients.set(ws, clientInfo);

    // Auto-subscribe to user-specific and org-wide room
    const userRoom = `user:${info.orgId}:${info.userId}`;
    const orgRoom = `org:${info.orgId}`;
    this.joinRoom(ws, userRoom);
    this.joinRoom(ws, orgRoom);

    return clientInfo;
  }

  unregisterClient(ws: WebSocket): void {
    const info = this.clients.get(ws);
    if (!info) return;

    for (const room of info.rooms) {
      const subs = this.roomSubscribers.get(room);
      if (subs) {
        subs.delete(ws);
        if (subs.size === 0) {
          this.roomSubscribers.delete(room);
        } else {
          this.broadcastPresence(room);
        }
      }
    }
    this.clients.delete(ws);
  }

  joinRoom(ws: WebSocket, room: string): void {
    const info = this.clients.get(ws);
    if (!info) return;

    info.rooms.add(room);
    if (!this.roomSubscribers.has(room)) {
      this.roomSubscribers.set(room, new Set());
    }
    this.roomSubscribers.get(room)!.add(ws);
    this.broadcastPresence(room);
  }

  leaveRoom(ws: WebSocket, room: string): void {
    const info = this.clients.get(ws);
    if (info) {
      info.rooms.delete(room);
    }
    const subs = this.roomSubscribers.get(room);
    if (subs) {
      subs.delete(ws);
      if (subs.size === 0) {
        this.roomSubscribers.delete(room);
      } else {
        this.broadcastPresence(room);
      }
    }
  }

  updateClientPresence(ws: WebSocket, data: { currentPath?: string; taskId?: string }): void {
    const info = this.clients.get(ws);
    if (!info) return;

    info.lastActiveAt = new Date().toISOString();
    if (data.currentPath !== undefined) info.currentPath = data.currentPath;
    if (data.taskId !== undefined) info.taskId = data.taskId;

    for (const room of info.rooms) {
      this.broadcastPresence(room);
    }
  }

  getRoomPresence(room: string): PresenceUserDto[] {
    const subs = this.roomSubscribers.get(room);
    if (!subs) return [];

    const map = new Map<string, PresenceUserDto>();
    for (const ws of subs) {
      const info = this.clients.get(ws);
      if (info) {
        map.set(info.userId, {
          userId: info.userId,
          login: info.login,
          displayName: info.displayName,
          avatarUrl: info.avatarUrl,
          lastActiveAt: info.lastActiveAt,
          currentPath: info.currentPath,
          taskId: info.taskId,
        });
      }
    }
    return Array.from(map.values());
  }

  broadcastPresence(room: string): void {
    const users = this.getRoomPresence(room);
    this.broadcastToRoom(room, 'presence:update', {
      room,
      users,
    });
  }

  broadcastToRoom<T = unknown>(room: string, event: string, payload: T): void {
    const subs = this.roomSubscribers.get(room);
    if (!subs || subs.size === 0) return;

    const message: WebSocketEventMessage<T> = {
      event,
      payload,
      room,
      timestamp: new Date().toISOString(),
    };
    const serialized = JSON.stringify(message);

    for (const ws of subs) {
      if (ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(serialized);
        } catch (err) {
          this.logger.warn(`Failed to send WebSocket message: ${(err as Error).message}`);
        }
      }
    }
  }

  broadcastToOrg<T = unknown>(orgId: string, event: string, payload: T): void {
    this.broadcastToRoom(`org:${orgId}`, event, payload);
  }

  broadcastToProject<T = unknown>(orgId: string, projectId: string, event: string, payload: T): void {
    this.broadcastToRoom(`project:${orgId}:${projectId}`, event, payload);
  }

  broadcastToUser<T = unknown>(orgId: string, userId: string, event: string, payload: T): void {
    this.broadcastToRoom(`user:${orgId}:${userId}`, event, payload);
  }
}
