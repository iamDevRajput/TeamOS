'use client';

import React, { useEffect, useState } from 'react';
import type { InvitationDto } from '@teamos/contracts';

interface InvitationsPanelProps {
  orgId: string;
  apiBaseUrl: string;
  onOpenInviteModal: () => void;
  refreshKey: number;
}

export function InvitationsPanel({
  orgId,
  apiBaseUrl,
  onOpenInviteModal,
  refreshKey,
}: InvitationsPanelProps) {
  const [invitations, setInvitations] = useState<InvitationDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  useEffect(() => {
    async function loadInvitations() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${apiBaseUrl}/api/v1/orgs/${orgId}/invitations`, {
          credentials: 'include',
        });
        if (res.ok) {
          const data = await res.json();
          setInvitations(data);
        } else {
          const data = await res.json().catch(() => ({}));
          setError(data.message || 'Failed to load invitations.');
        }
      } catch (err: any) {
        setError(err.message || 'Network error loading invitations.');
      } finally {
        setLoading(false);
      }
    }

    loadInvitations();
  }, [orgId, apiBaseUrl, refreshKey]);

  async function handleRevoke(invitationId: string) {
    if (!confirm('Are you sure you want to revoke this invitation?')) return;

    setRevokingId(invitationId);
    try {
      const res = await fetch(
        `${apiBaseUrl}/api/v1/orgs/${orgId}/invitations/${invitationId}`,
        {
          method: 'DELETE',
          credentials: 'include',
        },
      );
      if (res.ok) {
        setInvitations((prev) => prev.filter((i) => i.id !== invitationId));
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.message || 'Failed to revoke invitation.');
      }
    } catch (err: any) {
      alert(err.message || 'Network error revoking invitation.');
    } finally {
      setRevokingId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-slate-900">Pending Invitations</h3>
          <p className="text-xs text-slate-500">
            Shareable invitations that have not yet been accepted or expired.
          </p>
        </div>
        <button
          type="button"
          onClick={onOpenInviteModal}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-colors"
        >
          <span>+</span> Invite Teammate
        </button>
      </div>

      {error && (
        <div className="p-3 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg">
          {error}
        </div>
      )}

      {loading ? (
        <div className="p-6 text-center text-xs text-slate-400">Loading invitations...</div>
      ) : invitations.length === 0 ? (
        <div className="p-8 text-center bg-slate-50 border border-dashed border-slate-200 rounded-lg">
          <p className="text-sm font-medium text-slate-600">No pending invitations</p>
          <p className="text-xs text-slate-400 mt-1">
            Invite colleagues to collaborate on delivery risk intelligence.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500 border-b border-slate-200">
              <tr>
                <th scope="col" className="px-6 py-3">Recipient / Type</th>
                <th scope="col" className="px-6 py-3">Role</th>
                <th scope="col" className="px-6 py-3">Expires</th>
                <th scope="col" className="px-6 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {invitations.map((inv) => (
                <tr key={inv.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="px-6 py-4 font-medium text-slate-900 text-xs">
                    {inv.email ? (
                      <div>
                        <span>{inv.email}</span>
                        <span className="block text-[10px] text-slate-400">Target email</span>
                      </div>
                    ) : (
                      <span className="text-slate-500 italic">Open shareable link</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                        inv.role === 'ADMIN'
                          ? 'bg-blue-100 text-blue-800 border border-blue-200'
                          : 'bg-slate-100 text-slate-700 border border-slate-200'
                      }`}
                    >
                      {inv.role}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-xs text-slate-500">
                    {new Date(inv.expiresAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      type="button"
                      disabled={revokingId === inv.id}
                      onClick={() => handleRevoke(inv.id)}
                      className="text-xs font-semibold text-rose-600 hover:text-rose-800 disabled:opacity-50 transition-colors"
                    >
                      {revokingId === inv.id ? 'Revoking...' : 'Revoke'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

