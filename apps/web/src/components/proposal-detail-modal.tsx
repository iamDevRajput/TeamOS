'use client';

import React, { useState } from 'react';
import type { ProposalDto, OrgRole } from '@teamos/contracts';

interface ProposalDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  proposal: ProposalDto | null;
  orgId: string;
  projectKey: string;
  currentUserRole: OrgRole;
  apiBaseUrl: string;
  onUpdated: () => void;
}

export function ProposalDetailModal({
  isOpen,
  onClose,
  proposal,
  orgId,
  projectKey,
  currentUserRole,
  apiBaseUrl,
  onUpdated,
}: ProposalDetailModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  if (!isOpen || !proposal) return null;

  const canReview =
    (currentUserRole === 'OWNER' || currentUserRole === 'ADMIN') &&
    proposal.state === 'PENDING';

  async function handleApprove() {
    if (!proposal) return;
    setLoading(true);
    setError(null);
    setConflict(null);

    try {
      const res = await fetch(
        `${apiBaseUrl}/api/v1/orgs/${orgId}/proposals/${proposal.id}/approve`,
        {
          method: 'POST',
          credentials: 'include',
        },
      );

      if (res.status === 409) {
        const data = await res.json().catch(() => ({}));
        setConflict(
          data.message ||
            'Concurrency Conflict: One or more tasks were modified after this proposal was created.',
        );
        return;
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || 'Failed to approve proposal.');
      }

      onUpdated();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error approving proposal.');
    } finally {
      setLoading(false);
    }
  }

  async function handleReject() {
    if (!proposal) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(
        `${apiBaseUrl}/api/v1/orgs/${orgId}/proposals/${proposal.id}/reject`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason: rejectReason.trim() || undefined }),
        },
      );

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || 'Failed to reject proposal.');
      }

      onUpdated();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error rejecting proposal.');
    } finally {
      setLoading(false);
      setRejecting(false);
    }
  }

  const tasksToCreate = proposal.payload.tasksToCreate || [];
  const tasksToUpdate = proposal.payload.tasksToUpdate || [];
  const depsToAdd = proposal.payload.dependenciesToAdd || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="w-full max-w-xl rounded-xl bg-white p-6 shadow-xl border border-slate-200 my-8 space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between pb-3 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <span
                className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${
                  proposal.state === 'APPROVED'
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : proposal.state === 'REJECTED'
                    ? 'bg-rose-50 text-rose-800 border-rose-200'
                    : 'bg-blue-50 text-blue-800 border-blue-200'
                }`}
              >
                {proposal.state}
              </span>
              <span className="font-mono text-xs text-slate-400">
                Kind: {proposal.kind}
              </span>
            </div>
            <h3 className="text-lg font-black text-slate-900 mt-1">
              {proposal.title}
            </h3>
            <p className="text-xs text-slate-500">
              Submitted by @{proposal.creatorLogin || 'user'} on{' '}
              {new Date(proposal.createdAt).toLocaleDateString()}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors text-sm font-semibold p-1"
          >
            ✕
          </button>
        </div>

        {proposal.description && (
          <p className="text-xs text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-200">
            {proposal.description}
          </p>
        )}

        {proposal.rejectionReason && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800">
            <strong>Rejection Reason:</strong> {proposal.rejectionReason}
          </div>
        )}

        {conflict && (
          <div className="p-3 bg-amber-50 border border-amber-300 rounded-lg text-amber-900 text-xs space-y-1">
            <p className="font-bold">⚠️ Concurrency Revalidation Conflict (HTTP 409)</p>
            <p>{conflict}</p>
          </div>
        )}

        {error && (
          <div className="p-3 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg">
            {error}
          </div>
        )}

        {/* Structured Change Diff */}
        <div className="space-y-3 pt-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
            Proposed Changes Diff
          </h4>

          {/* Created Tasks */}
          {tasksToCreate.length > 0 && (
            <div className="space-y-1.5">
              <span className="text-[11px] font-semibold text-emerald-700 block">
                + Tasks to Create ({tasksToCreate.length}):
              </span>
              <div className="space-y-1 pl-2 border-l-2 border-emerald-400">
                {tasksToCreate.map((t) => (
                  <div
                    key={t.tempId}
                    className="p-2 bg-emerald-50/60 rounded text-xs flex items-center justify-between"
                  >
                    <span className="font-medium text-slate-800">{t.title}</span>
                    {t.remainingEstimateWorkdays !== undefined && (
                      <span className="font-mono text-[10px] text-emerald-800 bg-emerald-100 px-1.5 py-0.5 rounded">
                        {t.remainingEstimateWorkdays}d estimate
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Dependencies to Add */}
          {depsToAdd.length > 0 && (
            <div className="space-y-1.5">
              <span className="text-[11px] font-semibold text-blue-700 block">
                + Dependencies to Add ({depsToAdd.length}):
              </span>
              <div className="space-y-1 pl-2 border-l-2 border-blue-400">
                {depsToAdd.map((d, i) => (
                  <div
                    key={i}
                    className="p-2 bg-blue-50/60 rounded text-xs flex items-center gap-2"
                  >
                    <span className="font-mono text-slate-700">{d.blockerId}</span>
                    <span className="text-blue-600 font-bold">➔</span>
                    <span className="font-mono text-slate-700">{d.dependentId}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Rejection Form Drawer */}
        {rejecting && (
          <div className="pt-3 border-t border-slate-200 space-y-2">
            <label className="block text-xs font-semibold text-slate-700">
              Reason for Rejection:
            </label>
            <input
              type="text"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="e.g. Scope changed or estimates need revision..."
              className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRejecting(false)}
                className="px-3 py-1 text-xs text-slate-500 hover:text-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={handleReject}
                className="px-3 py-1 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg"
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        )}

        {/* Action Controls */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
          >
            Close
          </button>

          {canReview && !rejecting && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={loading}
                onClick={() => setRejecting(true)}
                className="px-3.5 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
              >
                Reject Proposal
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={handleApprove}
                className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg shadow-sm transition-colors"
              >
                {loading ? 'Applying...' : 'Approve & Apply Plan'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

