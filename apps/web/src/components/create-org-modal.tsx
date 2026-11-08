'use client';

import React, { useState } from 'react';
import type { OrgDto } from '@teamos/contracts';
import { Modal, Input, Button, useToast } from './ui';

interface CreateOrgModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (org: OrgDto) => void;
  apiBaseUrl: string;
}

const TEAM_SIZES = ['Just myself', '2-10', '11-50', '51-200', '201-500', '500+'];

export function CreateOrgModal({
  isOpen,
  onClose,
  onSuccess,
  apiBaseUrl,
}: CreateOrgModalProps) {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [teamSize, setTeamSize] = useState('2-10');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { showToast } = useToast();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError('Workspace name is required.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/orgs`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: name.trim(),
          slug: slug.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || `Failed to create workspace (${res.status})`);
      }

      const org: OrgDto = await res.json();
      setName('');
      setSlug('');
      setTeamSize('2-10');
      showToast('success', 'Workspace created!', `${org.name} is ready with forced PostgreSQL RLS.`);
      onSuccess(org);
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
      title="Create your workspace"
      description="All your work — unified. Isolated multi-tenant workspace secured by forced PostgreSQL RLS."
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 text-xs text-rose-700 bg-rose-50 border border-rose-200/80 rounded-lg">
            {error}
          </div>
        )}

        <Input
          label="Name your workspace *"
          required
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (!slug) {
              setSlug(
                e.target.value
                  .toLowerCase()
                  .replace(/[^a-z0-9]+/g, '-')
                  .replace(/^-|-$/g, ''),
              );
            }
          }}
          placeholder="e.g. Acme Engineering"
          helperText="The visible workspace name across your engineering team."
        />

        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
            Set your workspace&apos;s URL *
          </label>
          <div className="flex items-center rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-600 overflow-hidden shadow-xs">
            <span className="px-3 py-2 text-xs font-mono text-slate-400 select-none border-r border-slate-200 dark:border-slate-800">
              app.teamos.io/
            </span>
            <input
              type="text"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="acme-engineering"
              className="flex-1 px-3 py-2 text-xs bg-transparent text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none font-mono"
            />
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            You can edit the unique URL identifier slug for your organization.
          </p>
        </div>

        {/* Team Size Selection Pills (Plane-Style) */}
        <div className="space-y-1.5 pt-1">
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
            How many people will use this workspace?
          </label>
          <div className="grid grid-cols-3 gap-2">
            {TEAM_SIZES.map((size) => {
              const isSelected = teamSize === size;
              return (
                <button
                  key={size}
                  type="button"
                  onClick={() => setTeamSize(size)}
                  className={`px-3 py-2 rounded-lg text-xs font-medium border text-center transition-all ${
                    isSelected
                      ? 'border-blue-600 bg-blue-50/80 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-bold shadow-xs'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                  }`}
                >
                  {size}
                </button>
              );
            })}
          </div>
        </div>

        <div className="pt-3 flex items-center justify-end gap-2.5">
          <Button type="button" variant="ghost" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" isLoading={loading}>
            Create Workspace
          </Button>
        </div>
      </form>
    </Modal>
  );
}
