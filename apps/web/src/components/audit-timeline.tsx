'use client';

import React, { useEffect, useState } from 'react';
import type { AuditEventDto } from '@teamos/contracts';
import { Badge, Select, EmptyState } from './ui';
import { ShieldIcon, ClockIcon, LockIcon } from './ui/icons';

interface AuditTimelineProps {
  orgId: string;
  apiBaseUrl: string;
}

export function AuditTimeline({ orgId, apiBaseUrl }: AuditTimelineProps) {
  const [events, setEvents] = useState<AuditEventDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterEntity, setFilterEntity] = useState<string>('ALL');
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);

  useEffect(() => {
    async function loadAudit() {
      setLoading(true);
      setError(null);
      try {
        const queryParams = new URLSearchParams();
        if (filterEntity !== 'ALL') {
          queryParams.set('entityType', filterEntity);
        }
        queryParams.set('limit', '50');

        const res = await fetch(
          `${apiBaseUrl}/api/v1/orgs/${orgId}/audit?${queryParams.toString()}`,
          {
            credentials: 'include',
          },
        );

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.message || `Failed to load audit logs (${res.status})`);
        }

        const data: AuditEventDto[] = await res.json();
        setEvents(data);
      } catch (err: any) {
        setError(err.message || 'Error loading audit timeline.');
      } finally {
        setLoading(false);
      }
    }

    loadAudit();
  }, [orgId, apiBaseUrl, filterEntity]);

  function getBadgeVariant(action: string) {
    if (action.includes('CREATED') || action.includes('ADDED') || action.includes('APPROVED')) {
      return 'success' as const;
    }
    if (action.includes('UPDATED') || action.includes('TRANSFERRED')) {
      return 'info' as const;
    }
    if (action.includes('REMOVED') || action.includes('REVOKED') || action.includes('DELETED') || action.includes('REJECTED')) {
      return 'danger' as const;
    }
    return 'default' as const;
  }

  return (
    <div className="space-y-4">
      {/* Header & Filter Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-200/80 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 tracking-tight">Security Audit Log</h3>
            <Badge variant="purple" size="xs">
              Append-Only
            </Badge>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Immutable cryptographic record of all sensitive organizational mutations and permissions.
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 whitespace-nowrap">Filter:</span>
          <select
            value={filterEntity}
            onChange={(e) => setFilterEntity(e.target.value)}
            className="w-full sm:w-44 px-2.5 py-1.5 text-xs bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 rounded-lg shadow-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
          >
            <option value="ALL">All Entities</option>
            <option value="ORGANIZATION">Organization</option>
            <option value="MEMBERSHIP">Membership & RBAC</option>
            <option value="INVITATION">Invitations</option>
            <option value="PROJECT">Projects</option>
            <option value="TASK">Tasks & Dependencies</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="p-3 text-xs text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border border-rose-200/80 dark:border-rose-900/60 rounded-lg">
          {error}
        </div>
      )}

      {loading ? (
        <div className="p-8 text-center text-xs text-slate-400 dark:text-slate-500">Loading audit records...</div>
      ) : events.length === 0 ? (
        <EmptyState
          icon={<LockIcon className="w-5 h-5" />}
          title="No audit events found"
          description="Actions such as project creation, role changes, member removals, and invitations will be securely recorded here."
        />
      ) : (
        <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-800">
          {events.map((evt) => {
            const isExpanded = expandedEventId === evt.id;
            const hasData = evt.beforeData || evt.afterData;

            return (
              <div key={evt.id} className="relative">
                {/* Timeline node */}
                <div className="absolute -left-[19px] top-3.5 w-2.5 h-2.5 rounded-full bg-blue-600 ring-4 ring-white dark:ring-slate-900" />

                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/90 dark:border-slate-800 p-4 shadow-xs hover:border-slate-300 dark:hover:border-slate-700 transition-all space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Badge variant={getBadgeVariant(evt.action)} size="xs">
                        {evt.action}
                      </Badge>
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200 tracking-tight">
                        {evt.entityType}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 text-[11px] text-slate-400 dark:text-slate-500 font-mono">
                      <ClockIcon className="w-3 h-3 text-slate-400 dark:text-slate-500" />
                      <span>{new Date(evt.createdAt).toLocaleString()}</span>
                    </div>
                  </div>

                  <div className="text-xs text-slate-600 dark:text-slate-400 flex flex-wrap items-center gap-x-4 gap-y-1">
                    <div>
                      <span className="text-slate-400 dark:text-slate-500 font-normal">Actor:</span>{' '}
                      <span className="font-mono text-slate-800 dark:text-slate-200 font-medium">
                        {evt.actorType} ({evt.actorId.slice(0, 8)})
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 dark:text-slate-500 font-normal">Entity ID:</span>{' '}
                      <span className="font-mono text-slate-800 dark:text-slate-200 font-medium">
                        {evt.entityId.slice(0, 8)}
                      </span>
                    </div>
                    {evt.requestId && (
                      <div>
                        <span className="text-slate-400 dark:text-slate-500 font-normal">Request:</span>{' '}
                        <span className="font-mono text-slate-500 dark:text-slate-400 text-[11px]">
                          {evt.requestId.slice(0, 8)}
                        </span>
                      </div>
                    )}
                  </div>

                  {hasData && (
                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedEventId((prev) => (prev === evt.id ? null : evt.id))
                        }
                        className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors inline-flex items-center gap-1"
                      >
                        <span>{isExpanded ? 'Hide Payload Diff' : 'View Payload Diff'}</span>
                        <span className="text-[10px]">{isExpanded ? '▲' : '▼'}</span>
                      </button>

                      {isExpanded && (
                        <div className="mt-2.5 grid grid-cols-1 md:grid-cols-2 gap-2 text-xs font-mono bg-slate-900 dark:bg-black text-slate-200 p-3 rounded-lg border border-slate-800 overflow-x-auto">
                          <div>
                            <span className="text-slate-400 block font-sans font-bold text-[10px] uppercase tracking-wider mb-1">
                              Before State
                            </span>
                            <pre className="text-emerald-400 whitespace-pre-wrap break-all text-[11px] leading-relaxed">
                              {evt.beforeData ? JSON.stringify(evt.beforeData, null, 2) : 'null'}
                            </pre>
                          </div>
                          <div>
                            <span className="text-slate-400 block font-sans font-bold text-[10px] uppercase tracking-wider mb-1">
                              After State
                            </span>
                            <pre className="text-blue-400 whitespace-pre-wrap break-all text-[11px] leading-relaxed">
                              {evt.afterData ? JSON.stringify(evt.afterData, null, 2) : 'null'}
                            </pre>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
