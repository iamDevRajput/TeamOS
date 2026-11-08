'use client';

import React from 'react';
import type { PresenceUserDto } from '@teamos/contracts';

interface CollaboratorsStripProps {
  collaborators: PresenceUserDto[];
  currentUserId?: string;
}

export function CollaboratorsStrip({
  collaborators,
  currentUserId,
}: CollaboratorsStripProps) {
  if (!collaborators || collaborators.length === 0) {
    return null;
  }

  // Deduplicate and filter
  const others = collaborators.filter((c) => c.userId !== currentUserId);

  return (
    <div className="flex items-center gap-1.5" title="Active collaborators currently online">
      <div className="flex -space-x-1.5 overflow-hidden py-0.5">
        {collaborators.slice(0, 4).map((c) => {
          const initials = (c.displayName || c.login || 'U').slice(0, 2).toUpperCase();
          const isSelf = c.userId === currentUserId;

          return (
            <div
              key={c.userId}
              className="relative group shrink-0"
            >
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ring-2 ring-white dark:ring-slate-900 shadow-xs ${
                  isSelf
                    ? 'bg-purple-600 text-white'
                    : 'bg-slate-700 dark:bg-slate-600 text-slate-100'
                }`}
              >
                {initials}
              </div>
              {/* Online pulsing indicator */}
              <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-emerald-500 ring-1 ring-white dark:ring-slate-900" />

              {/* Tooltip */}
              <div className="absolute right-0 top-full mt-1.5 hidden group-hover:block z-50 whitespace-nowrap bg-slate-900 text-slate-100 dark:bg-slate-100 dark:text-slate-900 text-[11px] font-medium py-1 px-2 rounded shadow-lg pointer-events-none">
                <span>{c.displayName || c.login} {isSelf ? '(You)' : ''}</span>
                {c.taskId && <span className="text-slate-400 block text-[9px]">Viewing task</span>}
              </div>
            </div>
          );
        })}
      </div>

      {collaborators.length > 4 && (
        <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500">
          +{collaborators.length - 4}
        </span>
      )}

      <span className="hidden xl:inline-flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400 font-medium">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
        {collaborators.length} online
      </span>
    </div>
  );
}
