'use client';

import React, { useState } from 'react';
import type { TaskDto, TaskStatus } from '@teamos/contracts';

interface TaskBoardProps {
  tasks: TaskDto[];
  projectKey: string;
  onSelectTask: (task: TaskDto) => void;
  onQuickStatusChange: (taskId: string, newStatus: TaskStatus, version: number) => void;
  onOpenCreateTask: () => void;
}

const COLUMNS: { id: TaskStatus; label: string; color: string }[] = [
  { id: 'TODO', label: 'To Do', color: 'bg-slate-100 text-slate-700 border-slate-300' },
  { id: 'IN_PROGRESS', label: 'In Progress', color: 'bg-blue-50 text-blue-800 border-blue-200' },
  { id: 'DONE', label: 'Done', color: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
  { id: 'CANCELLED', label: 'Cancelled', color: 'bg-rose-50 text-rose-800 border-rose-200' },
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
      {/* Controls Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tasks by title..."
            className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg w-full sm:w-64 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />

          <div className="flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setViewMode('board')}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                viewMode === 'board' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500'
              }`}
            >
              Board
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                viewMode === 'table' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500'
              }`}
            >
              Table
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={onOpenCreateTask}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-colors whitespace-nowrap"
        >
          <span>+</span> New Task
        </button>
      </div>

      {filteredTasks.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-xl border border-dashed border-slate-200 space-y-3">
          <div className="text-2xl">📋</div>
          <h4 className="text-sm font-semibold text-slate-800">No tasks in this project yet</h4>
          <p className="text-xs text-slate-400">
            Create tasks to start tracking work, estimates, dependencies, and delivery risk.
          </p>
          <button
            type="button"
            onClick={onOpenCreateTask}
            className="px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-colors"
          >
            + Create First Task
          </button>
        </div>
      ) : viewMode === 'board' ? (
        /* Kanban Board Columns */
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {COLUMNS.map((col) => {
            const colTasks = filteredTasks.filter((t) => t.status === col.id);

            return (
              <div
                key={col.id}
                className="bg-slate-100/70 rounded-xl p-3 border border-slate-200/80 flex flex-col min-h-[450px]"
              >
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-200/60">
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold uppercase border ${col.color}`}
                    >
                      {col.label}
                    </span>
                    <span className="text-xs font-bold text-slate-400">{colTasks.length}</span>
                  </div>
                </div>

                <div className="space-y-2 flex-1 overflow-y-auto">
                  {colTasks.map((task) => (
                    <div
                      key={task.id}
                      onClick={() => onSelectTask(task)}
                      className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm hover:shadow transition-shadow cursor-pointer space-y-2 group"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-[10px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                            {projectKey}-{task.number}
                          </span>
                          {(task as any).isBlocked && (
                            <span className="text-[9px] font-bold text-amber-800 bg-amber-100 px-1 py-0.5 rounded border border-amber-200">
                              🔒 Blocked
                            </span>
                          )}
                        </div>
                        {task.remainingEstimateWorkdays !== undefined && (
                          <span className="text-[10px] font-semibold text-slate-600 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200">
                            {task.remainingEstimateWorkdays}d left
                          </span>
                        )}
                      </div>

                      <h5 className="text-xs font-semibold text-slate-900 line-clamp-2">
                        {task.title}
                      </h5>

                      <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-[10px] text-slate-400">
                        <span>{task.assigneeName ? `@${task.assigneeName}` : 'Unassigned'}</span>
                        {task.dueDate && <span>Due: {task.dueDate}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Table View */
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 text-[11px] font-semibold uppercase text-slate-500 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">Key</th>
                <th className="px-4 py-3">Title</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Assignee</th>
                <th className="px-4 py-3">Remaining</th>
                <th className="px-4 py-3">Due Date</th>
                <th className="px-4 py-3">Version</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredTasks.map((t) => (
                <tr
                  key={t.id}
                  onClick={() => onSelectTask(t)}
                  className="hover:bg-slate-50/70 transition-colors cursor-pointer"
                >
                  <td className="px-4 py-3 font-mono font-bold text-slate-700 whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      <span>{projectKey}-{t.number}</span>
                      {(t as any).isBlocked && (
                        <span className="text-[9px] font-bold text-amber-800 bg-amber-100 px-1 py-0.5 rounded border border-amber-200">
                          🔒 Blocked
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-900 max-w-xs truncate">
                    {t.title}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${
                        t.status === 'DONE'
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : t.status === 'IN_PROGRESS'
                          ? 'bg-blue-50 text-blue-800 border-blue-200'
                          : t.status === 'CANCELLED'
                          ? 'bg-rose-50 text-rose-800 border-rose-200'
                          : 'bg-slate-100 text-slate-700 border-slate-300'
                      }`}
                    >
                      {t.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                    {t.assigneeName ? `@${t.assigneeName}` : '—'}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {t.remainingEstimateWorkdays !== undefined ? `${t.remainingEstimateWorkdays} days` : '—'}
                  </td>
                  <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                    {t.dueDate || '—'}
                  </td>
                  <td className="px-4 py-3 font-mono text-slate-400">
                    v{t.version}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
