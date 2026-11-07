'use client';

import React, { useState } from 'react';
import type { CreatedInvitationResponseDto, OrgRole } from '@teamos/contracts';

interface InviteModalProps {
  isOpen: boolean;
  onClose: () => void;
  orgId: string;
  apiBaseUrl: string;
  onSuccess: () => void;
}

export function InviteModal({
  isOpen,
  onClose,
  orgId,
  apiBaseUrl,
  onSuccess,
}: InviteModalProps) {
  const [role, setRole] = useState<'MEMBER' | 'ADMIN'>('MEMBER');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdInvite, setCreatedInvite] = useState<CreatedInvitationResponseDto | null>(null);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  async function handleCreateInvite(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/orgs/${orgId}/invitations`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          role,
          email: email.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || `Failed to create invitation (${res.status})`);
      }

      const data: CreatedInvitationResponseDto = await res.json();
      setCreatedInvite(data);
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  }

  function handleCopy() {
    if (!createdInvite) return;
    navigator.clipboard.writeText(createdInvite.inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  function handleResetAndClose() {
    setCreatedInvite(null);
    setEmail('');
    setRole('MEMBER');
    setError(null);
    setCopied(false);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl border border-slate-200">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <h2 className="text-lg font-bold text-slate-900">
            {createdInvite ? 'Invitation Created' : 'Invite Teammate'}
          </h2>
          <button
            onClick={handleResetAndClose}
            className="text-slate-400 hover:text-slate-600 transition-colors text-sm font-semibold p-1"
          >
            ✕
          </button>
        </div>

        {createdInvite ? (
          <div className="mt-4 space-y-4">
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-sm">
              <p className="font-semibold">Shareable invitation link ready!</p>
              <p className="text-xs text-emerald-600 mt-1">
                Anyone with this link can join your organization as <strong>{createdInvite.invitation.role}</strong>. Link expires in 7 days.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                Shareable Link
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={createdInvite.inviteUrl}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg font-mono text-slate-700 select-all"
                />
                <button
                  type="button"
                  onClick={handleCopy}
                  className="px-3 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg whitespace-nowrap transition-colors"
                >
                  {copied ? '✓ Copied' : 'Copy'}
                </button>
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={handleResetAndClose}
                className="px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleCreateInvite} className="mt-4 space-y-4">
            {error && (
              <div className="p-3 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg">
                {error}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                Role Assignment <span className="text-rose-500">*</span>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label
                  className={`flex flex-col p-3 border rounded-lg cursor-pointer transition-colors ${
                    role === 'MEMBER'
                      ? 'border-blue-600 bg-blue-50/50'
                      : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-semibold text-slate-900">Member</span>
                    <input
                      type="radio"
                      name="role"
                      value="MEMBER"
                      checked={role === 'MEMBER'}
                      onChange={() => setRole('MEMBER')}
                      className="text-blue-600 focus:ring-blue-500"
                    />
                  </div>
                  <span className="text-xs text-slate-500">
                    Standard access: tasks, dependencies, and delivery risk reports.
                  </span>
                </label>

                <label
                  className={`flex flex-col p-3 border rounded-lg cursor-pointer transition-colors ${
                    role === 'ADMIN'
                      ? 'border-blue-600 bg-blue-50/50'
                      : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-semibold text-slate-900">Admin</span>
                    <input
                      type="radio"
                      name="role"
                      value="ADMIN"
                      checked={role === 'ADMIN'}
                      onChange={() => setRole('ADMIN')}
                      className="text-blue-600 focus:ring-blue-500"
                    />
                  </div>
                  <span className="text-xs text-slate-500">
                    Can invite teammates, manage members, and configure repositories.
                  </span>
                </label>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                Recipient Email <span className="text-slate-400 font-normal lowercase">(optional reference)</span>
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="colleague@example.com"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <p className="text-xs text-slate-400 mt-1">
                Stored for audit reference only. A shareable link will be generated.
              </p>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={handleResetAndClose}
                disabled={loading}
                className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg shadow-sm transition-colors"
              >
                {loading ? 'Generating...' : 'Generate Invite Link'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
