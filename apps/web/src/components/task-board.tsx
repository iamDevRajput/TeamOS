'use client';

import React, { useState } from 'react';
import type { TaskDto, TaskStatus } from '@teamos/contracts';
import { Badge, Button, EmptyState } from './ui';
import { SearchIcon, PlusIcon, LockIcon, ClockIcon } from './ui/icons';

interface TaskBoardProps {
  tasks: TaskDto[];
  projectKey: string;
  onSelectTask: (task: TaskDto) => void;
  onQuickStatusChange: (taskId: string, newStatus: TaskStatus, version: number) => void;
  onOpenCreateTask: () => void;
}

const COLUMNS: { id: TaskStatus; label: string; dotColor: string }[] = [
  { id: 'TODO', label: 'To Do', dotColor: 'bg-slate-400' },
  { id: 'IN_PROGRESS', label: 'In Progress', dotColor: 'bg-blue-500' },
  { id: 'DONE', label: 'Done', dotColor: 'bg-emerald-500' },
  { id: 'CANCELLED', label: 'Cancelled', dotColor: 'bg-rose-400' },
];

export function TaskBoard({
  tasks,
  projectKey,
  onSelectTask,
  onQuickStatusChange,
  onOpenCreateTask,
}: TaskBoardProps) {
  const [viewMode, setViewMode] = useState<'board' | 'table'>('board');
  const [search, setSearch] = useState('');

  const filteredTasks = tasks.filter((t) =>
    search.trim() ? t.title.toLowerCase().includes(search.toLowerCase()) : true,
  );

  return (
    <div className="space-y-4">
      {/* Search, View Toggle & Action Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200/90 shadow-xs">
        <div className="flex items-center gap-2.5 flex-1">
          <div className="relative w-full sm:w-72">
            <SearchIcon className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter tasks by title..."
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-colors"
            />
          </div>

          <div className="flex rounded-lg border border-slate-200 bg-slate-100/70 p-0.5 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setViewMode('board')}
              className={`px-3 py-1 rounded-md text-[11px] font-medium transition-all ${
                viewMode === 'board'
                  ? 'bg-white shadow-xs text-blue-600 font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Board
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`px-3 py-1 rounded-md text-[11px] font-medium transition-all ${
                viewMode === 'table'
                  ? 'bg-white shadow-xs text-blue-600 font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Table
            </button>
          </div>
        </div>

        <Button
          type="button"
          variant="primary"
          size="sm"
          onClick={onOpenCreateTask}
          leftIcon={<PlusIcon className="w-3.5 h-3.5" />}
        >
          Add Task
        </Button>
      </div>

      {filteredTasks.length === 0 ? (
        <EmptyState
          title="No tasks found"
          description={
            search
              ? `No tasks match the filter "${search}".`
              : 'Tasks track work, effort estimates, and blocker relationships for delivery risk forecasting.'
          }
          action={
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={search ? () => setSearch('') : onOpenCreateTask}
            >
              {search ? 'Clear Filter' : '+ Create First Task'}
            </Button>
          }
        />
      ) : viewMode === 'board' ? (
        /* Kanban Board Columns */
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {COLUMNS.map((col) => {
            const colTasks = filteredTasks.filter((t) => t.status === col.id);

            return (
              <div
                key={col.id}
                className="bg-slate-50/80 rounded-xl p-3 border border-slate-200/80 flex flex-col min-h-[460px]"
              >
                {/* Column Header */}
                <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-slate-200/70">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${col.dotColor}`} />
                    <span className="text-xs font-bold text-slate-800 tracking-tight">
                      {col.label}
                    </span>
                  </div>
                  <span className="font-mono text-[11px] font-bold text-slate-400 bg-white px-2 py-0.2 rounded-full border border-slate-200">
                    {colTasks.length}
                  </span>
                </div>

                {/* Column Tasks */}
                <div className="space-y-2.5 flex-1 overflow-y-auto">
                  {colTasks.map((task) => {
                    const isBlocked = (task as any).isBlocked;

                    return (
                      <div
                        key={task.id}
                        onClick={() => onSelectTask(task)}
                        className="bg-white p-3.5 rounded-lg border border-slate-200/90 shadow-xs hover:border-blue-500 hover:shadow-card-hover transition-all cursor-pointer space-y-2 group"
                      >
                        <div className="flex items-center justify-between gap-1.5">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-[10px] font-bold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200/80">
                              {projectKey}-{task.number}
                            </span>
                            {isBlocked && (
                              <Badge variant="warning" size="xs" dot>
                                Blocked
                              </Badge>
                            )}
                          </div>
                          {task.remainingEstimateWorkdays !== undefined && (
                            <span className="text-[10px] font-medium text-slate-500 font-mono flex items-center gap-1">
                              <ClockIcon className="w-3 h-3 text-slate-400" />
                              <span>{task.remainingEstimateWorkdays}d</span>
                            </span>
                          )}
                        </div>

                        <h5 className="text-xs font-semibold text-slate-900 group-hover:text-blue-600 line-clamp-2 leading-relaxed transition-colors">
                          {task.title}
                        </h5>

                        <div className="flex items-center justify-between pt-1.5 border-t border-slate-100 text-[10px] text-slate-400">
                          <span className="truncate max-w-[100px] text-slate-600 font-medium">
                            {task.assigneeName ? `@${task.assigneeName}` : 'Unassigned'}
                          </span>
                          {task.dueDate && (
                            <span className="text-slate-400 font-mono">
                              Due {task.dueDate}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Table View */
        <div className="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50/75 text-[11px] font-semibold uppercase tracking-wider text-slate-500 border-b border-slate-200/70">
                <tr>
                  <th className="px-5 py-3">Task Key</th>
                  <th className="px-5 py-3">Title</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Assignee</th>
                  <th className="px-5 py-3">Remaining Workdays</th>
                  <th className="px-5 py-3">Target Due</th>
                  <th className="px-5 py-3">Version</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredTasks.map((t) => (
                  <tr
                    key={t.id}
                    onClick={() => onSelectTask(t)}
                    className="hover:bg-slate-50/60 transition-colors cursor-pointer"
                  >
                    <td className="px-5 py-3.5 font-mono font-bold text-slate-700 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <span className="bg-slate-100 px-2 py-0.5 rounded border border-slate-200 text-xs">
                          {projectKey}-{t.number}
                        </span>
                        {(t as any).isBlocked && (
                          <Badge variant="warning" size="xs" dot>
                            Blocked
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3.5 font-semibold text-slate-900 max-w-sm truncate">
                      {t.title}
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <Badge
                        variant={
                          t.status === 'DONE'
                            ? 'success'
                            : t.status === 'IN_PROGRESS'
                            ? 'info'
                            : t.status === 'CANCELLED'
                            ? 'danger'
                            : 'default'
                        }
                        size="xs"
                      >
                        {t.status}
                      </Badge>
                    </td>
                    <td className="px-5 py-3.5 text-slate-600 whitespace-nowrap">
                      {t.assigneeName ? `@${t.assigneeName}` : '—'}
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap font-mono text-slate-700">
                      {t.remainingEstimateWorkdays !== undefined ? `${t.remainingEstimateWorkdays}d` : '—'}
                    </td>
                    <td className="px-5 py-3.5 text-slate-500 whitespace-nowrap font-mono">
                      {t.dueDate || '—'}
                    </td>
                    <td className="px-5 py-3.5 font-mono text-slate-400 text-[11px]">
                      v{t.version}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
