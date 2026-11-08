'use client';

import React, { useState, useEffect } from 'react';
import type { TaskDto, TaskStatus, OrgMemberDto, DependencyDto } from '@teamos/contracts';

interface TaskDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: TaskDto | null;
  allTasks?: TaskDto[];
  projectKey: string;
  orgId: string;
  members: OrgMemberDto[];
  apiBaseUrl: string;
  onUpdated: () => void;
}

export function TaskDetailModal({
  isOpen,
  onClose,
  task,
  allTasks = [],
  projectKey,
  orgId,
  members,
  apiBaseUrl,
  onUpdated,
}: TaskDetailModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<TaskStatus>('TODO');
  const [assigneeId, setAssigneeId] = useState('');
  const [estimate, setEstimate] = useState<string>('');
  const [dueDate, setDueDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<string | null>(null);

  // Dependency state
  const [dependencies, setDependencies] = useState<DependencyDto[]>([]);
  const [selectedBlockerId, setSelectedBlockerId] = useState('');
  const [depLoading, setDepLoading] = useState(false);
  const [depError, setDepError] = useState<string | null>(null);

  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description || '');
      setStatus(task.status);
      setAssigneeId(task.assigneeId || '');
      setEstimate(
        task.remainingEstimateWorkdays !== undefined
          ? String(task.remainingEstimateWorkdays)
          : '',
      );
      setDueDate(task.dueDate || '');
      setError(null);
      setConflict(null);
      setDepError(null);
      loadDependencies();
    }
  }, [task]);

  async function loadDependencies() {
    if (!task) return;
    setDepLoading(true);
    try {
      const res = await fetch(
        `${apiBaseUrl}/api/v1/orgs/${orgId}/projects/${task.projectId}/dependencies`,
        { credentials: 'include' },
      );
      if (res.ok) {
        const data: DependencyDto[] = await res.json();
        setDependencies(data);
      }
    } catch (err) {
      console.error('Failed to load dependencies', err);
    } finally {
      setDepLoading(false);
    }
  }

  if (!isOpen || !task) return null;

  const currentBlockerIds = dependencies.length > 0
    ? dependencies
        .filter((d) => (d.blockedTaskId || (d as any).dependentTaskId) === task.id)
        .map((d) => d.blockerTaskId)
    : ((task as any).blockerTaskIds || []);

  const blockerTasks = allTasks.filter((t) => currentBlockerIds.includes(t.id));

  // Available tasks to add as blockers: not self, and not already a blocker
  const availableBlockers = allTasks.filter(
    (t) => t.id !== task.id && !currentBlockerIds.includes(t.id),
  );

  async function handleAddBlocker() {
    if (!selectedBlockerId || !task) return;
    setDepLoading(true);
    setDepError(null);

    try {
      const res = await fetch(
        `${apiBaseUrl}/api/v1/orgs/${orgId}/projects/${task.projectId}/dependencies`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            blockerTaskId: selectedBlockerId,
            blockedTaskId: task.id,
          }),
        },
      );

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || 'Failed to add dependency');
      }

      setSelectedBlockerId('');
      await loadDependencies();
      onUpdated();
    } catch (err: any) {
      setDepError(err.message || 'Error adding dependency edge');
    } finally {
      setDepLoading(false);
    }
  }

  async function handleRemoveBlocker(blockerTaskId: string) {
    if (!task) return;
    setDepLoading(true);
    setDepError(null);

    try {
      const res = await fetch(
        `${apiBaseUrl}/api/v1/orgs/${orgId}/projects/${task.projectId}/dependencies`,
        {
          method: 'DELETE',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            blockerTaskId,
            blockedTaskId: task.id,
          }),
        },
      );

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || 'Failed to remove dependency');
      }

      await loadDependencies();
      onUpdated();
    } catch (err: any) {
      setDepError(err.message || 'Error removing dependency edge');
    } finally {
      setDepLoading(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!task) return;
    setLoading(true);
    setError(null);
    setConflict(null);

    try {
      const res = await fetch(
        `${apiBaseUrl}/api/v1/orgs/${orgId}/projects/${task.projectId}/tasks/${task.id}`,
        {
          method: 'PATCH',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            title: title.trim(),
            description: description.trim() || undefined,
            status,
            assigneeId: assigneeId || null,
            remainingEstimateWorkdays: estimate ? Number(estimate) : null,
            dueDate: dueDate || null,
            expectedVersion: task.version, // Required optimistic lock parameter!
          }),
        },
      );

      if (res.status === 409) {
        const data = await res.json().catch(() => ({}));
        setConflict(
          data.message ||
            'Concurrency Conflict: this task was modified by another user. Please reload.',
        );
        return;
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || `Failed to update task (${res.status})`);
      }

      onUpdated();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error updating task.');
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (!task) return;
    if (!confirm(`Are you sure you want to delete ${projectKey}-${task.number}?`)) {
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(
        `${apiBaseUrl}/api/v1/orgs/${orgId}/projects/${task.projectId}/tasks/${task.id}`,
        {
          method: 'DELETE',
          credentials: 'include',
        },
      );

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || 'Failed to delete task.');
      }

      onUpdated();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error deleting task.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl border border-slate-200 my-8">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200">
              {projectKey}-{task.number}
            </span>
            <span className="text-xs text-slate-400">Version: {task.version}</span>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors text-sm font-semibold p-1"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSave} className="mt-4 space-y-4">
          {conflict && (
            <div className="p-3 bg-amber-50 border border-amber-300 rounded-lg text-amber-900 text-xs leading-relaxed space-y-1">
              <p className="font-bold">⚠️ Optimistic Concurrency Collision (HTTP 409)</p>
              <p>{conflict}</p>
              <button
                type="button"
                onClick={() => {
                  onUpdated();
                  onClose();
                }}
                className="text-xs font-semibold underline text-amber-800 hover:text-amber-950 mt-1"
              >
                Reload latest task version
              </button>
            </div>
          )}

          {error && (
            <div className="p-3 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
              Title <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
              Description
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add details, links, or notes..."
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as TaskStatus)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
              >
                <option value="TODO">To Do</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="DONE">Done</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                Assignee
              </label>
              <select
                value={assigneeId}
                onChange={(e) => setAssigneeId(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Unassigned</option>
                {members.map((m) => (
                  <option key={m.userId} value={m.userId}>
                    {m.displayName || m.login} (@{m.login})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                Remaining Workdays
              </label>
              <input
                type="number"
                min="0"
                max="365"
                value={estimate}
                onChange={(e) => setEstimate(e.target.value)}
                placeholder="Workdays (e.g. 5)"
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                Due Date
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Task Dependencies & Blockers Section */}
          <div className="pt-4 border-t border-slate-200 space-y-3">
            <div>
              <label className="block text-xs font-bold uppercase text-slate-700 mb-0.5">
                Blockers (Finish-to-Start)
              </label>
              <p className="text-[11px] text-slate-400">
                Tasks that must finish before this task can start. Cycles are strictly rejected.
              </p>
            </div>

            {depError && (
              <div className="p-2.5 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg">
                ⚠️ {depError}
              </div>
            )}

            {depLoading && blockerTasks.length === 0 ? (
              <p className="text-xs text-slate-400 italic flex items-center gap-1.5">
                <span className="inline-block animate-spin text-blue-500">⏳</span> Loading blockers...
              </p>
            ) : blockerTasks.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {blockerTasks.map((b) => (
                  <div
                    key={b.id}
                    className={`inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs border ${
                      b.status === 'DONE'
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        : 'bg-amber-50 text-amber-900 border-amber-200 font-semibold'
                    }`}
                  >
                    <span>
                      {projectKey}-{b.number} {b.title}
                    </span>
                    <button
                      type="button"
                      disabled={depLoading}
                      onClick={() => handleRemoveBlocker(b.id)}
                      className="text-slate-400 hover:text-rose-600 font-bold ml-1"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic">No blockers set for this task.</p>
            )}

            {availableBlockers.length > 0 && (
              <div className="flex items-center gap-2 pt-1">
                <select
                  value={selectedBlockerId}
                  onChange={(e) => setSelectedBlockerId(e.target.value)}
                  disabled={depLoading}
                  className="flex-1 px-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select a task to block this one...</option>
                  {availableBlockers.map((b) => (
                    <option key={b.id} value={b.id}>
                      {projectKey}-{b.number}: {b.title} ({b.status})
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={!selectedBlockerId || depLoading}
                  onClick={handleAddBlocker}
                  className="px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 rounded-lg shadow-sm transition-colors whitespace-nowrap"
                >
                  + Add Blocker
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-slate-100">
            <button
              type="button"
              disabled={loading}
              onClick={handleDelete}
              className="text-xs text-rose-600 hover:text-rose-800 font-semibold transition-colors"
            >
              Delete Task
            </button>

            <div className="flex gap-2">
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
                disabled={loading || Boolean(conflict)}
                className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg shadow-sm transition-colors"
              >
                {loading ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
