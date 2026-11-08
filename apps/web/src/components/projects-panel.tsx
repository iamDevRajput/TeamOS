'use client';

import React, { useEffect, useState } from 'react';
import type { ProjectDto, TaskDto, OrgMemberDto, OrgRole } from '@teamos/contracts';
import { CreateProjectModal } from './create-project-modal';
import { CreateTaskModal } from './create-task-modal';
import { TaskDetailModal } from './task-detail-modal';
import { TaskBoard } from './task-board';
import { DependencyGraph } from './dependency-graph';
import { RiskOverviewPanel } from './risk-overview-panel';
import { ProposalsPanel } from './proposals-panel';
import { ReportsPanel } from './reports-panel';

interface ProjectsPanelProps {
  orgId: string;
  members: OrgMemberDto[];
  currentUserRole?: OrgRole;
  apiBaseUrl: string;
}

export function ProjectsPanel({
  orgId,
  members,
  currentUserRole = 'MEMBER',
  apiBaseUrl,
}: ProjectsPanelProps) {
  const [projects, setProjects] = useState<ProjectDto[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [tasks, setTasks] = useState<TaskDto[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [projectTab, setProjectTab] = useState<
    'tasks' | 'dependencies' | 'risk' | 'proposals' | 'reports'
  >('tasks');

  // Modals
  const [createProjectOpen, setCreateProjectOpen] = useState(false);
  const [createTaskOpen, setCreateTaskOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<TaskDto | null>(null);
  const [projectRefreshKey, setProjectRefreshKey] = useState(0);

  // 1. Fetch projects
  useEffect(() => {
    async function loadProjects() {
      setLoadingProjects(true);
      setError(null);
      try {
        const res = await fetch(`${apiBaseUrl}/api/v1/orgs/${orgId}/projects`, {
          credentials: 'include',
        });
        if (res.ok) {
          const data: ProjectDto[] = await res.json();
          setProjects(data);
          if (data.length > 0) {
            setSelectedProjectId((prev) => {
              if (prev && data.some((p) => p.id === prev)) return prev;
              return data[0].id;
            });
          } else {
            setSelectedProjectId(null);
          }
        } else {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.message || 'Failed to load projects.');
        }
      } catch (err: any) {
        setError(err.message || 'Error loading projects.');
      } finally {
        setLoadingProjects(false);
      }
    }

    loadProjects();
  }, [orgId, apiBaseUrl, projectRefreshKey]);

  // 2. Fetch tasks for selected project
  useEffect(() => {
    if (!selectedProjectId) {
      setTasks([]);
      return;
    }

    async function loadTasks() {
      setLoadingTasks(true);
      try {
        const res = await fetch(
          `${apiBaseUrl}/api/v1/orgs/${orgId}/projects/${selectedProjectId}/tasks`,
          {
            credentials: 'include',
          },
        );
        if (res.ok) {
          const data: TaskDto[] = await res.json();
          setTasks(data);
        }
      } catch (err) {
        console.error('Failed to load tasks:', err);
      } finally {
        setLoadingTasks(false);
      }
    }

    loadTasks();
  }, [orgId, selectedProjectId, apiBaseUrl, projectRefreshKey]);

  const selectedProject = projects.find((p) => p.id === selectedProjectId) || null;

  function handleProjectCreated(p: ProjectDto) {
    setProjects((prev) => [p, ...prev]);
    setSelectedProjectId(p.id);
    setProjectRefreshKey((k) => k + 1);
  }

  function handleTaskUpdated() {
    setProjectRefreshKey((k) => k + 1);
  }

  return (
    <div className="space-y-6">
      {/* Project Selector & Actions Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3 overflow-x-auto max-w-full">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Projects:
          </span>
          {projects.map((p) => {
            const isSelected = p.id === selectedProjectId;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setSelectedProjectId(p.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  isSelected
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <span className="font-mono text-[11px] opacity-80">{p.key}</span>
                <span>{p.name}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                    isSelected ? 'bg-blue-700 text-blue-100' : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  {p.taskCount ?? 0}
                </span>
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => setCreateProjectOpen(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap"
        >
          <span>+</span> New Project
        </button>
      </div>

      {error && (
        <div className="p-3 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg">
          {error}
        </div>
      )}

      {loadingProjects ? (
        <div className="p-8 text-center text-xs text-slate-400">Loading projects...</div>
      ) : projects.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-xl border border-dashed border-slate-200 space-y-3">
          <div className="text-3xl">📁</div>
          <h4 className="text-base font-bold text-slate-900">No projects yet</h4>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Projects organize your tasks, team assignments, finish-to-start dependencies, and delivery risk calculations.
          </p>
          <button
            type="button"
            onClick={() => setCreateProjectOpen(true)}
            className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-colors"
          >
            + Create First Project
          </button>
        </div>
      ) : selectedProject ? (
        <div className="space-y-4">
          {/* Active Project Details Card */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-black bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded">
                  {selectedProject.key}
                </span>
                <h3 className="text-lg font-bold text-slate-900">{selectedProject.name}</h3>
              </div>
              <div className="flex items-center gap-4 text-xs text-slate-500 mt-1">
                {selectedProject.startDate && (
                  <span>Start: <strong className="text-slate-700">{selectedProject.startDate}</strong></span>
                )}
                {selectedProject.dueDate && (
                  <span>Target Delivery: <strong className="text-slate-700">{selectedProject.dueDate}</strong></span>
                )}
                <span>Timezone: {selectedProject.timezone}</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCreateTaskOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-colors"
              >
                <span>+</span> Add Task
              </button>
            </div>
          </div>

          {/* Sub Navigation */}
          <div className="flex items-center gap-2 border-b border-slate-200 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setProjectTab('tasks')}
              className={`pb-2.5 px-2 border-b-2 transition-colors ${
                projectTab === 'tasks'
                  ? 'border-blue-600 text-blue-600 font-bold'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              Tasks & Board ({tasks.length})
            </button>
            <button
              type="button"
              onClick={() => setProjectTab('dependencies')}
              className={`pb-2.5 px-2 border-b-2 transition-colors ${
                projectTab === 'dependencies'
                  ? 'border-blue-600 text-blue-600 font-bold'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              Dependency Graph (DAG)
            </button>
            <button
              type="button"
              onClick={() => setProjectTab('risk')}
              className={`pb-2.5 px-2 border-b-2 transition-colors ${
                projectTab === 'risk'
                  ? 'border-blue-600 text-blue-600 font-bold'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              Delivery Risk & What-If
            </button>
            <button
              type="button"
              onClick={() => setProjectTab('proposals')}
              className={`pb-2.5 px-2 border-b-2 transition-colors ${
                projectTab === 'proposals'
                  ? 'border-blue-600 text-blue-600 font-bold'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              Proposals & Plans
            </button>
            <button
              type="button"
              onClick={() => setProjectTab('reports')}
              className={`pb-2.5 px-2 border-b-2 transition-colors ${
                projectTab === 'reports'
                  ? 'border-blue-600 text-blue-600 font-bold'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              Health Reports
            </button>
          </div>

          {/* Tab Views */}
          {projectTab === 'tasks' ? (
            loadingTasks ? (
              <div className="p-8 text-center text-xs text-slate-400">Loading tasks...</div>
            ) : (
              <TaskBoard
                tasks={tasks}
                projectKey={selectedProject.key}
                onSelectTask={(task) => setSelectedTask(task)}
                onQuickStatusChange={() => {}}
                onOpenCreateTask={() => setCreateTaskOpen(true)}
              />
            )
          ) : projectTab === 'dependencies' ? (
            <DependencyGraph
              orgId={orgId}
              projectId={selectedProject.id}
              projectKey={selectedProject.key}
              apiBaseUrl={apiBaseUrl}
              onSelectTask={(taskId) => {
                const found = tasks.find((t) => t.id === taskId);
                if (found) setSelectedTask(found);
              }}
              refreshKey={projectRefreshKey}
            />
          ) : projectTab === 'risk' ? (
            <RiskOverviewPanel
              orgId={orgId}
              projectId={selectedProject.id}
              projectKey={selectedProject.key}
              tasks={tasks}
              apiBaseUrl={apiBaseUrl}
              refreshKey={projectRefreshKey}
            />
          ) : projectTab === 'proposals' ? (
            <ProposalsPanel
              orgId={orgId}
              projectId={selectedProject.id}
              projectKey={selectedProject.key}
              tasks={tasks}
              currentUserRole={currentUserRole}
              apiBaseUrl={apiBaseUrl}
              refreshKey={projectRefreshKey}
              onProposalApplied={() => setProjectRefreshKey((k) => k + 1)}
            />
          ) : (
            <ReportsPanel
              orgId={orgId}
              projectId={selectedProject.id}
              apiBaseUrl={apiBaseUrl}
            />
          )}
        </div>
      ) : null}

      {/* Modals */}
      <CreateProjectModal
        isOpen={createProjectOpen}
        onClose={() => setCreateProjectOpen(false)}
        orgId={orgId}
        apiBaseUrl={apiBaseUrl}
        onSuccess={handleProjectCreated}
      />

      {selectedProject && (
        <CreateTaskModal
          isOpen={createTaskOpen}
          onClose={() => setCreateTaskOpen(false)}
          orgId={orgId}
          projectId={selectedProject.id}
          projectKey={selectedProject.key}
          members={members}
          apiBaseUrl={apiBaseUrl}
          onSuccess={handleTaskUpdated}
        />
      )}

      {selectedProject && (
        <TaskDetailModal
          isOpen={Boolean(selectedTask)}
          onClose={() => setSelectedTask(null)}
          task={selectedTask}
          allTasks={tasks}
          projectKey={selectedProject.key}
          orgId={orgId}
          members={members}
          apiBaseUrl={apiBaseUrl}
          onUpdated={handleTaskUpdated}
        />
      )}
    </div>
  );
}
