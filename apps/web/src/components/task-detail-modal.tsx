'use client';

import React, { useState, useEffect } from 'react';
import type { TaskDto, TaskStatus, TaskPriority, OrgMemberDto, DependencyDto, PresenceUserDto } from '@teamos/contracts';
import { Input, Textarea, Select, Button, Badge, PriorityBadge } from './ui';
import { AlertTriangleIcon, ClockIcon, LockIcon, XIcon, PlusIcon, FlameIcon } from './ui/icons';
import { TaskComments } from './task-comments';

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
  currentUserId?: string;
  collaborators?: PresenceUserDto[];
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
  currentUserId,
  collaborators = [],
}: TaskDetailModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<TaskStatus>('TODO');
  const [priority, setPriority] = useState<TaskPriority>('MEDIUM');
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
      setPriority((task.priority as TaskPriority) || 'MEDIUM');
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

  // Escape key handler for accessible drawer dismissal
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

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

  // Preserve dependency consistency calculation
  const currentBlockerIds =
    dependencies.length > 0
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
            priority,
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
    <div className="fixed inset-0 z-50 overflow-hidden" role="dialog" aria-modal="true">
      {/* Non-blocking backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/40 dark:bg-black/60 backdrop-blur-xs transition-opacity duration-300"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Slide-over Right Sheet Drawer */}
      <div className="fixed inset-y-0 right-0 max-w-full flex pl-6 sm:pl-10">
        <div className="w-screen max-w-xl bg-white dark:bg-slate-900 shadow-2xl border-l border-slate-200 dark:border-slate-800 flex flex-col h-full overflow-hidden animate-in slide-in-from-right duration-300">
          {/* Drawer Header */}
          <div className="px-5 py-4 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-950/70">
            <div className="flex items-center gap-2.5">
              <span className="font-mono text-xs font-bold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded border border-blue-200 dark:border-blue-800">
                {projectKey}-{task.number}
              </span>
              <PriorityBadge priority={priority} size="xs" />
              <span className="text-xs text-slate-400 font-mono">v{task.version}</span>
              {collaborators.filter((c) => c.taskId === task.id && c.userId !== currentUserId).length > 0 && (
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-[10px] text-emerald-700 dark:text-emerald-300 font-medium animate-pulse">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <span>
                    {collaborators
                      .filter((c) => c.taskId === task.id && c.userId !== currentUserId)
                      .map((v) => v.displayName || v.login)
                      .join(', ')}{' '}
                    viewing now
                  </span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-md transition-colors"
                aria-label="Close drawer"
              >
                <XIcon className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Drawer Form Body (Scrollable) */}
          <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
            {conflict && (
              <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 rounded-lg text-amber-900 dark:text-amber-200 text-xs leading-relaxed space-y-1">
                <p className="font-bold flex items-center gap-1.5">
                  <AlertTriangleIcon className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  <span>Optimistic Concurrency Collision (HTTP 409)</span>
                </p>
                <p>{conflict}</p>
                <button
                  type="button"
                  onClick={() => {
                    onUpdated();
                    onClose();
                  }}
                  className="text-xs font-semibold underline text-amber-800 dark:text-amber-300 hover:text-amber-950 mt-1 inline-block"
                >
                  Reload latest task version
                </button>
              </div>
            )}

            {error && (
              <div className="p-3 text-xs text-rose-700 bg-rose-50 dark:bg-rose-950/40 border border-rose-200/80 dark:border-rose-900 rounded-lg">
                {error}
              </div>
            )}

            <Input
              label="Task Title"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Implement OAuth PKCE exchange"
            />

            <Textarea
              label="Description"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add context, acceptance criteria, or PR notes..."
            />

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Select
                label="Status"
                value={status}
                onChange={(e) => setStatus(e.target.value as TaskStatus)}
              >
                <option value="TODO">To Do</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="DONE">Done</option>
                <option value="CANCELLED">Cancelled</option>
              </Select>

              <Select
                label="Priority"
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskPriority)}
              >
                <option value="URGENT">Urgent</option>
                <option value="HIGH">High</option>
                <option value="MEDIUM">Medium</option>
                <option value="LOW">Low</option>
              </Select>

              <Select
                label="Assignee"
                value={assigneeId}
                onChange={(e) => setAssigneeId(e.target.value)}
              >
                <option value="">Unassigned</option>
                {members.map((m) => (
                  <option key={m.userId} value={m.userId}>
                    {m.displayName || m.login} (@{m.login})
                  </option>
                ))}
              </Select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="Remaining Workdays"
                type="number"
                min="0"
                max="365"
                value={estimate}
                onChange={(e) => setEstimate(e.target.value)}
                placeholder="Workdays (e.g. 5)"
                helperText="Deterministic duration used for delivery schedule forecast."
              />

              <Input
                label="Due Date"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>

            {/* Task Dependencies & Blockers Section */}
            <div className="pt-4 border-t border-slate-200/80 dark:border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 tracking-tight">
                    Blockers (Finish-to-Start)
                  </label>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Tasks that must finish before this task can start. Verified strictly against DAG cycles.
                  </p>
                </div>
                <span className="font-mono text-[10px] text-slate-400">
                  {blockerTasks.length} blocker{blockerTasks.length === 1 ? '' : 's'}
                </span>
              </div>

              {depError && (
                <div className="p-2.5 text-xs text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 border border-rose-200/80 dark:border-rose-800 rounded-lg">
                  {depError}
                </div>
              )}

              {depLoading && blockerTasks.length === 0 ? (
                <p className="text-xs text-slate-400 italic">Loading blockers...</p>
              ) : blockerTasks.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {blockerTasks.map((b) => (
                    <div
                      key={b.id}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs border ${
                        b.status === 'DONE'
                          ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-200/80 dark:border-emerald-800'
                          : 'bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 border-amber-200/80 dark:border-amber-800 font-medium'
                      }`}
                    >
                      <span className="font-mono font-bold text-[11px]">
                        {projectKey}-{b.number}
                      </span>
                      <span className="truncate max-w-[150px]">{b.title}</span>
                      <button
                        type="button"
                        disabled={depLoading}
                        onClick={() => handleRemoveBlocker(b.id)}
                        aria-label={`Remove blocker ${projectKey}-${b.number}`}
                        className="text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 p-0.5 rounded transition-colors"
                      >
                        <XIcon className="w-3.5 h-3.5" />
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
                    className="flex-1 px-3 py-1.5 text-xs border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 shadow-xs"
                  >
                    <option value="">Select a task to block this one...</option>
                    {availableBlockers.map((b) => (
                      <option key={b.id} value={b.id}>
                        {projectKey}-{b.number}: {b.title} ({b.status})
                      </option>
                    ))}
                  </select>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={!selectedBlockerId || depLoading}
                    onClick={handleAddBlocker}
                    leftIcon={<PlusIcon className="w-3.5 h-3.5" />}
                  >
                    Add Blocker
                  </Button>
                </div>
              )}
            </div>

            {/* Engineering Discussion & Comments Thread */}
            <TaskComments
              orgId={orgId}
              projectId={task.projectId}
              taskId={task.id}
              currentUserId={currentUserId}
              apiBaseUrl={apiBaseUrl}
            />

            {/* Bottom Actions */}
            <div className="pt-4 border-t border-slate-200/80 dark:border-slate-800 flex items-center justify-between">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={loading}
                onClick={handleDelete}
                className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40"
              >
                Delete Task
              </Button>

              <div className="flex items-center gap-2">
                <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={loading}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  isLoading={loading}
                  disabled={Boolean(conflict)}
                >
                  Save Changes
                </Button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
