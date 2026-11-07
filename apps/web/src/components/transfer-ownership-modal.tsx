'use client';

import React, { useState } from 'react';
import type { OrgMemberDto } from '@teamos/contracts';

interface TransferOwnershipModalProps {
  isOpen: boolean;
  onClose: () => void;
  orgId: string;
  members: OrgMemberDto[];
  currentUserId: string;
  apiBaseUrl: string;
  onSuccess: () => void;
}

export function TransferOwnershipModal({
  isOpen,
  onClose,
  orgId,
  members,
  currentUserId,
  apiBaseUrl,
  onSuccess,
}: TransferOwnershipModalProps) {
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [confirmed, setConfirmed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const eligibleMembers = members.filter((m) => m.userId !== currentUserId);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedUserId) {
      setError('Please select a member to transfer ownership to.');
      return;
    }
    if (!confirmed) {
      setError('Please confirm that you understand this action cannot be undone.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/orgs/${orgId}/transfer-ownership`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          newOwnerUserId: selectedUserId,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || `Ownership transfer failed (${res.status})`);
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl border border-slate-200">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <h2 className="text-lg font-bold text-rose-700">Transfer Organization Ownership</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors text-sm font-semibold p-1"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-xs leading-relaxed">
            <p className="font-bold mb-1">⚠️ Warning: Irreversible Action</p>
            Transferring ownership assigns the <strong>OWNER</strong> role to another member and demotes you to <strong>ADMIN</strong>. You will no longer be able to demote or remove the new owner.
          </div>

          {error && (
            <div className="p-3 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
              Select New Owner <span className="text-rose-500">*</span>
            </label>
            {eligibleMembers.length === 0 ? (
              <p className="text-xs text-slate-500 italic p-3 bg-slate-50 border border-slate-200 rounded-lg">
                No other members found in this organization. Invite teammates before transferring ownership.
              </p>
            ) : (
              <select
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-rose-500"
              >
                <option value="">-- Choose member --</option>
                {eligibleMembers.map((m) => (
                  <option key={m.userId} value={m.userId}>
                    {m.displayName || m.login} (@{m.login}) — {m.role}
                  </option>
                ))}
              </select>
            )}
          </div>

          {eligibleMembers.length > 0 && (
            <label className="flex items-start gap-2 pt-2 cursor-pointer">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
                className="mt-0.5 rounded border-slate-300 text-rose-600 focus:ring-rose-500"
              />
              <span className="text-xs text-slate-600">
                I understand that I am transferring full ownership and will become an Admin.
              </span>
            </label>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || eligibleMembers.length === 0 || !confirmed}
              className="px-4 py-2 text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50 rounded-lg shadow-sm transition-colors"
            >
              {loading ? 'Transferring...' : 'Transfer Ownership'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

