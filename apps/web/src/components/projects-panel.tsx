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
import { Badge, Button, EmptyState } from './ui';
import {
  CalendarIcon,
  ClockIcon,
  GitBranchIcon,
  PlusIcon,
  ActivityIcon,
  FileTextIcon,
  LayersIcon,
} from './ui/icons';

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
    <div className="space-y-5">
      {/* Project Selector & Actions Header */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3 sm:p-4 rounded-xl border border-slate-200/90 shadow-xs">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 scrollbar-none flex-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 whitespace-nowrap mr-1">
            Projects:
          </span>
          {projects.map((p) => {
            const isSelected = p.id === selectedProjectId;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setSelectedProjectId(p.id)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap shadow-xs ${
                  isSelected
                    ? 'bg-blue-600 text-white shadow-xs border border-blue-700/40'
                    : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200/80'
                }`}
              >
                <span
                  className={`font-mono text-[10px] px-1.5 py-0.2 rounded ${
                    isSelected ? 'bg-blue-700 text-blue-100' : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  {p.key}
                </span>
                <span>{p.name}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                    isSelected ? 'bg-blue-700/80 text-blue-100' : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  {p.taskCount ?? 0}
                </span>
              </button>
            );
          })}
        </div>

        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => setCreateProjectOpen(true)}
          leftIcon={<PlusIcon className="w-3.5 h-3.5" />}
          className="whitespace-nowrap"
        >
          New Project
        </Button>
      </div>

      {error && (
        <div className="p-3 text-xs text-rose-700 bg-rose-50 border border-rose-200/80 rounded-lg">
          {error}
        </div>
      )}

      {loadingProjects ? (
        <div className="p-12 text-center text-xs text-slate-400">Loading projects...</div>
      ) : projects.length === 0 ? (
        <EmptyState
          icon={<LayersIcon className="w-5 h-5" />}
          title="No projects in this organization"
          description="Projects organize your tasks, team assignments, finish-to-start dependencies, and delivery risk calculations."
          action={
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={() => setCreateProjectOpen(true)}
            >
              + Create First Project
            </Button>
          }
        />
      ) : selectedProject ? (
        <div className="space-y-4">
          {/* Active Project Metadata Header */}
          <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200/90 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200/80 px-2 py-0.5 rounded">
                  {selectedProject.key}
                </span>
                <h3 className="text-base font-bold text-slate-900 tracking-tight">
                  {selectedProject.name}
                </h3>
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 pt-0.5">
                {selectedProject.startDate && (
                  <span className="flex items-center gap-1">
                    <CalendarIcon className="w-3.5 h-3.5 text-slate-400" />
                    <span>Start: <strong className="text-slate-700 font-mono">{selectedProject.startDate}</strong></span>
                  </span>
                )}
                {selectedProject.dueDate && (
                  <span className="flex items-center gap-1">
                    <ClockIcon className="w-3.5 h-3.5 text-slate-400" />
                    <span>Target Due: <strong className="text-slate-700 font-mono">{selectedProject.dueDate}</strong></span>
                  </span>
                )}
                <span className="text-slate-400">Timezone: {selectedProject.timezone}</span>
              </div>
            </div>

            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={() => setCreateTaskOpen(true)}
              leftIcon={<PlusIcon className="w-3.5 h-3.5" />}
            >
              Add Task
            </Button>
          </div>

          {/* Sub Navigation Tabs */}
          <div className="flex items-center gap-1 sm:gap-2 border-b border-slate-200/90 text-xs font-semibold overflow-x-auto scrollbar-none">
            <button
              type="button"
              onClick={() => setProjectTab('tasks')}
              className={`pb-2.5 px-3 border-b-2 transition-all whitespace-nowrap flex items-center gap-1.5 ${
                projectTab === 'tasks'
                  ? 'border-blue-600 text-blue-600 font-bold'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <span>Tasks & Board</span>
              <span className="font-mono text-[10px] text-slate-400">({tasks.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setProjectTab('dependencies')}
              className={`pb-2.5 px-3 border-b-2 transition-all whitespace-nowrap flex items-center gap-1.5 ${
                projectTab === 'dependencies'
                  ? 'border-blue-600 text-blue-600 font-bold'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <GitBranchIcon className="w-3.5 h-3.5" />
              <span>Dependency Graph (DAG)</span>
            </button>
            <button
              type="button"
              onClick={() => setProjectTab('risk')}
              className={`pb-2.5 px-3 border-b-2 transition-all whitespace-nowrap flex items-center gap-1.5 ${
                projectTab === 'risk'
                  ? 'border-blue-600 text-blue-600 font-bold'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <ActivityIcon className="w-3.5 h-3.5" />
              <span>Delivery Risk & What-If</span>
            </button>
            <button
              type="button"
              onClick={() => setProjectTab('proposals')}
              className={`pb-2.5 px-3 border-b-2 transition-all whitespace-nowrap flex items-center gap-1.5 ${
                projectTab === 'proposals'
                  ? 'border-blue-600 text-blue-600 font-bold'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <LayersIcon className="w-3.5 h-3.5" />
              <span>Proposals & Plans</span>
            </button>
            <button
              type="button"
              onClick={() => setProjectTab('reports')}
              className={`pb-2.5 px-3 border-b-2 transition-all whitespace-nowrap flex items-center gap-1.5 ${
                projectTab === 'reports'
                  ? 'border-blue-600 text-blue-600 font-bold'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <FileTextIcon className="w-3.5 h-3.5" />
              <span>Health Reports</span>
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
