'use client';

import React, { useState } from 'react';
import type { NotificationDto } from '@teamos/contracts';
import { Badge } from './ui';

interface NotificationsTrayProps {
  notifications: NotificationDto[];
  unreadCount: number;
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
  onSelectTask?: (taskId: string) => void;
}

export function NotificationsTray({
  notifications,
  unreadCount,
  onMarkRead,
  onMarkAllRead,
  onSelectTask,
}: NotificationsTrayProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        title="Notifications"
        aria-label="Notifications"
        aria-expanded={isOpen}
      >
        {/* Bell SVG */}
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.75}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>

        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500" />
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl z-50 overflow-hidden flex flex-col max-h-[480px] animate-in fade-in zoom-in-95 duration-100">
            {/* Header */}
            <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/60 dark:bg-slate-800/40">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-900 dark:text-slate-100">Notifications</span>
                {unreadCount > 0 && (
                  <Badge variant="danger" size="xs">
                    {unreadCount} new
                  </Badge>
                )}
              </div>
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={onMarkAllRead}
                  className="text-[11px] font-medium text-purple-600 dark:text-purple-400 hover:underline"
                >
                  Mark all as read
                </button>
              )}
            </div>

            {/* List */}
            <div className="overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60 flex-1">
              {notifications.length === 0 ? (
                <div className="py-12 px-4 text-center">
                  <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto mb-2 text-lg">
                    🔔
                  </div>
                  <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">All caught up!</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">No unread alerts or notifications.</div>
                </div>
              ) : (
                notifications.map((n) => {
                  const isUnread = !n.readAt;

                  return (
                    <div
                      key={n.id}
                      onClick={() => {
                        if (isUnread) onMarkRead(n.id);
                        if (n.entityType === 'task' && onSelectTask) {
                          onSelectTask(n.entityId);
                          setIsOpen(false);
                        }
                      }}
                      className={`p-3 text-left transition-colors cursor-pointer ${
                        isUnread
                          ? 'bg-purple-50/40 dark:bg-purple-950/20 hover:bg-purple-50/70 dark:hover:bg-purple-950/30'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          {isUnread && <span className="w-1.5 h-1.5 rounded-full bg-purple-600 shrink-0" />}
                          <span className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                            {n.title}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-400 shrink-0">
                          {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                        {n.body}
                      </p>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
