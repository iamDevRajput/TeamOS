'use client';

import React, { useState } from 'react';
import type { TaskDto, CreateProposalDto, ProposalTaskCreate } from '@teamos/contracts';
import { Modal, Input, Textarea, Button } from './ui';
import { PlusIcon, XIcon } from './ui/icons';

interface CreateProposalModalProps {
  isOpen: boolean;
  onClose: () => void;
  orgId: string;
  projectId: string;
  projectKey: string;
  tasks: TaskDto[];
  apiBaseUrl: string;
  onSuccess: () => void;
}

export function CreateProposalModal({
  isOpen,
  onClose,
  orgId,
  projectId,
  projectKey,
  tasks,
  apiBaseUrl,
  onSuccess,
}: CreateProposalModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [plannedTasks, setPlannedTasks] = useState<Array<{ tempId: string; title: string; estimate: string }>>([
    { tempId: `temp-${Date.now()}-1`, title: '', estimate: '3' },
  ]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  function handleAddTaskRow() {
    setPlannedTasks((prev) => [
      ...prev,
      { tempId: `temp-${Date.now()}-${prev.length + 1}`, title: '', estimate: '3' },
    ]);
  }

  function handleRemoveTaskRow(idx: number) {
    setPlannedTasks((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;

    const validTasks = plannedTasks.filter((t) => t.title.trim().length > 0);
    if (validTasks.length === 0) {
      setError('Please add at least one planned task to the proposal.');
      return;
    }

    setLoading(true);
    setError(null);

    const tasksToCreate: ProposalTaskCreate[] = validTasks.map((t) => ({
      tempId: t.tempId,
      title: t.title.trim(),
      remainingEstimateWorkdays: t.estimate ? Number(t.estimate) : undefined,
    }));

    const body: CreateProposalDto = {
      title: title.trim(),
      description: description.trim() || undefined,
      kind: 'PLAN',
      payload: {
        tasksToCreate,
      },
    };

    try {
      const res = await fetch(
        `${apiBaseUrl}/api/v1/orgs/${orgId}/projects/${projectId}/proposals`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        },
      );

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || 'Failed to submit proposal.');
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error submitting proposal.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Submit Change Proposal"
      description={`Propose a plan of tasks and dependencies for project ${projectKey}. Requires admin review.`}
      maxWidth="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 text-xs text-rose-700 bg-rose-50 border border-rose-200/80 rounded-lg">
            {error}
          </div>
        )}

        <Input
          label="Proposal Title"
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Phase 2 Architecture Refactoring"
        />

        <Textarea
          label="Proposal Description (Optional)"
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Objectives, technical context, expected timeline..."
        />

        <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
              Planned Tasks ({plannedTasks.length})
            </label>
            <Button
              type="button"
              variant="outline"
              size="xs"
              onClick={handleAddTaskRow}
              leftIcon={<PlusIcon className="w-3 h-3" />}
            >
              Add Task Row
            </Button>
          </div>

          <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
            {plannedTasks.map((item, idx) => (
              <div key={item.tempId} className="flex items-center gap-2">
                <input
                  type="text"
                  required
                  value={item.title}
                  onChange={(e) => {
                    const val = e.target.value;
                    setPlannedTasks((prev) =>
                      prev.map((t, i) => (i === idx ? { ...t, title: val } : t)),
                    );
                  }}
                  placeholder={`Task ${idx + 1} title...`}
                  className="flex-1 px-3 py-1.5 text-xs border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 shadow-xs"
                />
                <input
                  type="number"
                  min="0"
                  max="365"
                  value={item.estimate}
                  onChange={(e) => {
                    const val = e.target.value;
                    setPlannedTasks((prev) =>
                      prev.map((t, i) => (i === idx ? { ...t, estimate: val } : t)),
                    );
                  }}
                  placeholder="Days"
                  className="w-16 px-2 py-1.5 text-xs border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 shadow-xs font-mono"
                />
                {plannedTasks.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveTaskRow(idx)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg transition-colors"
                  >
                    <XIcon className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="pt-3 flex items-center justify-end gap-2.5">
          <Button type="button" variant="ghost" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" isLoading={loading}>
            Submit Proposal
          </Button>
        </div>
      </form>
    </Modal>
  );
}
