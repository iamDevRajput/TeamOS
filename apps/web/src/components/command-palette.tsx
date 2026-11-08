'use client';

import React, { useState, useEffect, useRef } from 'react';
import type { TaskDto, ProjectDto } from '@teamos/contracts';
import {
  SearchIcon,
  XIcon,
  FolderIcon,
  CheckSquareIcon,
  ActivityIcon,
  SparklesIcon,
  FileTextIcon,
  ClockIcon,
  UsersIcon,
  ArrowRightIcon,
} from './ui/icons';
import type { NavigationSection } from './navigation-rail';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  tasks: TaskDto[];
  projects: ProjectDto[];
  onSelectTask: (task: TaskDto) => void;
  onSelectProject: (projectId: string) => void;
  onNavigate: (section: NavigationSection) => void;
}

export function CommandPalette({
  isOpen,
  onClose,
  tasks,
  projects,
  onSelectTask,
  onSelectProject,
  onNavigate,
}: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery('');
    }
  }, [isOpen]);

  // Global Escape Key Listener
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const normalizedQuery = query.toLowerCase().trim();

  const filteredTasks = tasks
    .filter(
      (t) =>
        t.title.toLowerCase().includes(normalizedQuery) ||
        String(t.number).includes(normalizedQuery) ||
        (t.assigneeName && t.assigneeName.toLowerCase().includes(normalizedQuery)),
    )
    .slice(0, 6);

  const filteredProjects = projects
    .filter(
      (p) =>
        p.name.toLowerCase().includes(normalizedQuery) ||
        p.key.toLowerCase().includes(normalizedQuery),
    )
    .slice(0, 4);

  const navigationOptions: {
    section: NavigationSection;
    title: string;
    description: string;
    icon: React.ReactNode;
  }[] = [
    {
      section: 'projects',
      title: 'Projects & Work Items',
      description: 'Manage tasks, views, and execution pipeline',
      icon: <FolderIcon className="w-4 h-4 text-blue-500" />,
    },
    {
      section: 'risk',
      title: 'Delivery Risk Intelligence',
      description: 'Critical Path Method, forecast dates, and What-If simulation',
      icon: <ActivityIcon className="w-4 h-4 text-amber-500" />,
    },
    {
      section: 'proposals',
      title: 'AI Planning & Proposals',
      description: 'Structured AI proposals with human sign-off',
      icon: <SparklesIcon className="w-4 h-4 text-purple-500" />,
    },
    {
      section: 'reports',
      title: 'Health Reports',
      description: 'Cryptographic SHA-256 verified evidence summaries',
      icon: <FileTextIcon className="w-4 h-4 text-emerald-500" />,
    },
    {
      section: 'audit',
      title: 'Audit Trail',
      description: 'Append-only event log with actor metadata and state diffs',
      icon: <ClockIcon className="w-4 h-4 text-slate-500" />,
    },
    {
      section: 'members',
      title: 'Team Members',
      description: 'Manage organization memberships and role-based access',
      icon: <UsersIcon className="w-4 h-4 text-indigo-500" />,
    },
  ];

  const filteredNav = navigationOptions.filter(
    (n) =>
      n.title.toLowerCase().includes(normalizedQuery) ||
      n.description.toLowerCase().includes(normalizedQuery),
  );

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 px-4 bg-black/60 dark:bg-black/80 backdrop-blur-sm animate-fadeIn">
      {/* Click outside to dismiss */}
      <div className="fixed inset-0" onClick={onClose} />

      <div className="relative w-full max-w-xl bg-white dark:bg-slate-900 rounded-2xl shadow-modal border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[80vh] z-10 transition-colors">
        {/* Search Input Bar */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/60">
          <SearchIcon className="w-4 h-4 text-slate-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command or search tasks, projects..."
            className="flex-1 bg-transparent text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <XIcon className="w-3.5 h-3.5" />
            </button>
          )}
          <kbd className="px-1.5 py-0.5 text-[10px] font-mono text-slate-400 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded shadow-xs">
            ESC
          </kbd>
        </div>

        {/* Results List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-3">
          {/* Work Items / Tasks */}
          {filteredTasks.length > 0 && (
            <div className="space-y-1">
              <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Work Items
              </div>
              {filteredTasks.map((task) => (
                <button
                  key={task.id}
                  type="button"
                  onClick={() => {
                    onSelectTask(task);
                    onClose();
                  }}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-left transition-colors group"
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <span className="font-mono text-xs font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                      #{task.number}
                    </span>
                    <span className="text-xs font-medium text-slate-900 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-sky-400 truncate">
                      {task.title}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 text-[10px]">
                    <span className="font-mono text-slate-400">{task.status}</span>
                    <ArrowRightIcon className="w-3 h-3 text-slate-300 dark:text-slate-600 group-hover:text-blue-500 dark:group-hover:text-sky-400" />
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Projects */}
          {filteredProjects.length > 0 && (
            <div className="space-y-1">
              <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Projects
              </div>
              {filteredProjects.map((project) => (
                <button
                  key={project.id}
                  type="button"
                  onClick={() => {
                    onSelectProject(project.id);
                    onNavigate('projects');
                    onClose();
                  }}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-left transition-colors group"
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <span className="font-mono text-xs font-bold bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 rounded border border-blue-200 dark:border-blue-800">
                      {project.key}
                    </span>
                    <span className="text-xs font-medium text-slate-900 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-sky-400 truncate">
                      {project.name}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {project.taskCount ?? 0} tasks
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Navigation Destinations */}
          {filteredNav.length > 0 && (
            <div className="space-y-1">
              <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Navigation
              </div>
              {filteredNav.map((nav) => (
                <button
                  key={nav.section}
                  type="button"
                  onClick={() => {
                    onNavigate(nav.section);
                    onClose();
                  }}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-left transition-colors group"
                >
                  <div className="flex items-center gap-2.5">
                    {nav.icon}
                    <div>
                      <div className="text-xs font-medium text-slate-900 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-sky-400">
                        {nav.title}
                      </div>
                      <div className="text-[10px] text-slate-400 dark:text-slate-500">
                        {nav.description}
                      </div>
                    </div>
                  </div>
                  <ArrowRightIcon className="w-3 h-3 text-slate-300 dark:text-slate-600 group-hover:text-blue-500 dark:group-hover:text-sky-400" />
                </button>
              ))}
            </div>
          )}

          {filteredTasks.length === 0 &&
            filteredProjects.length === 0 &&
            filteredNav.length === 0 && (
              <div className="py-8 text-center text-xs text-slate-400">
                No matching results for &ldquo;{query}&rdquo;
              </div>
            )}
        </div>

        {/* Footer shortcuts helper */}
        <div className="px-4 py-2 border-t border-slate-200 bg-slate-50/70 text-[10px] text-slate-400 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span>Navigation: <kbd className="font-mono bg-white px-1 border border-slate-200 rounded">Tab</kbd></span>
            <span>Select: <kbd className="font-mono bg-white px-1 border border-slate-200 rounded">Enter</kbd></span>
          </div>
          <span>TeamOS Delivery Risk Intelligence</span>
        </div>
      </div>
    </div>
  );
}

