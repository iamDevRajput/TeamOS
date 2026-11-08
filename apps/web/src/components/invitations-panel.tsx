'use client';

import React, { useEffect, useState } from 'react';
import type { InvitationDto } from '@teamos/contracts';
import { Badge, Button, EmptyState } from './ui';
import { PlusIcon, UsersIcon } from './ui/icons';

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
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-slate-900 tracking-tight">Pending Invitations</h3>
          <p className="text-xs text-slate-500">
            Shareable invitations that have not yet been accepted or expired.
          </p>
        </div>
        <Button
          type="button"
          variant="primary"
          size="sm"
          onClick={onOpenInviteModal}
          leftIcon={<PlusIcon className="w-3.5 h-3.5" />}
        >
          Invite Teammate
        </Button>
      </div>

      {error && (
        <div className="p-3 text-xs text-rose-700 bg-rose-50 border border-rose-200/80 rounded-lg">
          {error}
        </div>
      )}

      {loading ? (
        <div className="p-8 text-center text-xs text-slate-400">Loading invitations...</div>
      ) : invitations.length === 0 ? (
        <EmptyState
          icon={<UsersIcon className="w-5 h-5" />}
          title="No pending invitations"
          description="Generate shareable invitation links to onboard teammates into this organization workspace."
          action={
            <Button type="button" variant="outline" size="sm" onClick={onOpenInviteModal}>
              Create Invitation Link
            </Button>
          }
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50/75 text-[11px] font-semibold uppercase tracking-wider text-slate-500 border-b border-slate-200/70">
                <tr>
                  <th scope="col" className="px-5 py-3">Recipient / Type</th>
                  <th scope="col" className="px-5 py-3">Target Role</th>
                  <th scope="col" className="px-5 py-3">Expires At</th>
                  <th scope="col" className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {invitations.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-5 py-3.5 font-medium text-slate-900 text-xs">
                      {inv.email ? (
                        <div>
                          <span>{inv.email}</span>
                          <span className="block text-[10px] text-slate-400 font-normal">
                            Restricted Email Invite
                          </span>
                        </div>
                      ) : (
                        <div>
                          <span className="text-slate-800 font-medium">Shareable Link</span>
                          <span className="block text-[10px] text-slate-400 font-normal">
                            Any GitHub authenticated user
                          </span>
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <Badge variant={inv.role === 'ADMIN' ? 'info' : 'default'} size="xs">
                        {inv.role}
                      </Badge>
                    </td>
                    <td className="px-5 py-3.5 text-slate-500 font-mono text-[11px]">
                      {new Date(inv.expiresAt).toLocaleDateString(undefined, {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        size="xs"
                        isLoading={revokingId === inv.id}
                        onClick={() => handleRevoke(inv.id)}
                        className="text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                      >
                        Revoke
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
