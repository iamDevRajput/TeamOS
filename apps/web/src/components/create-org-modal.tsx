'use client';

import React, { useState } from 'react';
import type { OrgDto } from '@teamos/contracts';
import { Modal, Input, Button } from './ui';

interface CreateOrgModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (org: OrgDto) => void;
  apiBaseUrl: string;
}

export function CreateOrgModal({
  isOpen,
  onClose,
  onSuccess,
  apiBaseUrl,
}: CreateOrgModalProps) {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError('Organization name is required.');
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
        throw new Error(data.message || `Failed to create organization (${res.status})`);
      }

      const org: OrgDto = await res.json();
      setName('');
      setSlug('');
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
      title="Create Organization"
      description="Each organization provides an isolated multi-tenant workspace secured by forced PostgreSQL RLS."
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 text-xs text-rose-700 bg-rose-50 border border-rose-200/80 rounded-lg">
            {error}
          </div>
        )}

        <Input
          label="Organization Name"
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
          helperText="The visible workspace name across your team."
        />

        <Input
          label="Organization Slug (Optional)"
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          placeholder="acme-engineering"
          helperText="Unique URL identifier. Auto-generated if left blank."
        />

        <div className="pt-3 flex items-center justify-end gap-2.5">
          <Button type="button" variant="ghost" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" isLoading={loading}>
            Create Organization
          </Button>
        </div>
      </form>
    </Modal>
  );
}
