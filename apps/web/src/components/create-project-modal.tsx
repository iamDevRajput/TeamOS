'use client';

import React, { useState } from 'react';
import type { ProjectDto } from '@teamos/contracts';
import { Modal, Input, Button } from './ui';

interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  orgId: string;
  apiBaseUrl: string;
  onSuccess: (project: ProjectDto) => void;
}

export function CreateProjectModal({
  isOpen,
  onClose,
  orgId,
  apiBaseUrl,
  onSuccess,
}: CreateProjectModalProps) {
  const [name, setName] = useState('');
  const [key, setKey] = useState('');
  const [startDate, setStartDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleNameChange(val: string) {
    setName(val);
    if (!key || key.length === 0) {
      const words = val.trim().split(/\s+/);
      const suggested = words
        .map((w) => w.charAt(0))
        .join('')
        .slice(0, 5)
        .toUpperCase();
      if (/^[A-Z0-9]{2,8}$/.test(suggested)) {
        setKey(suggested);
      }
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError('Project name is required.');
      return;
    }
    const cleanKey = key.trim().toUpperCase();
    if (!/^[A-Z0-9]{2,8}$/.test(cleanKey)) {
      setError('Project key must be 2-8 uppercase alphanumeric characters (e.g. CORE, APP, API).');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/orgs/${orgId}/projects`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: name.trim(),
          key: cleanKey,
          startDate: startDate || undefined,
          dueDate: dueDate || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || `Failed to create project (${res.status})`);
      }

      const created: ProjectDto = await res.json();
      setName('');
      setKey('');
      setStartDate('');
      setDueDate('');
      onSuccess(created);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error creating project.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create New Project"
      description="Projects organize your tasks, finish-to-start dependencies, and Critical Path Method schedules."
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 text-xs text-rose-700 bg-rose-50 border border-rose-200/80 rounded-lg">
            {error}
          </div>
        )}

        <Input
          label="Project Name"
          required
          value={name}
          onChange={(e) => handleNameChange(e.target.value)}
          placeholder="e.g. Core Engine"
          helperText="The project's descriptive name."
        />

        <Input
          label="Project Key"
          required
          value={key}
          onChange={(e) => setKey(e.target.value.toUpperCase())}
          placeholder="CORE"
          maxLength={8}
          className="font-mono uppercase"
          helperText="2-8 uppercase letters/numbers. Prefixes task identifiers (e.g. CORE-1)."
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            label="Start Date (Optional)"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
          <Input
            label="Target Delivery Date (Optional)"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            helperText="Delivery risk engine evaluates delay against this target date."
          />
        </div>

        <div className="pt-3 flex items-center justify-end gap-2.5">
          <Button type="button" variant="ghost" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" isLoading={loading}>
            Create Project
          </Button>
        </div>
      </form>
    </Modal>
  );
}
