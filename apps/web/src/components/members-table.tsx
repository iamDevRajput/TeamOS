'use client';

import React, { useState } from 'react';
import type { OrgMemberDto, OrgRole } from '@teamos/contracts';

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
        <div className="p-3 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg">
          {actionError}
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-left text-sm text-slate-600">
          <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500 border-b border-slate-200">
            <tr>
              <th scope="col" className="px-6 py-3">Member</th>
              <th scope="col" className="px-6 py-3">Role</th>
              <th scope="col" className="px-6 py-3">Joined</th>
              {isOwner && <th scope="col" className="px-6 py-3 text-right">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {members.map((member) => {
              const isSelf = member.userId === currentUserId;
              const isTargetOwner = member.role === 'OWNER';

              return (
                <tr key={member.userId} className="hover:bg-slate-50/70 transition-colors">
                  <td className="px-6 py-4 flex items-center gap-3">
                    {member.avatarUrl ? (
                      <img
                        src={member.avatarUrl}
                        alt={member.login}
                        className="w-8 h-8 rounded-full border border-slate-200"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center font-bold text-slate-600 text-xs">
                        {member.login.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <div className="font-semibold text-slate-900 flex items-center gap-2">
                        {member.displayName || member.login}
                        {isSelf && (
                          <span className="text-[10px] font-normal uppercase bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                            You
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500">@{member.login}</div>
                    </div>
                  </td>

                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                        member.role === 'OWNER'
                          ? 'bg-purple-100 text-purple-800 border border-purple-200'
                          : member.role === 'ADMIN'
                          ? 'bg-blue-100 text-blue-800 border border-blue-200'
                          : 'bg-slate-100 text-slate-700 border border-slate-200'
                      }`}
                    >
                      {member.role}
                    </span>
                  </td>

                  <td className="px-6 py-4 text-xs text-slate-500">
                    {new Date(member.createdAt).toLocaleDateString()}
                  </td>

                  {isOwner && (
                    <td className="px-6 py-4 text-right">
                      {isTargetOwner ? (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={onOpenTransferModal}
                            className="text-xs font-semibold text-rose-600 hover:text-rose-800 transition-colors"
                          >
                            Transfer Ownership
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-end gap-3">
                          <select
                            disabled={updatingUserId === member.userId}
                            value={member.role}
                            onChange={(e) =>
                              handleRoleChange(member.userId, e.target.value as OrgRole)
                            }
                            className="text-xs border border-slate-300 rounded px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                          >
                            <option value="MEMBER">Member</option>
                            <option value="ADMIN">Admin</option>
                          </select>

                          <button
                            type="button"
                            disabled={updatingUserId === member.userId}
                            onClick={() => handleRemoveMember(member.userId, member.login)}
                            className="text-xs text-rose-600 hover:text-rose-800 font-medium transition-colors"
                          >
                            Remove
                          </button>
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
  );
}
