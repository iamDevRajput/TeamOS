'use client';

import React, { useState } from 'react';
import type { OrgMemberDto } from '@teamos/contracts';
import { Modal, Select, Button } from './ui';
import { AlertTriangleIcon } from './ui/icons';

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
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Transfer Organization Ownership"
      description="Transfer primary administrative ownership of this organization workspace."
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="p-3.5 bg-rose-50/90 border border-rose-200/90 rounded-lg text-rose-900 space-y-1.5">
          <div className="flex items-center gap-1.5 font-bold text-xs text-rose-800">
            <AlertTriangleIcon className="w-4 h-4 text-rose-600" />
            <span>Irreversible Action</span>
          </div>
          <p className="text-[11px] text-rose-700 leading-relaxed">
            Transferring ownership assigns the <strong>OWNER</strong> role to another member and demotes you to <strong>ADMIN</strong>. You will no longer be able to demote or remove the new owner.
          </p>
        </div>

        {error && (
          <div className="p-3 text-xs text-rose-700 bg-rose-50 border border-rose-200/80 rounded-lg">
            {error}
          </div>
        )}

        {eligibleMembers.length === 0 ? (
          <p className="text-xs text-slate-500 italic p-3 bg-slate-50 border border-slate-200/80 rounded-lg">
            No other members found in this organization. Invite teammates before transferring ownership.
          </p>
        ) : (
          <Select
            label="Select New Owner"
            value={selectedUserId}
            onChange={(e) => setSelectedUserId(e.target.value)}
          >
            <option value="">-- Choose a team member --</option>
            {eligibleMembers.map((m) => (
              <option key={m.userId} value={m.userId}>
                {m.displayName || m.login || m.userId} (@{m.login}, currently {m.role})
              </option>
            ))}
          </Select>
        )}

        {eligibleMembers.length > 0 && (
          <div className="pt-1">
            <label className="flex items-start gap-2.5 cursor-pointer select-none text-xs text-slate-700">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
                className="mt-0.5 rounded border-slate-300 text-rose-600 focus:ring-rose-500"
              />
              <span>
                I understand that I am transferring primary ownership and will be demoted to Admin.
              </span>
            </label>
          </div>
        )}

        <div className="pt-3 flex items-center justify-end gap-2.5">
          <Button type="button" variant="ghost" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="danger"
            isLoading={loading}
            disabled={!selectedUserId || !confirmed}
          >
            Confirm Transfer
          </Button>
        </div>
      </form>
    </Modal>
  );
}
