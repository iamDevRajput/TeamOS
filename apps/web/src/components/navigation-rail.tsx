'use client';

import React from 'react';
import {
  FolderIcon,
  CheckSquareIcon,
  ActivityIcon,
  SparklesIcon,
  FileTextIcon,
  ClockIcon,
  UsersIcon,
  SettingsIcon,
  HomeIcon,
} from './ui/icons';

export type NavigationSection =
  | 'projects'
  | 'home'
  | 'your-work'
  | 'risk'
  | 'proposals'
  | 'reports'
  | 'audit'
  | 'members'
  | 'settings';

interface NavigationRailProps {
  activeSection: NavigationSection;
  onSelectSection: (section: NavigationSection) => void;
  orgName?: string;
}

export function NavigationRail({
  activeSection,
  onSelectSection,
  orgName,
}: NavigationRailProps) {
  const topNavItems: {
    id: NavigationSection;
    label: string;
    icon: React.ReactNode;
  }[] = [
    {
      id: 'projects',
      label: 'Projects & Work Items',
      icon: <FolderIcon className="w-5 h-5" />,
    },
    {
      id: 'your-work',
      label: 'Your Work',
      icon: <CheckSquareIcon className="w-5 h-5" />,
    },
    {
      id: 'home',
      label: 'Workspace Home',
      icon: <HomeIcon className="w-5 h-5" />,
    },
    {
      id: 'risk',
      label: 'Delivery Risk Intelligence',
      icon: <ActivityIcon className="w-5 h-5" />,
    },
    {
      id: 'proposals',
      label: 'AI Planning & Proposals',
      icon: <SparklesIcon className="w-5 h-5" />,
    },
    {
      id: 'reports',
      label: 'Health Reports',
      icon: <FileTextIcon className="w-5 h-5" />,
    },
    {
      id: 'audit',
      label: 'Audit Trail',
      icon: <ClockIcon className="w-5 h-5" />,
    },
    {
      id: 'members',
      label: 'Team Members',
      icon: <UsersIcon className="w-5 h-5" />,
    },
  ];

  return (
    <aside
      className="w-14 shrink-0 bg-slate-900 border-r border-slate-800 flex flex-col items-center py-3 select-none z-30"
      aria-label="Global navigation rail"
    >
      {/* TeamOS Brand Glyph */}
      <div className="mb-4">
        <button
          type="button"
          onClick={() => onSelectSection('projects')}
          className="w-9 h-9 rounded-xl bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center font-black text-xs shadow-sm transition-all focus-visible:ring-2 focus-visible:ring-blue-400"
          title={`TeamOS · ${orgName || 'Workspace'}`}
          aria-label="TeamOS Home"
        >
          <span>OS</span>
        </button>
      </div>

      {/* Primary Rail Navigation */}
      <nav className="flex-1 flex flex-col items-center gap-1.5 w-full px-2">
        {topNavItems.map((item) => {
          const isActive = activeSection === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectSection(item.id)}
              className={`group relative w-10 h-10 rounded-lg flex items-center justify-center transition-all ${
                isActive
                  ? 'bg-blue-600/20 text-blue-400 font-bold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/80'
              }`}
              title={item.label}
              aria-label={item.label}
              aria-current={isActive ? 'page' : undefined}
            >
              {item.icon}

              {/* Active left indicator pill */}
              {isActive && (
                <span className="absolute left-0 w-1 h-5 bg-blue-500 rounded-r-full" />
              )}

              {/* Accessible Hover Tooltip */}
              <div className="absolute left-full ml-3 px-2 py-1 bg-slate-800 text-slate-100 text-[11px] font-medium rounded-md shadow-dropdown whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 border border-slate-700/80">
                {item.label}
              </div>
            </button>
          );
        })}
      </nav>

      {/* Bottom Rail Actions */}
      <div className="flex flex-col items-center gap-1.5 w-full px-2 pt-2 border-t border-slate-800/80">
        <button
          type="button"
          onClick={() => onSelectSection('settings')}
          className={`group relative w-10 h-10 rounded-lg flex items-center justify-center transition-all ${
            activeSection === 'settings'
              ? 'bg-blue-600/20 text-blue-400'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/80'
          }`}
          title="Organization Settings"
          aria-label="Organization Settings"
          aria-current={activeSection === 'settings' ? 'page' : undefined}
        >
          <SettingsIcon className="w-5 h-5" />
          <div className="absolute left-full ml-3 px-2 py-1 bg-slate-800 text-slate-100 text-[11px] font-medium rounded-md shadow-dropdown whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 border border-slate-700/80">
            Organization Settings
          </div>
        </button>
      </div>
    </aside>
  );
}

