'use client';

import React, { useState } from 'react';
import type { TaskDto, TaskStatus, TaskPriority, OrgMemberDto, DuplicateTaskCandidateDto } from '@teamos/contracts';
import { Modal, Input, Textarea, Select, Button, Badge } from './ui';

interface CreateTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  orgId: string;
  projectId: string;
  projectKey: string;
  members: OrgMemberDto[];
  apiBaseUrl: string;
  onSuccess: (task: TaskDto) => void;
  initialStatus?: TaskStatus;
}

export function CreateTaskModal({
  isOpen,
  onClose,
  orgId,
  projectId,
  projectKey,
  members,
  apiBaseUrl,
  onSuccess,
  initialStatus = 'TODO',
}: CreateTaskModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<TaskStatus>(initialStatus);
  const [priority, setPriority] = useState<TaskPriority>('MEDIUM');
  const [assigneeId, setAssigneeId] = useState('');
  const [estimate, setEstimate] = useState<string>('3');
  const [dueDate, setDueDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [duplicates, setDuplicates] = useState<DuplicateTaskCandidateDto[]>([]);

  // Debounced duplicate detection
  React.useEffect(() => {
    if (!title.trim() || title.trim().length < 4) {
      setDuplicates([]);
      return;
    }

    const handler = setTimeout(async () => {
      try {
        const res = await fetch(`${apiBaseUrl}/api/v1/orgs/${orgId}/projects/${projectId}/tasks/check-duplicates`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ title: title.trim(), description: description.trim() }),
        });
        if (res.ok) {
          const list: DuplicateTaskCandidateDto[] = await res.json();
          setDuplicates(list);
        }
      } catch {
        // ignore duplicate check errors
      }
    }, 400);

    return () => clearTimeout(handler);
  }, [title, description, apiBaseUrl, orgId, projectId]);

  React.useEffect(() => {
    if (isOpen) {
      setStatus(initialStatus);
      setPriority('MEDIUM');
      setTitle('');
      setDescription('');
      setAssigneeId('');
      setEstimate('3');
      setDueDate('');
      setError(null);
      setDuplicates([]);
    }
  }, [isOpen, initialStatus]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      setError('Task title is required.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/orgs/${orgId}/projects/${projectId}/tasks`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || undefined,
          status,
          priority,
          assigneeId: assigneeId || undefined,
          remainingEstimateWorkdays: estimate ? Number(estimate) : undefined,
          dueDate: dueDate || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || `Failed to create task (${res.status})`);
      }

      const created: TaskDto = await res.json();
      setTitle('');
      setDescription('');
      setStatus('TODO');
      setAssigneeId('');
      setEstimate('3');
      setDueDate('');
      onSuccess(created);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error creating task.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create New Task"
      description={`Project ${projectKey} · Tasks form the foundation for CPM critical path forecasting.`}
      maxWidth="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 text-xs text-rose-700 bg-rose-50 border border-rose-200/80 rounded-lg">
            {error}
          </div>
        )}

        <Input
          label="Task Title"
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Implement deterministic critical path algorithm"
        />

        {duplicates.length > 0 && (
          <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 rounded-xl space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-bold text-amber-800 dark:text-amber-300">
              <span>⚠️ Potential Duplicate Work Detected</span>
              <Badge variant="warning" size="xs">
                {Math.round(duplicates[0].similarityScore * 100)}% Match
              </Badge>
            </div>
            <p className="text-[11px] text-amber-700 dark:text-amber-400">
              {duplicates[0].reason}
            </p>
          </div>
        )}

        <Textarea
          label="Description (Optional)"
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Technical context, acceptance criteria, PR links..."
        />

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Select
            label="Initial Status"
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
            <option value="URGENT">🔴 Urgent</option>
            <option value="HIGH">🟠 High</option>
            <option value="MEDIUM">🟡 Medium</option>
            <option value="LOW">🔵 Low</option>
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
            placeholder="Workdays (e.g. 3)"
            helperText="Deterministic duration used for delivery schedule forecast."
          />

          <Input
            label="Due Date (Optional)"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
        </div>

        <div className="pt-3 flex items-center justify-end gap-2.5">
          <Button type="button" variant="ghost" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" isLoading={loading}>
            Create Task
          </Button>
        </div>
      </form>
    </Modal>
  );
}
