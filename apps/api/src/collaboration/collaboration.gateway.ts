import {
  Injectable,
  OnApplicationBootstrap,
  OnApplicationShutdown,
  Logger,
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import { URL } from 'url';
import { SessionService } from '../identity/session.service';
import { CollaborationService } from './collaboration.service';
import { AuthGuard } from '../identity/guards/auth.guard';
import { OrgMembershipGuard } from '../tenancy/guards/org-membership.guard';

@Injectable()
export class CollaborationGateway implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(CollaborationGateway.name);
  private wss: WebSocketServer | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor(
    private readonly adapterHost: HttpAdapterHost,
    private readonly sessionService: SessionService,
    private readonly collaborationService: CollaborationService
  ) {}

  onApplicationBootstrap(): void {
    const server = this.adapterHost.httpAdapter?.getHttpServer();
    if (!server) {
      this.logger.warn('HTTP server not ready for WebSocket mounting');
      return;
    }

    this.wss = new WebSocketServer({ server, path: '/ws' });
    this.logger.log('Native WebSocket Collaboration Gateway mounted at /ws');

    this.wss.on('connection', async (ws: WebSocket, req: IncomingMessage) => {
      await this.handleConnection(ws, req);
    });

    // 30s heartbeat to keep connections healthy
    this.heartbeatInterval = setInterval(() => {
      if (!this.wss) return;
      for (const client of this.wss.clients) {
        if (client.readyState === WebSocket.OPEN) {
          try {
            client.ping();
          } catch {
            client.terminate();
          }
        }
      }
    }, 30000);
  }

  onApplicationShutdown(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    if (this.wss) {
      this.wss.close();
    }
  }

  private async handleConnection(ws: WebSocket, req: IncomingMessage): Promise<void> {
    try {
      const parsedUrl = new URL(req.url || '', 'http://localhost');
      const tokenFromQuery = parsedUrl.searchParams.get('token');
      const orgIdFromQuery = parsedUrl.searchParams.get('orgId') || '';

      let rawToken = tokenFromQuery;
      if (!rawToken && req.headers.cookie) {
        const cookies = req.headers.cookie.split(';').map((c) => c.trim());
        for (const cookie of cookies) {
          if (cookie.startsWith('teamos_session=')) {
            rawToken = decodeURIComponent(cookie.substring('teamos_session='.length));
            break;
          }
        }
      }

      if (!rawToken) {
        ws.close(4401, 'Unauthorized: Missing session token');
        return;
      }

      const sessionUser = await this.sessionService.resolveSession(rawToken);
      if (!sessionUser) {
        ws.close(4401, 'Unauthorized: Invalid or expired session');
        return;
      }

      const clientInfo = this.collaborationService.registerClient(ws, {
        userId: sessionUser.userId,
        login: sessionUser.login,
        displayName: sessionUser.displayName || sessionUser.login,
        avatarUrl: sessionUser.avatarUrl || undefined,
        orgId: orgIdFromQuery,
        lastActiveAt: new Date().toISOString(),
      });

      // Send greeting handshake
      ws.send(
        JSON.stringify({
          event: 'connected',
          payload: {
            userId: clientInfo.userId,
            login: clientInfo.login,
            orgId: clientInfo.orgId,
          },
          timestamp: new Date().toISOString(),
        })
      );

      ws.on('message', (data: Buffer | string) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleClientMessage(ws, message);
        } catch (err) {
          this.logger.warn(`Malformed WebSocket frame: ${(err as Error).message}`);
        }
      });

      ws.on('close', () => {
        this.collaborationService.unregisterClient(ws);
      });

      ws.on('error', (err) => {
        this.logger.warn(`WebSocket error: ${err.message}`);
        this.collaborationService.unregisterClient(ws);
      });
    } catch (err) {
      this.logger.error(`Error during WebSocket handshake: ${(err as Error).message}`);
      ws.close(4500, 'Handshake error');
    }
  }

  private handleClientMessage(ws: WebSocket, message: Record<string, unknown>): void {
    const type = (message.type || message.event) as string;

    switch (type) {
      case 'ping':
        ws.send(JSON.stringify({ event: 'pong', timestamp: new Date().toISOString() }));
        break;

      case 'subscribe':
        if (typeof message.room === 'string') {
          this.collaborationService.joinRoom(ws, message.room);
        }
        break;

      case 'unsubscribe':
        if (typeof message.room === 'string') {
          this.collaborationService.leaveRoom(ws, message.room);
        }
        break;

      case 'presence:update':
      case 'presence_update':
        this.collaborationService.updateClientPresence(ws, {
          currentPath: typeof message.currentPath === 'string' ? message.currentPath : undefined,
          taskId: typeof message.taskId === 'string' ? message.taskId : undefined,
        });
        break;

      default:
        break;
    }
  }
}

@Controller('orgs/:orgId/presence')
@UseGuards(AuthGuard, OrgMembershipGuard)
export class PresenceController {
  constructor(private readonly collaborationService: CollaborationService) {}

  @Get()
  getPresence(
    @Param('orgId') orgId: string,
    @Query('projectId') projectId?: string,
    @Query('taskId') taskId?: string
  ) {
    if (taskId) {
      const room = `task:${orgId}:${taskId}`;
      return { room, users: this.collaborationService.getRoomPresence(room) };
    }
    if (projectId) {
      const room = `project:${orgId}:${projectId}`;
      return { room, users: this.collaborationService.getRoomPresence(room) };
    }
    const room = `org:${orgId}`;
    return { room, users: this.collaborationService.getRoomPresence(room) };
  }
}
