'use client';

import React, { useState } from 'react';
import type { AuthMeResponseDto, OrgDto } from '@teamos/contracts';
import {
  SearchIcon,
  SidebarIcon,
  SparklesIcon,
  HelpCircleIcon,
  ChevronDownIcon,
  ShieldIcon,
  CommandIcon,
  SunIcon,
  MoonIcon,
} from './ui/icons';
import { Badge } from './ui';

interface TopHeaderProps {
  sessionData: AuthMeResponseDto;
  activeOrg: OrgDto | null;
  projectName?: string;
  sectionTitle?: string;
  theme?: 'light' | 'dark';
  onToggleTheme?: () => void;
  onOpenOnboarding?: () => void;
  onOpenGuidedTour?: () => void;
  onOpenSearch: () => void;
  onOpenAiPlanner: () => void;
  onToggleSidebar: () => void;
  isSidebarCollapsed: boolean;
  onLogout: () => void;
}

export function TopHeader({
  sessionData,
  activeOrg,
  projectName,
  sectionTitle,
  theme = 'light',
  onToggleTheme,
  onOpenOnboarding,
  onOpenGuidedTour,
  onOpenSearch,
  onOpenAiPlanner,
  onToggleSidebar,
  isSidebarCollapsed,
  onLogout,
}: TopHeaderProps) {
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);

  const user = sessionData.user;
  const userInitials = (user.displayName || user.login || 'U')
    .slice(0, 2)
    .toUpperCase();

  return (
    <header className="h-12 border-b border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 sm:px-4 flex items-center justify-between gap-3 shrink-0 z-20 transition-colors">
      {/* 1. Left: Sidebar Toggle & Context Breadcrumb */}
      <div className="flex items-center gap-2.5 min-w-0">
        {isSidebarCollapsed && (
          <button
            type="button"
            onClick={onToggleSidebar}
            className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Expand sidebar"
            aria-label="Expand sidebar"
          >
            <SidebarIcon className="w-4 h-4" />
          </button>
        )}

        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 truncate">
          <span className="font-semibold text-slate-700 dark:text-slate-300 truncate">
            {activeOrg?.name || 'Workspace'}
          </span>
          <span className="text-slate-300 dark:text-slate-600">/</span>
          <span className="font-bold text-slate-900 dark:text-slate-100 truncate">
            {projectName || sectionTitle || 'Work Items'}
          </span>
        </div>
      </div>

      {/* 2. Center: Global Search Bar (Plane-style with ⌘K badge) */}
      <div className="flex-1 max-w-md mx-2 hidden sm:block">
        <button
          type="button"
          onClick={onOpenSearch}
          className="w-full flex items-center justify-between px-3 py-1.5 bg-slate-50 dark:bg-slate-800/70 hover:bg-slate-100/80 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700/80 rounded-lg text-xs text-slate-400 dark:text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-all shadow-xs group"
        >
          <div className="flex items-center gap-2">
            <SearchIcon className="w-3.5 h-3.5 text-slate-400 dark:text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-200" />
            <span className="truncate">Search {activeOrg?.name || 'TeamOS'}...</span>
          </div>
          <kbd className="hidden md:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-mono text-slate-400 dark:text-slate-400 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded shadow-xs">
            <span>⌘</span>
            <span>K</span>
          </kbd>
        </button>
      </div>

      {/* 3. Right: Utility actions & User Profile */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        {/* Mobile Search Button */}
        <button
          type="button"
          onClick={onOpenSearch}
          className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors sm:hidden"
          title="Search"
          aria-label="Search"
        >
          <SearchIcon className="w-4 h-4" />
        </button>

        {/* Guided Tour / Onboarding Launcher */}
        {onOpenOnboarding && (
          <button
            type="button"
            onClick={onOpenOnboarding}
            className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Getting Started Guide"
            aria-label="Getting Started Guide"
          >
            <HelpCircleIcon className="w-4 h-4" />
          </button>
        )}

        {/* Theme Switcher Toggle */}
        {onToggleTheme && (
          <button
            type="button"
            onClick={onToggleTheme}
            className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            aria-label={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {theme === 'dark' ? (
              <SunIcon className="w-4 h-4 text-amber-400" />
            ) : (
              <MoonIcon className="w-4 h-4 text-slate-600" />
            )}
          </button>
        )}

        {/* AI Assistant Quick Launcher */}
        <button
          type="button"
          onClick={onOpenAiPlanner}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/40 hover:bg-purple-100 dark:hover:bg-purple-900/50 border border-purple-200/80 dark:border-purple-800/80 rounded-lg transition-colors shadow-xs"
        >
          <SparklesIcon className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
          <span className="hidden md:inline">AI Assistant</span>
        </button>

        {/* Database Security Status Indicator */}
        <div
          className="hidden lg:flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-800/80 rounded-md"
          title="All tenant queries enforced via PostgreSQL Row-Level Security"
        >
          <ShieldIcon className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
          <span>RLS Active</span>
        </div>

        {/* User Profile Avatar & Menu */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
            className="flex items-center gap-1.5 p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            aria-expanded={profileDropdownOpen}
            aria-haspopup="menu"
          >
            <div className="w-7 h-7 rounded-full bg-slate-800 dark:bg-slate-700 text-white flex items-center justify-center font-bold text-xs ring-1 ring-slate-300 dark:ring-slate-600">
              {userInitials}
            </div>
            <ChevronDownIcon className="w-3 h-3 text-slate-400 hidden sm:block" />
          </button>

          {profileDropdownOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setProfileDropdownOpen(false)}
              />
              <div className="absolute right-0 top-full mt-1.5 w-60 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-dropdown z-50 p-2 space-y-2">
                <div className="px-2 py-1.5 border-b border-slate-100 dark:border-slate-800">
                  <div className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                    {user.displayName || user.login}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate font-mono">
                    @{user.login}
                  </div>
                  {activeOrg && (
                    <div className="pt-1.5 flex items-center gap-1.5">
                      <Badge variant="purple" size="xs">
                        {activeOrg.role}
                      </Badge>
                      <span className="text-[10px] text-slate-400 truncate">
                        {activeOrg.name}
                      </span>
                    </div>
                  )}
                </div>

                <div className="px-2 py-1 text-[11px] text-slate-500 dark:text-slate-400">
                  User ID: <span className="font-mono">{user.id.slice(0, 8)}…</span>
                </div>

                {/* Theme toggle option inside menu too */}
                {onToggleTheme && (
                  <button
                    type="button"
                    onClick={() => {
                      onToggleTheme();
                      setProfileDropdownOpen(false);
                    }}
                    className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <span>Theme: {theme === 'dark' ? 'Dark' : 'Light'}</span>
                    {theme === 'dark' ? <MoonIcon className="w-3.5 h-3.5 text-sky-400" /> : <SunIcon className="w-3.5 h-3.5 text-amber-500" />}
                  </button>
                )}

                {onOpenGuidedTour && (
                  <button
                    type="button"
                    onClick={() => {
                      setProfileDropdownOpen(false);
                      onOpenGuidedTour();
                    }}
                    className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <span>Guided Spotlight Tour</span>
                    <HelpCircleIcon className="w-3.5 h-3.5 text-blue-500" />
                  </button>
                )}

                <div className="pt-1 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => {
                      setProfileDropdownOpen(false);
                      onLogout();
                    }}
                    className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                  >
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

