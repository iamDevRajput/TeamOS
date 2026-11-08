'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import type { PresenceUserDto, WebSocketEventMessage, NotificationDto } from '@teamos/contracts';

interface UseWorkspaceSocketOptions {
  orgId: string | null;
  projectId?: string | null;
  currentTaskId?: string | null;
  onNotificationReceived?: (notification: NotificationDto) => void;
  onTaskUpdated?: (payload: unknown) => void;
  onRiskAlert?: (payload: unknown) => void;
  onCopilotMessage?: (payload: unknown) => void;
}

export function useWorkspaceSocket({
  orgId,
  projectId,
  currentTaskId,
  onNotificationReceived,
  onTaskUpdated,
  onRiskAlert,
  onCopilotMessage,
}: UseWorkspaceSocketOptions) {
  const [isConnected, setIsConnected] = useState(false);
  const [collaborators, setCollaborators] = useState<PresenceUserDto[]>([]);
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const sendEvent = useCallback((event: string, payload: Record<string, unknown>) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ event, ...payload }));
    }
  }, []);

  useEffect(() => {
    if (!orgId) return;

    let isMounted = true;
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.hostname;
    const port = '3001';

    let token = '';
    if (typeof document !== 'undefined') {
      const match = document.cookie.match(/(?:^|;\s*)(?:teamos_session|__Host-teamos_session)=([^;]+)/);
      if (match) {
        token = decodeURIComponent(match[1]);
      }
    }
    const wsUrl = `${protocol}//${host}:${port}/ws?orgId=${orgId}${token ? `&token=${encodeURIComponent(token)}` : ''}`;

    function connect() {
      if (!isMounted) return;
      try {
        const ws = new WebSocket(wsUrl);
        socketRef.current = ws;

        ws.onopen = () => {
          if (!isMounted) return;
          setIsConnected(true);

          // Subscribe to org and project rooms
          ws.send(JSON.stringify({ type: 'subscribe', room: `org:${orgId}` }));
          if (projectId) {
            ws.send(JSON.stringify({ type: 'subscribe', room: `project:${orgId}:${projectId}` }));
          }

          // Announce presence
          ws.send(
            JSON.stringify({
              type: 'presence:update',
              currentPath: window.location.pathname,
              taskId: currentTaskId || undefined,
            })
          );
        };

        ws.onmessage = (event) => {
          if (!isMounted) return;
          try {
            const data: WebSocketEventMessage = JSON.parse(event.data);

            if (data.event === 'presence:update') {
              const payload = data.payload as { users?: PresenceUserDto[] };
              if (payload?.users) {
                setCollaborators(payload.users);
              }
            } else if (data.event === 'notification:received') {
              onNotificationReceived?.(data.payload as NotificationDto);
            } else if (data.event === 'task:created' || data.event === 'task:updated') {
              onTaskUpdated?.(data.payload);
            } else if (data.event === 'risk:alert') {
              onRiskAlert?.(data.payload);
            } else if (data.event === 'copilot:message') {
              onCopilotMessage?.(data.payload);
            }
          } catch {
            // non-json ping frame or heartbeat
          }
        };

        ws.onclose = () => {
          if (!isMounted) return;
          setIsConnected(false);
          // Auto reconnect after 3s
          reconnectTimeoutRef.current = setTimeout(connect, 3000);
        };

        ws.onerror = () => {
          ws.close();
        };
      } catch {
        reconnectTimeoutRef.current = setTimeout(connect, 4000);
      }
    }

    connect();

    return () => {
      isMounted = false;
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, [orgId, projectId, onNotificationReceived, onTaskUpdated, onRiskAlert, onCopilotMessage]);

  // Update presence when task selection changes
  useEffect(() => {
    if (isConnected && socketRef.current?.readyState === WebSocket.OPEN) {
      sendEvent('presence:update', {
        currentPath: window.location.pathname,
        taskId: currentTaskId || undefined,
      });
    }
  }, [currentTaskId, isConnected, sendEvent]);

  return {
    isConnected,
    collaborators,
    sendEvent,
  };
}
