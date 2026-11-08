'use client';

import React, { useState } from 'react';
import type { CreatedInvitationResponseDto } from '@teamos/contracts';
import { Modal, Input, Select, Button, Badge } from './ui';
import { CheckCircleIcon } from './ui/icons';

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
    <Modal
      isOpen={isOpen}
      onClose={handleResetAndClose}
      title={createdInvite ? 'Invitation Created' : 'Invite Teammate'}
      description="Invite team members to collaborate on tasks, dependencies, and delivery risk intelligence."
      maxWidth="md"
    >
      {createdInvite ? (
        <div className="space-y-4">
          <div className="p-3.5 bg-emerald-50/80 border border-emerald-200/90 rounded-lg text-emerald-900 space-y-1">
            <div className="flex items-center gap-1.5 font-bold text-xs text-emerald-800">
              <CheckCircleIcon className="w-4 h-4 text-emerald-600" />
              <span>Shareable Invitation Link Ready</span>
            </div>
            <p className="text-[11px] text-emerald-700 leading-relaxed">
              Anyone with this link can join this organization as a{' '}
              <Badge variant={createdInvite.invitation.role === 'ADMIN' ? 'info' : 'default'} size="xs">
                {createdInvite.invitation.role}
              </Badge>
              . Expires in 7 days.
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-700">
              Invitation URL
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={createdInvite.inviteUrl}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg font-mono text-slate-800 select-all focus:outline-none"
              />
              <Button type="button" variant="primary" size="sm" onClick={handleCopy}>
                {copied ? 'Copied' : 'Copy'}
              </Button>
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <Button type="button" variant="outline" onClick={handleResetAndClose}>
              Done
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleCreateInvite} className="space-y-4">
          {error && (
            <div className="p-3 text-xs text-rose-700 bg-rose-50 border border-rose-200/80 rounded-lg">
              {error}
            </div>
          )}

          <Select
            label="Organization Role"
            value={role}
            onChange={(e) => setRole(e.target.value as 'MEMBER' | 'ADMIN')}
            helperText="Admins can manage projects, members, and accept change proposals."
          >
            <option value="MEMBER">Member (Standard Contributor)</option>
            <option value="ADMIN">Admin (Projects & Members Manager)</option>
          </Select>

          <Input
            label="Restricted Recipient Email (Optional)"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="colleague@company.com"
            helperText="If provided, only the user matching this email can claim this invitation."
          />

          <div className="pt-3 flex items-center justify-end gap-2.5">
            <Button type="button" variant="ghost" onClick={handleResetAndClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={loading}>
              Generate Invitation
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
