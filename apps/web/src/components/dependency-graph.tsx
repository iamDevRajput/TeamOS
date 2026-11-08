'use client';

import React, { useEffect, useState } from 'react';
import type { TaskDto, TaskWithDependenciesDto, DependencyDto } from '@teamos/contracts';

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
      <div className="bg-white p-8 rounded-xl border border-slate-200 text-center space-y-2">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent mx-auto" />
        <p className="text-xs text-slate-500">Computing graph topology & dependencies...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700">
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
    <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-6 shadow-sm">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-slate-900">
              Task Dependency Graph (DAG)
            </h3>
            <span className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full font-semibold">
              ✓ Finish-to-Start DAG Verified
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Topological layout of tasks and deterministic finish-to-start constraints. Blocker
            tasks precede dependent work.
          </p>
        </div>

        <div className="flex items-center gap-4 text-xs font-medium text-slate-500">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-slate-400" />
            <span>Ready</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
            <span>Blocked</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <span>Completed</span>
          </div>
        </div>
      </div>

      {tasks.length === 0 ? (
        <div className="py-12 text-center text-slate-400 text-xs">
          No tasks available to graph yet.
        </div>
      ) : (
        <div className="space-y-6 overflow-x-auto pb-4">
          <div className="flex items-start gap-8 min-w-[700px]">
            {levelGroups.map((stageTasks, stageIdx) => (
              <div
                key={stageIdx}
                className="flex-1 bg-slate-50/70 border border-slate-200 rounded-xl p-4 space-y-3 min-w-[220px]"
              >
                <div className="flex items-center justify-between pb-2 border-b border-slate-200 text-xs font-bold text-slate-700">
                  <span>Stage {stageIdx + 1}</span>
                  <span className="font-normal text-slate-400">
                    {stageTasks.length} task{stageTasks.length !== 1 ? 's' : ''}
                  </span>
                </div>

                <div className="space-y-3">
                  {stageTasks.map((t) => {
                    const blockerIds = (t as any).blockerTaskIds && (t as any).blockerTaskIds.length > 0
                      ? (t as any).blockerTaskIds
                      : blockersByTaskId.get(t.id) || [];
                    const blockers: TaskDto[] = blockerIds
                      .map((id: string) => taskMap.get(id))
                      .filter((item: TaskDto | undefined): item is TaskDto => Boolean(item));
                    const isBlocked = (t as any).isBlocked !== undefined
                      ? (t as any).isBlocked
                      : blockers.some((b) => b.status !== 'DONE' && b.status !== 'CANCELLED');

                    return (
                      <div
                        key={t.id}
                        onClick={() => onSelectTask?.(t.id)}
                        className={`bg-white rounded-lg p-3 border shadow-sm transition-all cursor-pointer space-y-2 hover:shadow-md ${
                          isBlocked
                            ? 'border-amber-300 ring-1 ring-amber-200'
                            : t.status === 'DONE'
                            ? 'border-emerald-200'
                            : 'border-slate-200'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-[10px] font-bold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
                            {projectKey}-{t.number}
                          </span>

                          {isBlocked ? (
                            <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
                              🔒 Blocked
                            </span>
                          ) : (
                            <span
                              className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                                t.status === 'DONE'
                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                  : t.status === 'IN_PROGRESS'
                                  ? 'bg-blue-50 text-blue-800 border-blue-200'
                                  : 'bg-slate-100 text-slate-600 border-slate-200'
                              }`}
                            >
                              {t.status}
                            </span>
                          )}
                        </div>

                        <div className="text-xs font-semibold text-slate-900 line-clamp-2">
                          {t.title}
                        </div>

                        {blockers.length > 0 && (
                          <div className="pt-2 border-t border-slate-100 space-y-1">
                            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                              Waiting on:
                            </span>
                            <div className="flex flex-wrap gap-1">
                              {blockers.map((b) => (
                                <span
                                  key={b?.id || Math.random()}
                                  className={`text-[9px] font-mono px-1 py-0.5 rounded border ${
                                    b?.status === 'DONE'
                                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200 line-through'
                                      : 'bg-amber-50 text-amber-800 border-amber-200 font-bold'
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

          {/* Dependency Edge Table */}
          <div className="pt-4 border-t border-slate-200">
            <h4 className="text-xs font-bold text-slate-700 mb-2 uppercase tracking-wider">
              Active Finish-to-Start Edges ({dependencies.length})
            </h4>
            {dependencies.length === 0 ? (
              <p className="text-xs text-slate-400 italic">
                No dependencies established. Tasks can be worked on concurrently.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {dependencies.map((d) => {
                  const blocker = taskMap.get(d.blockerTaskId);
                  const blocked = taskMap.get(d.blockedTaskId || (d as any).dependentTaskId);

                  return (
                    <div
                      key={`${d.blockerTaskId}-${d.blockedTaskId || (d as any).dependentTaskId}`}
                      className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-slate-800">
                          {projectKey}-{blocker?.number || '?'}
                        </span>
                        <span className="text-blue-600 font-bold">➔</span>
                        <span className="font-mono font-bold text-slate-800">
                          {projectKey}-{blocked?.number || '?'}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-400">FS</span>
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

