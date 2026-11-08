'use client';

import React, { useState } from 'react';
import type { TaskDto, CreateProposalDto, ProposalTaskCreate } from '@teamos/contracts';

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl border border-slate-200 my-8">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div>
            <h3 className="text-base font-bold text-slate-900">Submit Change Proposal</h3>
            <p className="text-xs text-slate-500">
              Propose a plan of tasks and dependencies for project {projectKey}. Requires admin review.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors text-sm font-semibold p-1"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {error && (
            <div className="p-3 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
              Proposal Title <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Q1 Auth Security Overhaul"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
              Proposal Description
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Provide context, deliverables, and rationale..."
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold uppercase text-slate-700">
                Proposed Tasks ({plannedTasks.length})
              </label>
              <button
                type="button"
                onClick={handleAddTaskRow}
                className="text-xs text-blue-600 hover:text-blue-800 font-semibold"
              >
                + Add Task
              </button>
            </div>

            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {plannedTasks.map((pt, idx) => (
                <div key={pt.tempId} className="flex items-center gap-2">
                  <input
                    type="text"
                    required
                    placeholder={`Task ${idx + 1} title...`}
                    value={pt.title}
                    onChange={(e) => {
                      const val = e.target.value;
                      setPlannedTasks((prev) =>
                        prev.map((t, i) => (i === idx ? { ...t, title: val } : t)),
                      );
                    }}
                    className="flex-1 px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <input
                    type="number"
                    min="0"
                    placeholder="Days"
                    value={pt.estimate}
                    onChange={(e) => {
                      const val = e.target.value;
                      setPlannedTasks((prev) =>
                        prev.map((t, i) => (i === idx ? { ...t, estimate: val } : t)),
                      );
                    }}
                    className="w-20 px-2 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {plannedTasks.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveTaskRow(idx)}
                      className="text-slate-400 hover:text-rose-600 p-1 font-bold text-xs"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
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
              {loading ? 'Submitting...' : 'Submit Proposal'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

