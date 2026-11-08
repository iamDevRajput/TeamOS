'use client';

import React, { useState } from 'react';
import type { OrgMemberDto, OrgRole } from '@teamos/contracts';
import { Badge, Button } from './ui';
import { UsersIcon, ShieldIcon } from './ui/icons';

interface MembersTableProps {
  orgId: string;
  members: OrgMemberDto[];
  currentUserRole: OrgRole;
  currentUserId: string;
  apiBaseUrl: string;
  onMemberUpdated: () => void;
  onOpenTransferModal: () => void;
}

export function MembersTable({
  orgId,
  members,
  currentUserRole,
  currentUserId,
  apiBaseUrl,
  onMemberUpdated,
  onOpenTransferModal,
}: MembersTableProps) {
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const isOwner = currentUserRole === 'OWNER';

  async function handleRoleChange(targetUserId: string, newRole: OrgRole) {
    if (newRole === 'OWNER') {
      onOpenTransferModal();
      return;
    }

    setUpdatingUserId(targetUserId);
    setActionError(null);

    try {
      const res = await fetch(
        `${apiBaseUrl}/api/v1/orgs/${orgId}/members/${targetUserId}`,
        {
          method: 'PATCH',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ role: newRole }),
        },
      );

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || `Failed to update role (${res.status})`);
      }

      onMemberUpdated();
    } catch (err: any) {
      setActionError(err.message || 'Failed to update member role.');
    } finally {
      setUpdatingUserId(null);
    }
  }

  async function handleRemoveMember(targetUserId: string, memberLogin: string) {
    if (!confirm(`Are you sure you want to remove @${memberLogin} from this organization?`)) {
      return;
    }

    setUpdatingUserId(targetUserId);
    setActionError(null);

    try {
      const res = await fetch(
        `${apiBaseUrl}/api/v1/orgs/${orgId}/members/${targetUserId}`,
        {
          method: 'DELETE',
          credentials: 'include',
        },
      );

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || `Failed to remove member (${res.status})`);
      }

      onMemberUpdated();
    } catch (err: any) {
      setActionError(err.message || 'Failed to remove member.');
    } finally {
      setUpdatingUserId(null);
    }
  }

  return (
    <div className="space-y-4">
      {actionError && (
        <div className="p-3 text-xs text-rose-700 bg-rose-50 border border-rose-200/80 rounded-lg">
          {actionError}
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
        <div className="px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <UsersIcon className="w-4 h-4 text-slate-500 dark:text-slate-400" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Team Members ({members.length})
            </h3>
          </div>
          <span className="text-[11px] text-slate-400 dark:text-slate-500">PostgreSQL RLS Protected</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600 dark:text-slate-400">
            <thead className="bg-slate-50/75 dark:bg-slate-950/60 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 border-b border-slate-200/70 dark:border-slate-800">
              <tr>
                <th scope="col" className="px-5 py-3">Member</th>
                <th scope="col" className="px-5 py-3">Role</th>
                <th scope="col" className="px-5 py-3">Joined Date</th>
                {isOwner && <th scope="col" className="px-5 py-3 text-right">Access Controls</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {members.map((member) => {
                const isSelf = member.userId === currentUserId;
                const isTargetOwner = member.role === 'OWNER';

                return (
                  <tr key={member.userId} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="px-5 py-3.5 flex items-center gap-3">
                      {member.avatarUrl ? (
                        <img
                          src={member.avatarUrl}
                          alt={member.login}
                          className="w-7 h-7 rounded-full border border-slate-200 dark:border-slate-700 object-cover"
                        />
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center font-bold text-slate-600 dark:text-slate-300 text-[11px]">
                          {member.login.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <div className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                          <span>{member.displayName || member.login}</span>
                          {isSelf && (
                            <span className="text-[9px] font-bold uppercase bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-1.5 py-0.2 rounded">
                              You
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400 dark:text-slate-500">@{member.login}</div>
                      </div>
                    </td>

                    <td className="px-5 py-3.5">
                      <Badge
                        variant={
                          member.role === 'OWNER'
                            ? 'purple'
                            : member.role === 'ADMIN'
                            ? 'info'
                            : 'default'
                        }
                        size="xs"
                      >
                        {member.role}
                      </Badge>
                    </td>

                    <td className="px-5 py-3.5 text-slate-500 font-mono text-[11px]">
                      {new Date(member.createdAt).toLocaleDateString(undefined, {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </td>

                    {isOwner && (
                      <td className="px-5 py-3.5 text-right">
                        {isTargetOwner ? (
                          <button
                            type="button"
                            onClick={onOpenTransferModal}
                            className="text-[11px] font-semibold text-rose-600 hover:text-rose-700 hover:underline transition-colors"
                          >
                            Transfer Ownership
                          </button>
                        ) : (
                          <div className="flex items-center justify-end gap-2.5">
                            <select
                              disabled={updatingUserId === member.userId}
                              value={member.role}
                              onChange={(e) =>
                                handleRoleChange(member.userId, e.target.value as OrgRole)
                              }
                              className="text-[11px] border border-slate-200 rounded-md px-2 py-1 bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-xs"
                            >
                              <option value="MEMBER">Member</option>
                              <option value="ADMIN">Admin</option>
                            </select>

                            <Button
                              type="button"
                              variant="ghost"
                              size="xs"
                              disabled={updatingUserId === member.userId}
                              onClick={() => handleRemoveMember(member.userId, member.login)}
                              className="text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                            >
                              Remove
                            </Button>
                          </div>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
