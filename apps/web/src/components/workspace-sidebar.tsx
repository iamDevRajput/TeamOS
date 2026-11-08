'use client';

import React, { useState } from 'react';
import type { OrgDto, ProjectDto, OrgRole } from '@teamos/contracts';
import {
  ChevronDownIcon,
  ChevronRightIcon,
  PlusIcon,
  HomeIcon,
  CheckSquareIcon,
  FolderIcon,
  ActivityIcon,
  SparklesIcon,
  FileTextIcon,
  SidebarIcon,
  BuildingIcon,
  CheckIcon,
} from './ui/icons';
import { Badge } from './ui';
import type { NavigationSection } from './navigation-rail';

interface WorkspaceSidebarProps {
  orgs: OrgDto[];
  activeOrg: OrgDto | null;
  onSelectOrg: (org: OrgDto) => void;
  onOpenCreateOrg: () => void;
  projects: ProjectDto[];
  selectedProjectId: string | null;
  onSelectProject: (projectId: string) => void;
  onOpenCreateProject: () => void;
  onOpenCreateTask: () => void;
  activeSection: NavigationSection;
  onSelectSection: (section: NavigationSection) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  userAssignedTaskCount?: number;
}

export function WorkspaceSidebar({
  orgs,
  activeOrg,
  onSelectOrg,
  onOpenCreateOrg,
  projects,
  selectedProjectId,
  onSelectProject,
  onOpenCreateProject,
  onOpenCreateTask,
  activeSection,
  onSelectSection,
  isCollapsed,
  onToggleCollapse,
  userAssignedTaskCount = 0,
}: WorkspaceSidebarProps) {
  const [orgDropdownOpen, setOrgDropdownOpen] = useState(false);
  const [workspaceSectionOpen, setWorkspaceSectionOpen] = useState(true);
  const [projectsSectionOpen, setProjectsSectionOpen] = useState(true);

  if (isCollapsed) {
    return null;
  }

  const role = (activeOrg?.role as OrgRole) || 'MEMBER';

  return (
    <aside
      className="w-60 shrink-0 bg-slate-50/95 border-r border-slate-200/90 flex flex-col h-full select-none z-20 transition-all duration-200 ease-in-out"
      aria-label="Workspace sidebar"
    >
      {/* 1. Workspace / Organization Switcher Header */}
      <div className="relative p-3 border-b border-slate-200/80">
        <div className="flex items-center justify-between gap-1">
          <button
            type="button"
            onClick={() => setOrgDropdownOpen(!orgDropdownOpen)}
            className="flex-1 flex items-center justify-between gap-2 p-1.5 rounded-lg hover:bg-slate-200/70 transition-colors text-left"
            aria-expanded={orgDropdownOpen}
            aria-haspopup="listbox"
          >
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-6 h-6 rounded bg-slate-900 text-white flex items-center justify-center font-bold text-[10px] shrink-0">
                {activeOrg ? activeOrg.name.slice(0, 2).toUpperCase() : 'OS'}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-bold text-slate-900 truncate">
                  {activeOrg?.name || 'Select Workspace'}
                </div>
                <div className="text-[10px] text-slate-500 font-mono flex items-center gap-1">
                  <span>{role}</span>
                </div>
              </div>
            </div>
            <ChevronDownIcon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          </button>

          {/* Sidebar Collapse Toggle */}
          <button
            type="button"
            onClick={onToggleCollapse}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/70 transition-colors"
            title="Collapse sidebar"
            aria-label="Collapse sidebar"
          >
            <SidebarIcon className="w-4 h-4" />
          </button>
        </div>

        {/* Workspace Switcher Popover */}
        {orgDropdownOpen && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setOrgDropdownOpen(false)}
            />
            <div className="absolute left-3 right-3 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-dropdown z-50 py-1.5 space-y-0.5">
              <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Workspaces ({orgs.length})
              </div>
              <div className="max-h-48 overflow-y-auto">
                {orgs.map((org) => {
                  const isCurrent = activeOrg?.id === org.id;
                  return (
                    <button
                      key={org.id}
                      type="button"
                      onClick={() => {
                        onSelectOrg(org);
                        setOrgDropdownOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-1.5 text-xs text-left transition-colors ${
                        isCurrent
                          ? 'bg-blue-50 text-blue-700 font-bold'
                          : 'text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span className="w-5 h-5 rounded bg-slate-100 border border-slate-200 flex items-center justify-center text-[10px] font-mono text-slate-600 shrink-0">
                          {org.name.slice(0, 1).toUpperCase()}
                        </span>
                        <span className="truncate">{org.name}</span>
                      </div>
                      {isCurrent && <CheckIcon className="w-3.5 h-3.5 text-blue-600 shrink-0" />}
                    </button>
                  );
                })}
              </div>
              <div className="pt-1 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setOrgDropdownOpen(false);
                    onOpenCreateOrg();
                  }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-blue-600 hover:bg-blue-50 font-semibold transition-colors"
                >
                  <PlusIcon className="w-3.5 h-3.5" />
                  <span>Create Workspace</span>
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* 2. New Work Item Quick Action (Plane-style button) */}
      <div className="p-3 pb-2">
        <button
          type="button"
          onClick={onOpenCreateTask}
          className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-white hover:bg-slate-100 border border-slate-200/90 hover:border-slate-300 rounded-lg text-xs font-semibold text-slate-800 shadow-xs transition-all active:scale-[0.99]"
        >
          <PlusIcon className="w-3.5 h-3.5 text-blue-600" />
          <span>New work item</span>
        </button>
      </div>

      {/* 3. Core Sidebar Navigation */}
      <div className="flex-1 overflow-y-auto px-2 py-1 space-y-4">
        {/* Top Shortcuts */}
        <div className="space-y-0.5">
          <button
            type="button"
            onClick={() => onSelectSection('home')}
            className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              activeSection === 'home'
                ? 'bg-slate-200/80 text-blue-600 font-bold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
            }`}
          >
            <HomeIcon className="w-4 h-4 text-slate-500" />
            <span>Home</span>
          </button>

          <button
            type="button"
            onClick={() => onSelectSection('your-work')}
            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              activeSection === 'your-work'
                ? 'bg-slate-200/80 text-blue-600 font-bold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <CheckSquareIcon className="w-4 h-4 text-slate-500" />
              <span>Your work</span>
            </div>
            {userAssignedTaskCount > 0 && (
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-slate-200 text-slate-700">
                {userAssignedTaskCount}
              </span>
            )}
          </button>
        </div>

        {/* Workspace Intelligence Section */}
        <div className="space-y-0.5">
          <button
            type="button"
            onClick={() => setWorkspaceSectionOpen(!workspaceSectionOpen)}
            className="w-full flex items-center justify-between px-2.5 py-1 text-[11px] font-bold text-slate-400 hover:text-slate-600 tracking-wider uppercase"
          >
            <span>Workspace</span>
            {workspaceSectionOpen ? (
              <ChevronDownIcon className="w-3 h-3" />
            ) : (
              <ChevronRightIcon className="w-3 h-3" />
            )}
          </button>

          {workspaceSectionOpen && (
            <div className="space-y-0.5 pt-0.5">
              <button
                type="button"
                onClick={() => onSelectSection('projects')}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  activeSection === 'projects'
                    ? 'bg-slate-200/80 text-blue-600 font-bold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <FolderIcon className="w-4 h-4 text-slate-500" />
                  <span>Projects</span>
                </div>
                <span className="text-[10px] font-mono text-slate-400">
                  {projects.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => onSelectSection('risk')}
                className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  activeSection === 'risk'
                    ? 'bg-slate-200/80 text-blue-600 font-bold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                }`}
              >
                <ActivityIcon className="w-4 h-4 text-blue-500" />
                <span>Delivery Risk</span>
              </button>

              <button
                type="button"
                onClick={() => onSelectSection('proposals')}
                className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  activeSection === 'proposals'
                    ? 'bg-slate-200/80 text-blue-600 font-bold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                }`}
              >
                <SparklesIcon className="w-4 h-4 text-purple-500" />
                <span>AI Planning</span>
              </button>

              <button
                type="button"
                onClick={() => onSelectSection('reports')}
                className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  activeSection === 'reports'
                    ? 'bg-slate-200/80 text-blue-600 font-bold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                }`}
              >
                <FileTextIcon className="w-4 h-4 text-emerald-500" />
                <span>Health Reports</span>
              </button>
            </div>
          )}
        </div>

        {/* Real Projects Section */}
        <div className="space-y-0.5">
          <div className="flex items-center justify-between px-2.5 py-1">
            <button
              type="button"
              onClick={() => setProjectsSectionOpen(!projectsSectionOpen)}
              className="flex items-center gap-1 text-[11px] font-bold text-slate-400 hover:text-slate-600 tracking-wider uppercase"
            >
              <span>Projects</span>
              {projectsSectionOpen ? (
                <ChevronDownIcon className="w-3 h-3" />
              ) : (
                <ChevronRightIcon className="w-3 h-3" />
              )}
            </button>
            <button
              type="button"
              onClick={onOpenCreateProject}
              className="p-1 rounded text-slate-400 hover:text-blue-600 hover:bg-slate-200/70 transition-colors"
              title="Add project"
              aria-label="Add project"
            >
              <PlusIcon className="w-3 h-3" />
            </button>
          </div>

          {projectsSectionOpen && (
            <div className="space-y-0.5 pt-0.5">
              {projects.length === 0 ? (
                <div className="px-3 py-2 text-[11px] text-slate-400 italic">
                  No projects yet
                </div>
              ) : (
                projects.map((project) => {
                  const isSelected =
                    activeSection === 'projects' &&
                    selectedProjectId === project.id;

                  return (
                    <button
                      key={project.id}
                      type="button"
                      onClick={() => {
                        onSelectProject(project.id);
                        onSelectSection('projects');
                      }}
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
                        isSelected
                          ? 'bg-blue-50 text-blue-700 font-bold border border-blue-200/80 shadow-xs'
                          : 'text-slate-700 hover:bg-slate-200/50 hover:text-slate-900'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span
                          className={`font-mono text-[10px] px-1.5 py-0.2 rounded font-bold ${
                            isSelected
                              ? 'bg-blue-600 text-white'
                              : 'bg-slate-200 text-slate-600'
                          }`}
                        >
                          {project.key}
                        </span>
                        <span className="truncate">{project.name}</span>
                      </div>
                      <span
                        className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${
                          isSelected
                            ? 'bg-blue-100 text-blue-700 font-bold'
                            : 'text-slate-400'
                        }`}
                      >
                        {project.taskCount ?? 0}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>

      {/* Footer Info / RLS Status */}
      <div className="p-3 border-t border-slate-200/80 bg-white/50 text-[10px] text-slate-400 flex items-center justify-between">
        <span>PostgreSQL RLS Active</span>
        <span className="w-2 h-2 rounded-full bg-emerald-500" title="Protected" />
      </div>
    </aside>
  );
}

