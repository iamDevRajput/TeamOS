'use client';

import React from 'react';
import type { TaskDto, ProjectDto, OrgMemberDto } from '@teamos/contracts';
import {
  CheckCircleIcon,
  PlusIcon,
  ActivityIcon,
  SparklesIcon,
  FileTextIcon,
  GitBranchIcon,
  UsersIcon,
  ArrowRightIcon,
  ShieldIcon,
} from './ui/icons';
import { Badge, Button } from './ui';

interface GetStartedChecklistProps {
  projects: ProjectDto[];
  tasks: TaskDto[];
  dependencyCount: number;
  proposalCount: number;
  reportCount: number;
  members: OrgMemberDto[];
  onOpenCreateProject: () => void;
  onOpenCreateTask: () => void;
  onSelectTab: (tab: 'work-items' | 'overview' | 'dependencies' | 'risk' | 'proposals' | 'reports') => void;
  onOpenInviteModal?: () => void;
}

export function GetStartedChecklist({
  projects,
  tasks,
  dependencyCount,
  proposalCount,
  reportCount,
  members,
  onOpenCreateProject,
  onOpenCreateTask,
  onSelectTab,
  onOpenInviteModal,
}: GetStartedChecklistProps) {
  const hasProject = projects.length > 0;
  const hasTasks = tasks.length > 0;
  const hasDependencies = dependencyCount > 0;
  const hasProposal = proposalCount > 0;
  const hasReport = reportCount > 0;
  const hasMultipleMembers = members.length > 1;

  const checklist = [
    {
      id: 'project',
      title: 'Create a project',
      description: 'Define your project scope, target delivery date, and timezone for schedule calculations.',
      completed: hasProject,
      actionLabel: 'Create project',
      action: onOpenCreateProject,
      icon: <PlusIcon className="w-4 h-4 text-blue-500" />,
    },
    {
      id: 'task',
      title: 'Create a work item',
      description: 'Add tasks with duration estimates (workdays) to establish the effort baseline.',
      completed: hasTasks,
      actionLabel: 'Add task',
      action: onOpenCreateTask,
      icon: <PlusIcon className="w-4 h-4 text-blue-500" />,
    },
    {
      id: 'dependency',
      title: 'Link finish-to-start dependencies',
      description: 'Model blocker constraints between tasks. The risk engine strictly prevents cycles (DAG).',
      completed: hasDependencies,
      actionLabel: 'View DAG',
      action: () => onSelectTab('dependencies'),
      icon: <GitBranchIcon className="w-4 h-4 text-amber-500" />,
    },
    {
      id: 'risk',
      title: 'Inspect Critical Path Method (CPM) delivery risk',
      description: 'View deterministic delivery date forecast, zero-slack bottlenecks, and What-If simulations.',
      completed: hasTasks && hasDependencies,
      actionLabel: 'Check Risk',
      action: () => onSelectTab('risk'),
      icon: <ActivityIcon className="w-4 h-4 text-emerald-500" />,
    },
    {
      id: 'ai-plan',
      title: 'Try AI plan generator',
      description: 'Generate structured task proposals with Gemini. Changes require human review before applying.',
      completed: hasProposal,
      actionLabel: 'Generate plan',
      action: () => onSelectTab('proposals'),
      icon: <SparklesIcon className="w-4 h-4 text-purple-500" />,
    },
    {
      id: 'report',
      title: 'Compile evidence-backed health report',
      description: 'Generate immutable health snapshots with SHA-256 integrity seals citing verified task entities.',
      completed: hasReport,
      actionLabel: 'Generate report',
      action: () => onSelectTab('reports'),
      icon: <FileTextIcon className="w-4 h-4 text-blue-500" />,
    },
    {
      id: 'members',
      title: 'Invite team members',
      description: 'Onboard teammates to your multi-tenant workspace with role-based access control (RBAC).',
      completed: hasMultipleMembers,
      actionLabel: 'Invite teammate',
      action: onOpenInviteModal || (() => {}),
      icon: <UsersIcon className="w-4 h-4 text-indigo-500" />,
    },
  ];

  const completedCount = checklist.filter((item) => item.completed).length;
  const progressPercent = Math.round((completedCount / checklist.length) * 100);

  return (
    <div className="space-y-6 max-w-4xl mx-auto py-2">
      {/* Top Value Banner (Matching Plane Trial Banner) */}
      <div className="bg-gradient-to-r from-blue-900/40 via-slate-900 to-purple-900/40 border border-blue-800/60 dark:border-blue-900/60 rounded-2xl p-5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <h3 className="text-sm font-bold text-slate-100 tracking-tight">
              Delivery Risk Intelligence is Active
            </h3>
            <Badge variant="purple" size="xs">
              CPM Engine Ready
            </Badge>
          </div>
          <p className="text-xs text-slate-400 max-w-xl">
            TeamOS connects task dependencies and GitHub activity to give your team deterministic delivery forecasts with zero AI hallucination.
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={onOpenCreateTask}
            leftIcon={<PlusIcon className="w-3.5 h-3.5" />}
            className="flex-1 sm:flex-initial"
          >
            New Work Item
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => onSelectTab('risk')}
            className="flex-1 sm:flex-initial"
          >
            Forecast Date
          </Button>
        </div>
      </div>

      {/* Main Get Started Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-6 shadow-xs space-y-6">
        <div>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-2">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 tracking-tight">
                Get started with TeamOS
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Begin your setup and see your delivery schedule forecast come to life.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold text-blue-600 dark:text-blue-400">
                {completedCount} of {checklist.length} completed
              </span>
            </div>
          </div>

          {/* Progress bar */}
          <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden mt-3">
            <div
              style={{ width: `${progressPercent}%` }}
              className="bg-blue-600 h-full transition-all duration-300"
            />
          </div>
        </div>

        {/* Checklist Rows */}
        <div className="space-y-2">
          {checklist.map((item) => (
            <div
              key={item.id}
              className={`p-3.5 rounded-xl border transition-all flex items-center justify-between gap-4 ${
                item.completed
                  ? 'bg-slate-50/70 dark:bg-slate-950/40 border-slate-200/80 dark:border-slate-800'
                  : 'bg-white dark:bg-slate-900 border-slate-200/90 dark:border-slate-800/90 hover:border-blue-500/50 hover:shadow-xs'
              }`}
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <div
                  className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 transition-colors ${
                    item.completed
                      ? 'bg-emerald-500 text-white'
                      : 'border-2 border-slate-300 dark:border-slate-700 bg-transparent'
                  }`}
                >
                  {item.completed && <CheckCircleIcon className="w-3.5 h-3.5" />}
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs font-bold truncate ${
                        item.completed
                          ? 'text-slate-500 dark:text-slate-400 line-through'
                          : 'text-slate-900 dark:text-slate-100'
                      }`}
                    >
                      {item.title}
                    </span>
                    {item.completed && (
                      <Badge variant="success" size="xs">
                        Done
                      </Badge>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5">
                    {item.description}
                  </p>
                </div>
              </div>

              {!item.completed && (
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  onClick={item.action}
                  className="shrink-0"
                >
                  <span>{item.actionLabel}</span>
                  <ArrowRightIcon className="w-3 h-3 ml-1 text-slate-400" />
                </Button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
