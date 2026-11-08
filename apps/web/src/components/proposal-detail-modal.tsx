'use client';

import React, { useState } from 'react';
import type { ProposalDto, OrgRole } from '@teamos/contracts';
import { Modal, Badge, Button, Input } from './ui';
import { AlertTriangleIcon, CheckCircleIcon, ArrowRightIcon, PlusIcon } from './ui/icons';

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
  const depsToAdd = proposal.payload.dependenciesToAdd || [];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2">
          <Badge
            variant={
              proposal.state === 'APPROVED'
                ? 'success'
                : proposal.state === 'REJECTED'
                ? 'danger'
                : 'info'
            }
            size="xs"
          >
            {proposal.state}
          </Badge>
          <span className="font-mono text-xs text-slate-400 font-normal">
            Kind: {proposal.kind}
          </span>
        </div>
      }
      description={`Submitted by @${proposal.creatorLogin || 'user'} on ${new Date(
        proposal.createdAt,
      ).toLocaleDateString()}`}
      maxWidth="xl"
    >
      <div className="space-y-4">
        <div>
          <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 tracking-tight">{proposal.title}</h3>
          {proposal.description && (
            <p className="text-xs text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-950 p-3 rounded-lg border border-slate-200/80 dark:border-slate-800 mt-2 leading-relaxed">
              {proposal.description}
            </p>
          )}
        </div>

        {proposal.rejectionReason && (
          <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200/80 dark:border-rose-900/60 rounded-lg text-xs text-rose-800 dark:text-rose-300">
            <strong>Rejection Reason:</strong> {proposal.rejectionReason}
          </div>
        )}

        {conflict && (
          <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 rounded-lg text-amber-900 dark:text-amber-200 text-xs leading-relaxed space-y-1">
            <p className="font-bold flex items-center gap-1.5">
              <AlertTriangleIcon className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              <span>Concurrency Revalidation Conflict (HTTP 409)</span>
            </p>
            <p>{conflict}</p>
          </div>
        )}

        {error && (
          <div className="p-3 text-xs text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border border-rose-200/80 dark:border-rose-900/60 rounded-lg">
            {error}
          </div>
        )}

        {/* Structured Change Diff */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between pb-1 border-b border-slate-200/70 dark:border-slate-800">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
              Proposed Changes Diff
            </h4>
            <span className="text-[11px] text-slate-400 dark:text-slate-500 font-mono">
              +{tasksToCreate.length} tasks · +{depsToAdd.length} edges
            </span>
          </div>

          {/* Created Tasks */}
          {tasksToCreate.length > 0 && (
            <div className="space-y-1.5">
              <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 block">
                + Tasks to Create ({tasksToCreate.length}):
              </span>
              <div className="space-y-1 pl-2.5 border-l-2 border-emerald-400">
                {tasksToCreate.map((t) => (
                  <div
                    key={t.tempId}
                    className="p-2.5 bg-emerald-50/50 dark:bg-emerald-950/30 rounded-lg border border-emerald-200/70 dark:border-emerald-800/60 text-xs flex items-center justify-between"
                  >
                    <span className="font-medium text-slate-900 dark:text-slate-100">{t.title}</span>
                    {t.remainingEstimateWorkdays !== undefined && (
                      <span className="font-mono text-[10px] text-emerald-800 dark:text-emerald-300 bg-emerald-100/80 dark:bg-emerald-900/60 px-2 py-0.5 rounded font-semibold">
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
              <span className="text-[11px] font-bold text-blue-700 dark:text-blue-400 block">
                + Dependencies to Add ({depsToAdd.length}):
              </span>
              <div className="space-y-1 pl-2.5 border-l-2 border-blue-400">
                {depsToAdd.map((d, i) => (
                  <div
                    key={i}
                    className="p-2.5 bg-blue-50/50 dark:bg-blue-950/30 rounded-lg border border-blue-200/70 dark:border-blue-900/60 text-xs flex items-center gap-2"
                  >
                    <span className="font-mono text-slate-800 dark:text-slate-200 font-semibold">{d.blockerId}</span>
                    <ArrowRightIcon className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                    <span className="font-mono text-slate-800 dark:text-slate-200 font-semibold">{d.dependentId}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Rejection Form Drawer */}
        {rejecting && (
          <div className="pt-3 border-t border-slate-200/80 dark:border-slate-800 space-y-2">
            <Input
              label="Reason for Rejection"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="e.g. Scope changed or estimates need revision..."
            />
            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="ghost" size="xs" onClick={() => setRejecting(false)}>
                Cancel
              </Button>
              <Button
                type="button"
                variant="danger"
                size="xs"
                isLoading={loading}
                onClick={handleReject}
              >
                Confirm Rejection
              </Button>
            </div>
          </div>
        )}

        {/* Action Controls */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>

          {canReview && !rejecting && (
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={loading}
                onClick={() => setRejecting(true)}
                className="text-rose-600 hover:text-rose-700 hover:bg-rose-50"
              >
                Reject Proposal
              </Button>
              <Button
                type="button"
                variant="primary"
                size="sm"
                isLoading={loading}
                onClick={handleApprove}
                leftIcon={<CheckCircleIcon className="w-3.5 h-3.5" />}
              >
                Approve & Apply Plan
              </Button>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
