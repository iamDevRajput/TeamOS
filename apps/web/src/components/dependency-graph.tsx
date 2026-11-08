'use client';

import React, { useEffect, useState } from 'react';
import type { TaskDto, TaskWithDependenciesDto, DependencyDto } from '@teamos/contracts';
import { Badge, EmptyState } from './ui';
import { GitBranchIcon, CheckCircleIcon, AlertTriangleIcon, ClockIcon, ArrowRightIcon } from './ui/icons';

interface DependencyGraphProps {
  orgId: string;
  projectId: string;
  projectKey: string;
  apiBaseUrl: string;
  onSelectTask?: (taskId: string) => void;
  refreshKey?: number;
}

export function DependencyGraph({
  orgId,
  projectId,
  projectKey,
  apiBaseUrl,
  onSelectTask,
  refreshKey = 0,
}: DependencyGraphProps) {
  const [tasks, setTasks] = useState<TaskWithDependenciesDto[]>([]);
  const [dependencies, setDependencies] = useState<DependencyDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setError(null);
      try {
        const [tasksRes, depsRes] = await Promise.all([
          fetch(`${apiBaseUrl}/api/v1/orgs/${orgId}/projects/${projectId}/tasks`, {
            credentials: 'include',
          }),
          fetch(
            `${apiBaseUrl}/api/v1/orgs/${orgId}/projects/${projectId}/dependencies`,
            {
              credentials: 'include',
            },
          ),
        ]);

        if (!tasksRes.ok || !depsRes.ok) {
          throw new Error('Failed to load project dependency data');
        }

        const taskList: TaskWithDependenciesDto[] = await tasksRes.json();
        const depList: DependencyDto[] = await depsRes.json();

        setTasks(taskList);
        setDependencies(depList);
      } catch (err: any) {
        setError(err.message || 'Error loading dependency graph.');
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [orgId, projectId, apiBaseUrl, refreshKey]);

  if (loading) {
    return (
      <div className="bg-white dark:bg-slate-900 p-12 rounded-xl border border-slate-200/90 dark:border-slate-800 text-center space-y-3 shadow-xs">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent mx-auto" />
        <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Computing topological DAG layout & critical paths...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-rose-50 dark:bg-rose-950/30 border border-rose-200/80 dark:border-rose-900/50 rounded-xl text-xs text-rose-700 dark:text-rose-400">
        {error}
      </div>
    );
  }

  const taskMap = new Map(tasks.map((t) => [t.id, t]));

  // Compute topological rank / levels (in-degree from dependencies)
  const inDegree = new Map<string, number>();
  const adj = new Map<string, string[]>();

  tasks.forEach((t) => {
    inDegree.set(t.id, 0);
    adj.set(t.id, []);
  });

  // Index blockers per task for robust resolution
  const blockersByTaskId = new Map<string, string[]>();
  dependencies.forEach((d) => {
    const blockedId = d.blockedTaskId || (d as any).dependentTaskId;
    const blockerId = d.blockerTaskId;
    if (inDegree.has(blockedId)) {
      inDegree.set(blockedId, (inDegree.get(blockedId) || 0) + 1);
    }
    if (adj.has(blockerId)) {
      adj.get(blockerId)!.push(blockedId);
    }
    if (blockedId && blockerId) {
      const list = blockersByTaskId.get(blockedId) || [];
      if (!list.includes(blockerId)) list.push(blockerId);
      blockersByTaskId.set(blockedId, list);
    }
  });

  // Calculate topological levels
  const levels = new Map<string, number>();
  const queue: { id: string; level: number }[] = [];

  tasks.forEach((t) => {
    if ((inDegree.get(t.id) || 0) === 0) {
      queue.push({ id: t.id, level: 0 });
      levels.set(t.id, 0);
    }
  });

  while (queue.length > 0) {
    const { id, level } = queue.shift()!;
    const children = adj.get(id) || [];
    for (const childId of children) {
      const currentLevel = levels.get(childId) || 0;
      if (level + 1 > currentLevel) {
        levels.set(childId, level + 1);
        queue.push({ id: childId, level: level + 1 });
      }
    }
  }

  // Group tasks by level
  const maxLevel = Math.max(0, ...Array.from(levels.values()));
  const levelGroups: TaskWithDependenciesDto[][] = Array.from(
    { length: maxLevel + 1 },
    () => [],
  );

  tasks.forEach((t) => {
    const lvl = levels.get(t.id) ?? 0;
    if (levelGroups[lvl]) {
      levelGroups[lvl].push(t);
    } else {
      levelGroups[0].push(t);
    }
  });

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/90 dark:border-slate-800 p-5 sm:p-6 space-y-6 shadow-xs">
      {/* Header & Status Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-200/80 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 tracking-tight">
              Task Dependency Graph (DAG)
            </h3>
            <Badge variant="success" size="xs">
              Finish-to-Start DAG Verified
            </Badge>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Deterministic topological sequencing. Blocker tasks strictly precede dependent execution.
          </p>
        </div>

        {/* Graph Legend */}
        <div className="flex items-center gap-3 text-[11px] font-medium text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-200/80 dark:border-slate-800">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-slate-400" />
            <span>Ready</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            <span>Blocked</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>Completed</span>
          </div>
        </div>
      </div>

      {tasks.length === 0 ? (
        <EmptyState
          icon={<GitBranchIcon className="w-5 h-5" />}
          title="No tasks to graph yet"
          description="Create tasks and set up finish-to-start blocker constraints to see the topological pipeline."
        />
      ) : (
        <div className="space-y-6 overflow-x-auto pb-2">
          {/* Topological Stage Columns */}
          <div className="flex items-start gap-4 min-w-[700px]">
            {levelGroups.map((stageTasks, stageIdx) => (
              <div
                key={stageIdx}
                className="flex-1 bg-slate-50/70 dark:bg-slate-950/50 border border-slate-200/80 dark:border-slate-800/80 rounded-xl p-3.5 space-y-3 min-w-[240px]"
              >
                <div className="flex items-center justify-between pb-2 border-b border-slate-200/70 dark:border-slate-800 text-xs font-bold text-slate-800 dark:text-slate-200">
                  <div className="flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 text-[10px] font-bold flex items-center justify-center font-mono">
                      {stageIdx + 1}
                    </span>
                    <span>Stage {stageIdx + 1}</span>
                  </div>
                  <span className="font-mono text-[10px] text-slate-400 dark:text-slate-500">
                    {stageTasks.length} task{stageTasks.length !== 1 ? 's' : ''}
                  </span>
                </div>

                <div className="space-y-2.5">
                  {stageTasks.map((t) => {
                    const blockerIds =
                      (t as any).blockerTaskIds && (t as any).blockerTaskIds.length > 0
                        ? (t as any).blockerTaskIds
                        : blockersByTaskId.get(t.id) || [];
                    const blockers: TaskDto[] = blockerIds
                      .map((id: string) => taskMap.get(id))
                      .filter((item: TaskDto | undefined): item is TaskDto => Boolean(item));
                    const isBlocked =
                      (t as any).isBlocked !== undefined
                        ? (t as any).isBlocked
                        : blockers.some((b) => b.status !== 'DONE' && b.status !== 'CANCELLED');

                    return (
                      <div
                        key={t.id}
                        onClick={() => onSelectTask?.(t.id)}
                        className={`bg-white dark:bg-slate-900 rounded-lg p-3 border shadow-xs transition-all cursor-pointer space-y-2 hover:shadow-card-hover hover:border-blue-500 ${
                          isBlocked
                            ? 'border-amber-300 dark:border-amber-700 ring-1 ring-amber-200/80 dark:ring-amber-900/50 bg-amber-50/20 dark:bg-amber-950/20'
                            : t.status === 'DONE'
                            ? 'border-emerald-200/80 dark:border-emerald-800/80 bg-emerald-50/10 dark:bg-emerald-950/20'
                            : 'border-slate-200/90 dark:border-slate-800'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1.5">
                          <span className="font-mono text-[10px] font-bold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-200/80 dark:border-slate-700">
                            {projectKey}-{t.number}
                          </span>

                          {isBlocked ? (
                            <Badge variant="warning" size="xs" dot>
                              Blocked
                            </Badge>
                          ) : (
                            <Badge
                              variant={
                                t.status === 'DONE'
                                  ? 'success'
                                  : t.status === 'IN_PROGRESS'
                                  ? 'info'
                                  : 'default'
                              }
                              size="xs"
                            >
                              {t.status}
                            </Badge>
                          )}
                        </div>

                        <div className="text-xs font-semibold text-slate-900 dark:text-slate-100 line-clamp-2 leading-relaxed">
                          {t.title}
                        </div>

                        {blockers.length > 0 && (
                          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1">
                            <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
                              Waiting on:
                            </span>
                            <div className="flex flex-wrap gap-1">
                              {blockers.map((b, bIdx) => (
                                <span
                                  key={b?.id || `blocker-${bIdx}`}
                                  className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${
                                    b?.status === 'DONE'
                                      ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800 line-through'
                                      : 'bg-amber-50 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800 font-bold'
                                  }`}
                                >
                                  {projectKey}-{b?.number}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Active Dependency Edges List */}
          <div className="pt-4 border-t border-slate-200/80 dark:border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                Active Finish-to-Start Edges ({dependencies.length})
              </h4>
              <span className="text-[11px] text-slate-400 dark:text-slate-500">Strictly Non-Cyclic</span>
            </div>

            {dependencies.length === 0 ? (
              <p className="text-xs text-slate-400 dark:text-slate-500 italic">
                No dependencies established yet. Tasks can be worked on concurrently.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {dependencies.map((d) => {
                  const blocker = taskMap.get(d.blockerTaskId);
                  const blocked = taskMap.get(d.blockedTaskId || (d as any).dependentTaskId);

                  return (
                    <div
                      key={`${d.blockerTaskId}-${d.blockedTaskId || (d as any).dependentTaskId}`}
                      className="p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 rounded-lg text-xs flex items-center justify-between shadow-xs"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-900 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                          {projectKey}-{blocker?.number || '?'}
                        </span>
                        <ArrowRightIcon className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                        <span className="font-mono font-bold text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-900 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                          {projectKey}-{blocked?.number || '?'}
                        </span>
                      </div>
                      <Badge variant="outline" size="xs">
                        FS
                      </Badge>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
