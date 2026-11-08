'use client';

import React, { useEffect, useState } from 'react';
import type { AuditEventDto } from '@teamos/contracts';

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

  function getActionBadgeStyle(action: string): string {
    if (action.includes('CREATED') || action.includes('ADDED')) {
      return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    }
    if (action.includes('UPDATED') || action.includes('TRANSFERRED')) {
      return 'bg-blue-100 text-blue-800 border-blue-200';
    }
    if (action.includes('REMOVED') || action.includes('REVOKED') || action.includes('DELETED')) {
      return 'bg-rose-100 text-rose-800 border-rose-200';
    }
    return 'bg-slate-100 text-slate-800 border-slate-200';
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h3 className="text-base font-semibold text-slate-900">Audit Timeline</h3>
          <p className="text-xs text-slate-500">
            Immutable, append-only security log of all sensitive organizational state mutations.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <label className="font-semibold text-slate-600">Filter:</label>
          <select
            value={filterEntity}
            onChange={(e) => setFilterEntity(e.target.value)}
            className="border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="ALL">All Entities</option>
            <option value="ORGANIZATION">Organization</option>
            <option value="MEMBERSHIP">Membership</option>
            <option value="INVITATION">Invitation</option>
            <option value="PROJECT">Project</option>
            <option value="TASK">Task</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="p-3 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg">
          {error}
        </div>
      )}

      {loading ? (
        <div className="p-8 text-center text-xs text-slate-400">Loading audit records...</div>
      ) : events.length === 0 ? (
        <div className="p-8 text-center bg-white rounded-xl border border-slate-200">
          <p className="text-sm font-medium text-slate-600">No audit events found</p>
          <p className="text-xs text-slate-400 mt-1">
            Actions like role updates, member removals, and invitations will appear here.
          </p>
        </div>
      ) : (
        <div className="relative border-l-2 border-slate-200 ml-4 space-y-6 py-2">
          {events.map((evt) => {
            const isExpanded = expandedEventId === evt.id;
            const hasData = evt.beforeData || evt.afterData;

            return (
              <div key={evt.id} className="relative pl-6">
                {/* Dot */}
                <div className="absolute -left-1.5 top-1.5 h-3 w-3 rounded-full border-2 border-white bg-blue-600 shadow-sm" />

                <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm hover:border-slate-300 transition-colors space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold uppercase border ${getActionBadgeStyle(
                          evt.action,
                        )}`}
                      >
                        {evt.action}
                      </span>
                      <span className="text-xs font-semibold text-slate-700">
                        {evt.entityType}
                      </span>
                    </div>

                    <span className="text-xs text-slate-400">
                      {new Date(evt.createdAt).toLocaleString()}
                    </span>
                  </div>

                  <div className="text-xs text-slate-600 flex flex-wrap items-center gap-3">
                    <div>
                      <span className="text-slate-400">Actor:</span>{' '}
                      <span className="font-mono text-slate-800">
                        {evt.actorType} ({evt.actorId.slice(0, 8)}...)
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400">Entity ID:</span>{' '}
                      <span className="font-mono text-slate-800">{evt.entityId.slice(0, 8)}...</span>
                    </div>
                    {evt.requestId && (
                      <div>
                        <span className="text-slate-400">Req:</span>{' '}
                        <span className="font-mono text-slate-500 text-[11px]">
                          {evt.requestId.slice(0, 8)}
                        </span>
                      </div>
                    )}
                  </div>

                  {hasData && (
                    <div className="pt-2 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedEventId((prev) => (prev === evt.id ? null : evt.id))
                        }
                        className="text-xs text-blue-600 hover:text-blue-800 font-semibold"
                      >
                        {isExpanded ? 'Hide Payload Diff' : 'View Payload Diff'}
                      </button>

                      {isExpanded && (
                        <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2 text-xs font-mono bg-slate-50 p-3 rounded-lg border border-slate-200">
                          <div>
                            <span className="text-slate-400 block font-sans font-bold text-[10px] uppercase mb-1">
                              Before State
                            </span>
                            <pre className="text-slate-700 whitespace-pre-wrap break-all text-[11px]">
                              {evt.beforeData ? JSON.stringify(evt.beforeData, null, 2) : 'null'}
                            </pre>
                          </div>
                          <div>
                            <span className="text-slate-400 block font-sans font-bold text-[10px] uppercase mb-1">
                              After State
                            </span>
                            <pre className="text-slate-700 whitespace-pre-wrap break-all text-[11px]">
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

