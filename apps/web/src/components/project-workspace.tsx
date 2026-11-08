'use client';

import React, { useState, useEffect } from 'react';
import type {
  ProjectDto,
  TaskDto,
  OrgMemberDto,
  OrgRole,
  TaskStatus,
  DependencyDto,
} from '@teamos/contracts';
import { WorkItemsList } from './work-items-list';
import { DependencyGraph } from './dependency-graph';
import { RiskOverviewPanel } from './risk-overview-panel';
import { ProposalsPanel } from './proposals-panel';
import { ReportsPanel } from './reports-panel';
import {
  CalendarIcon,
  ClockIcon,
  LinkIcon,
  PlusIcon,
  CheckIcon,
  FolderIcon,
  GitBranchIcon,
  ActivityIcon,
  SparklesIcon,
  FileTextIcon,
  LayersIcon,
} from './ui/icons';
import { Button } from './ui';

export type ProjectTab =
  | 'work-items'
  | 'overview'
  | 'dependencies'
  | 'risk'
  | 'proposals'
  | 'reports';

interface ProjectWorkspaceProps {
  orgId: string;
  project: ProjectDto;
  tasks: TaskDto[];
  members: OrgMemberDto[];
  currentUserRole?: OrgRole;
  apiBaseUrl: string;
  onSelectTask: (task: TaskDto) => void;
  onOpenCreateTask: (initialStatus?: TaskStatus) => void;
  onQuickStatusChange: (taskId: string, newStatus: TaskStatus, version: number) => void;
  onRefreshProject: () => void;
  initialTab?: ProjectTab;
}

export function ProjectWorkspace({
  orgId,
  project,
  tasks,
  members,
  currentUserRole = 'MEMBER',
  apiBaseUrl,
  onSelectTask,
  onOpenCreateTask,
  onQuickStatusChange,
  onRefreshProject,
  initialTab = 'work-items',
}: ProjectWorkspaceProps) {
  const [activeTab, setActiveTab] = useState<ProjectTab>(initialTab);
  const [copiedLink, setCopiedLink] = useState(false);
  const [dependencies, setDependencies] = useState<DependencyDto[]>([]);
  const [criticalPathTaskIds, setCriticalPathTaskIds] = useState<string[]>([]);
  const [loadingDependencies, setLoadingDependencies] = useState(false);

  // Sync initial tab if changed from outside
  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  // Load project dependencies & risk metadata
  useEffect(() => {
    async function loadMetadata() {
      setLoadingDependencies(true);
      try {
        // 1. Fetch dependencies
        const depRes = await fetch(
          `${apiBaseUrl}/api/v1/orgs/${orgId}/projects/${project.id}/dependencies`,
          { credentials: 'include' },
        );
        if (depRes.ok) {
          const depData: DependencyDto[] = await depRes.json();
          setDependencies(depData);
        }

        // 2. Fetch risk critical path
        const riskRes = await fetch(
          `${apiBaseUrl}/api/v1/orgs/${orgId}/projects/${project.id}/risk`,
          { credentials: 'include' },
        );
        if (riskRes.ok) {
          const riskData = await riskRes.json();
          if (riskData.criticalPathTaskIds) {
            setCriticalPathTaskIds(riskData.criticalPathTaskIds);
          }
        }
      } catch (err) {
        console.error('Failed to load project metadata', err);
      } finally {
        setLoadingDependencies(false);
      }
    }

    loadMetadata();
  }, [orgId, project.id, apiBaseUrl]);

  function handleCopyLink() {
    if (typeof window !== 'undefined') {
      navigator.clipboard.writeText(window.location.href);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  }

  const completedCount = tasks.filter((t) => t.status === 'DONE').length;
  const inProgressCount = tasks.filter((t) => t.status === 'IN_PROGRESS').length;
  const todoCount = tasks.filter((t) => t.status === 'TODO').length;
  const progressPercent = tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* 1. Project Header (Plane style) */}
      <div className="bg-white rounded-xl border border-slate-200/90 p-4 sm:p-5 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          {/* Project Title & Identifier */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-600/10 border border-blue-200 text-blue-600 flex items-center justify-center font-bold text-sm shrink-0">
              <FolderIcon className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                  {project.name}
                </h1>
                <span className="font-mono text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200 px-2 py-0.5 rounded">
                  {project.key}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 pt-0.5">
                {project.startDate && (
                  <span className="flex items-center gap-1">
                    <CalendarIcon className="w-3.5 h-3.5 text-slate-400" />
                    <span>Start: <strong className="font-mono text-slate-700">{project.startDate}</strong></span>
                  </span>
                )}
                {project.dueDate && (
                  <span className="flex items-center gap-1">
                    <ClockIcon className="w-3.5 h-3.5 text-slate-400" />
                    <span>Target Due: <strong className="font-mono text-slate-700">{project.dueDate}</strong></span>
                  </span>
                )}
                <span className="text-slate-400">Timezone: {project.timezone}</span>
              </div>
            </div>
          </div>

          {/* Actions: Copy Link & Add Task */}
          <div className="flex items-center gap-2 self-stretch sm:self-auto justify-end">
            <button
              type="button"
              onClick={handleCopyLink}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-600 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors"
              title="Copy project link"
            >
              {copiedLink ? (
                <>
                  <CheckIcon className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-700">Copied!</span>
                </>
              ) : (
                <>
                  <LinkIcon className="w-3.5 h-3.5 text-slate-400" />
                  <span>Copy Link</span>
                </>
              )}
            </button>

            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={() => onOpenCreateTask()}
              leftIcon={<PlusIcon className="w-3.5 h-3.5" />}
            >
              Add work item
            </Button>
          </div>
        </div>

        {/* Project Navigation Tabs */}
        <div className="flex items-center gap-1 sm:gap-2 border-t border-slate-100 pt-3 text-xs font-semibold overflow-x-auto scrollbar-none">
          <button
            type="button"
            onClick={() => setActiveTab('work-items')}
            className={`pb-2 px-3 border-b-2 transition-all whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'work-items'
                ? 'border-blue-600 text-blue-600 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <FolderIcon className="w-3.5 h-3.5" />
            <span>Work items</span>
            <span className="font-mono text-[10px] text-slate-400">({tasks.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            className={`pb-2 px-3 border-b-2 transition-all whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'overview'
                ? 'border-blue-600 text-blue-600 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <LayersIcon className="w-3.5 h-3.5" />
            <span>Overview</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('dependencies')}
            className={`pb-2 px-3 border-b-2 transition-all whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'dependencies'
                ? 'border-blue-600 text-blue-600 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <GitBranchIcon className="w-3.5 h-3.5" />
            <span>Dependencies</span>
            <span className="font-mono text-[10px] text-slate-400">({dependencies.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('risk')}
            className={`pb-2 px-3 border-b-2 transition-all whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'risk'
                ? 'border-blue-600 text-blue-600 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <ActivityIcon className="w-3.5 h-3.5" />
            <span>Delivery Risk</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('proposals')}
            className={`pb-2 px-3 border-b-2 transition-all whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'proposals'
                ? 'border-blue-600 text-blue-600 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <SparklesIcon className="w-3.5 h-3.5" />
            <span>Proposals & Plans</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('reports')}
            className={`pb-2 px-3 border-b-2 transition-all whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'reports'
                ? 'border-blue-600 text-blue-600 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <FileTextIcon className="w-3.5 h-3.5" />
            <span>Health Reports</span>
          </button>
        </div>
      </div>

      {/* 2. Tab Views */}
      {activeTab === 'work-items' && (
        <WorkItemsList
          tasks={tasks}
          projectKey={project.key}
          members={members}
          criticalPathTaskIds={criticalPathTaskIds}
          dependencies={dependencies.map((d) => ({
            blockerTaskId: d.blockerTaskId,
            blockedTaskId: d.blockedTaskId || (d as any).dependentTaskId,
          }))}
          onSelectTask={onSelectTask}
          onOpenCreateTask={onOpenCreateTask}
          onQuickStatusChange={onQuickStatusChange}
        />
      )}

      {activeTab === 'overview' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-xs space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Work Items</span>
              <div className="text-2xl font-bold font-mono text-slate-900">{tasks.length}</div>
              <div className="text-[11px] text-slate-500">Across all workflow states</div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-xs space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">In Progress</span>
              <div className="text-2xl font-bold font-mono text-amber-600">{inProgressCount}</div>
              <div className="text-[11px] text-slate-500">Active engineering efforts</div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-xs space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Completed</span>
              <div className="text-2xl font-bold font-mono text-emerald-600">{completedCount}</div>
              <div className="text-[11px] text-slate-500">{progressPercent}% completion rate</div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-xs space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Critical Path</span>
              <div className="text-2xl font-bold font-mono text-rose-600">{criticalPathTaskIds.length}</div>
              <div className="text-[11px] text-slate-500">Zero-slack delivery bottlenecks</div>
            </div>
          </div>

          {/* Quick status progress bar */}
          <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-xs space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
              <span>Overall Delivery Progress</span>
              <span className="font-mono">{progressPercent}%</span>
            </div>
            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden flex">
              <div
                style={{ width: `${progressPercent}%` }}
                className="bg-emerald-500 h-full transition-all duration-300"
              />
              <div
                style={{
                  width: `${
                    tasks.length > 0 ? (inProgressCount / tasks.length) * 100 : 0
                  }%`,
                }}
                className="bg-amber-400 h-full transition-all duration-300"
              />
            </div>
            <div className="flex items-center gap-4 text-[10px] text-slate-400 pt-1">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span>Done ({completedCount})</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                <span>In Progress ({inProgressCount})</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-slate-300" />
                <span>To Do ({todoCount})</span>
              </span>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'dependencies' && (
        <DependencyGraph
          orgId={orgId}
          projectId={project.id}
          projectKey={project.key}
          apiBaseUrl={apiBaseUrl}
          onSelectTask={(taskId) => {
            const t = tasks.find((item) => item.id === taskId);
            if (t) onSelectTask(t);
          }}
        />
      )}

      {activeTab === 'risk' && (
        <RiskOverviewPanel
          orgId={orgId}
          projectId={project.id}
          projectKey={project.key}
          tasks={tasks}
          apiBaseUrl={apiBaseUrl}
        />
      )}

      {activeTab === 'proposals' && (
        <ProposalsPanel
          orgId={orgId}
          projectId={project.id}
          projectKey={project.key}
          tasks={tasks}
          currentUserRole={currentUserRole}
          apiBaseUrl={apiBaseUrl}
          onProposalApplied={onRefreshProject}
        />
      )}

      {activeTab === 'reports' && (
        <ReportsPanel
          orgId={orgId}
          projectId={project.id}
          apiBaseUrl={apiBaseUrl}
        />
      )}
    </div>
  );
}
