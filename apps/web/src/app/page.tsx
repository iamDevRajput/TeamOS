'use client';

import React, { useEffect, useState, useMemo } from 'react';
import type {
  AuthMeResponseDto,
  OrgDto,
  OrgMemberDto,
  OrgRole,
  ProjectDto,
  TaskDto,
  TaskStatus,
} from '@teamos/contracts';

import { NavigationRail, type NavigationSection } from '../components/navigation-rail';
import { WorkspaceSidebar } from '../components/workspace-sidebar';
import { TopHeader } from '../components/top-header';
import { CommandPalette } from '../components/command-palette';
import { ProjectWorkspace, type ProjectTab } from '../components/project-workspace';
import { WorkItemsList } from '../components/work-items-list';
import { CreateOrgModal } from '../components/create-org-modal';
import { CreateProjectModal } from '../components/create-project-modal';
import { CreateTaskModal } from '../components/create-task-modal';
import { TaskDetailModal } from '../components/task-detail-modal';
import { InviteModal } from '../components/invite-modal';
import { TransferOwnershipModal } from '../components/transfer-ownership-modal';
import { AiPlanGeneratorModal } from '../components/ai-plan-generator-modal';
import { MembersTable } from '../components/members-table';
import { InvitationsPanel } from '../components/invitations-panel';
import { AuditTimeline } from '../components/audit-timeline';
import { RiskOverviewPanel } from '../components/risk-overview-panel';
import { ProposalsPanel } from '../components/proposals-panel';
import { ReportsPanel } from '../components/reports-panel';
import { OnboardingWizard } from '../components/onboarding-wizard';
import { GuidedTourTooltip } from '../components/guided-tour-tooltip';
import { Badge, Button, EmptyState, ToastProvider } from '../components/ui';
import {
  ShieldIcon,
  ActivityIcon,
  GitBranchIcon,
  UsersIcon,
  BuildingIcon,
  PlusIcon,
  CheckCircleIcon,
  LockIcon,
  FolderIcon,
  CheckSquareIcon,
  SparklesIcon,
} from '../components/ui/icons';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function HomePage() {
  // 1. Session State
  const [sessionData, setSessionData] = useState<AuthMeResponseDto | null>(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  // 2. Tenancy State
  const [orgs, setOrgs] = useState<OrgDto[]>([]);
  const [activeOrg, setActiveOrg] = useState<OrgDto | null>(null);
  const [members, setMembers] = useState<OrgMemberDto[]>([]);

  // 3. Projects & Tasks State
  const [projects, setProjects] = useState<ProjectDto[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [tasks, setTasks] = useState<TaskDto[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(false);

  // 4. Navigation & Layout State (Plane 3-panel shell)
  const [activeSection, setActiveSection] = useState<NavigationSection>('projects');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // 5. Modals State
  const [createOrgOpen, setCreateOrgOpen] = useState(false);
  const [createProjectOpen, setCreateProjectOpen] = useState(false);
  const [createTaskOpen, setCreateTaskOpen] = useState(false);
  const [taskInitialStatus, setTaskInitialStatus] = useState<TaskStatus | undefined>(undefined);
  const [selectedTask, setSelectedTask] = useState<TaskDto | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [aiPlannerOpen, setAiPlannerOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [guidedTourOpen, setGuidedTourOpen] = useState(false);

  // 6. Theme State (persisted with dark-first developer aesthetic)
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');

  useEffect(() => {
    try {
      const savedTheme = localStorage.getItem('teamos_theme') as 'light' | 'dark' | null;
      if (savedTheme === 'light' || savedTheme === 'dark') {
        setTheme(savedTheme);
        if (savedTheme === 'dark') {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
      } else {
        setTheme('dark');
        document.documentElement.classList.add('dark');
      }
    } catch {
      setTheme('dark');
      document.documentElement.classList.add('dark');
    }
  }, []);

  const handleToggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    try {
      localStorage.setItem('teamos_theme', nextTheme);
    } catch {
      // ignore
    }
    if (nextTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  const [refreshKey, setRefreshKey] = useState(0);

  // ==========================================
  // Data Fetching Lifecycles
  // ==========================================

  // Step 1: Check session
  useEffect(() => {
    async function checkAuth() {
      try {
        const res = await fetch(`${API_BASE_URL}/api/v1/auth/me`, {
          credentials: 'include',
        });
        if (res.ok) {
          const data: AuthMeResponseDto = await res.json();
          setSessionData(data);
        } else {
          setSessionData(null);
        }
      } catch (err: any) {
        setAuthError(err.message || 'Failed to check session');
      } finally {
        setLoadingSession(false);
      }
    }

    checkAuth();
  }, []);

  // Step 2: Fetch user organizations
  useEffect(() => {
    if (!sessionData) return;

    async function loadUserOrgs() {
      try {
        const res = await fetch(`${API_BASE_URL}/api/v1/orgs`, {
          credentials: 'include',
        });
        if (res.ok) {
          const data: OrgDto[] = await res.json();
          setOrgs(data);

          if (data.length > 0) {
            setActiveOrg((current) => {
              if (current && data.some((o) => o.id === current.id)) {
                return data.find((o) => o.id === current.id)!;
              }
              return data[0];
            });
          } else {
            setActiveOrg(null);
          }
        }
      } catch (err) {
        console.error('Failed to load user orgs:', err);
      }
    }

    loadUserOrgs();
  }, [sessionData, refreshKey]);

  // Step 3: Fetch active org members
  useEffect(() => {
    if (!sessionData || !activeOrg) {
      setMembers([]);
      return;
    }

    const orgId = activeOrg.id;

    async function loadOrgMembers() {
      try {
        const res = await fetch(`${API_BASE_URL}/api/v1/orgs/${orgId}/members`, {
          credentials: 'include',
        });
        if (res.ok) {
          const memberList: OrgMemberDto[] = await res.json();
          setMembers(memberList);
        }
      } catch (err) {
        console.error('Failed to load members:', err);
      }
    }

    loadOrgMembers();
  }, [sessionData, activeOrg?.id, refreshKey]);

  // Step 4: Fetch projects for active org
  useEffect(() => {
    if (!sessionData || !activeOrg) {
      setProjects([]);
      setSelectedProjectId(null);
      return;
    }

    const orgId = activeOrg.id;

    async function loadProjects() {
      try {
        const res = await fetch(`${API_BASE_URL}/api/v1/orgs/${orgId}/projects`, {
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
        }
      } catch (err) {
        console.error('Failed to load projects:', err);
      }
    }

    loadProjects();
  }, [sessionData, activeOrg?.id, refreshKey]);

  // Step 5: Fetch tasks for selected project
  useEffect(() => {
    if (!sessionData || !activeOrg || !selectedProjectId) {
      setTasks([]);
      return;
    }

    const orgId = activeOrg.id;

    async function loadTasks() {
      setLoadingTasks(true);
      try {
        const res = await fetch(
          `${API_BASE_URL}/api/v1/orgs/${orgId}/projects/${selectedProjectId}/tasks`,
          { credentials: 'include' },
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
  }, [sessionData, activeOrg?.id, selectedProjectId, refreshKey]);

  // ==========================================
  // Global Keyboard Shortcuts (Phase 9)
  // ==========================================
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // 1. Command + K or Ctrl + K -> Open Global Search / Command Palette
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCommandPaletteOpen((prev) => !prev);
        return;
      }

      // Check if user is typing inside an input, textarea, or contentEditable
      const target = e.target as HTMLElement | null;
      const isInput =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable);

      if (isInput) return;

      // 2. 'C' key -> Quick Create Work Item
      if (e.key === 'c' || e.key === 'C') {
        if (!createTaskOpen && selectedProjectId) {
          e.preventDefault();
          setTaskInitialStatus('TODO');
          setCreateTaskOpen(true);
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [createTaskOpen, selectedProjectId]);

  // Responsive: Auto-collapse sidebar on smaller screens (< 768px)
  useEffect(() => {
    function handleResize() {
      if (window.innerWidth < 768) {
        setIsSidebarCollapsed(true);
      }
    }
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Quick task status changer with optimistic UI
  async function handleQuickStatusChange(
    taskId: string,
    newStatus: TaskStatus,
    version: number,
  ) {
    if (!activeOrg || !selectedProjectId) return;

    // Optimistic local update
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId ? { ...t, status: newStatus, version: t.version + 1 } : t,
      ),
    );

    try {
      const res = await fetch(
        `${API_BASE_URL}/api/v1/orgs/${activeOrg.id}/projects/${selectedProjectId}/tasks/${taskId}`,
        {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            status: newStatus,
            expectedVersion: version,
          }),
        },
      );

      if (!res.ok) {
        // Rollback on error
        setRefreshKey((k) => k + 1);
      }
    } catch (err) {
      console.error('Quick status update failed', err);
      setRefreshKey((k) => k + 1);
    }
  }

  async function handleLogout() {
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      });
      if (res.ok) {
        setSessionData(null);
        setOrgs([]);
        setActiveOrg(null);
      }
    } catch (err: any) {
      alert(`Logout failed: ${err.message}`);
    }
  }

  // Selected project reference
  const selectedProject = useMemo(
    () => projects.find((p) => p.id === selectedProjectId) || null,
    [projects, selectedProjectId],
  );

  // Count tasks assigned to current user across active tasks
  const userAssignedTasks = useMemo(() => {
    if (!sessionData) return [];
    const userId = sessionData.user.id;
    const userLogin = sessionData.user.login?.toLowerCase();
    const userName = sessionData.user.displayName?.toLowerCase();

    return tasks.filter((t) => {
      if (t.assigneeId && t.assigneeId === userId) return true;
      if (t.assigneeName) {
        const name = t.assigneeName.toLowerCase();
        if (userLogin && name.includes(userLogin)) return true;
        if (userName && name.includes(userName)) return true;
      }
      return false;
    });
  }, [tasks, sessionData]);

  // ==========================================
  // Loading & Unauthenticated Screens
  // ==========================================

  if (loadingSession) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="text-center space-y-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent mx-auto" />
          <p className="text-xs text-slate-500 font-medium tracking-tight">Verifying session…</p>
        </div>
      </main>
    );
  }

  if (!sessionData) {
    return (
      <main className="min-h-screen bg-slate-50 flex flex-col justify-between">
        {/* Subtle top header bar */}
        <header className="border-b border-slate-200/80 bg-white/80 backdrop-blur-md px-6 py-4">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white font-bold text-sm shadow-xs border border-blue-700/30">
                <span>OS</span>
              </div>
              <span className="text-base font-bold tracking-tight text-slate-900">
                TeamOS
              </span>
            </div>
            <a
              href={`${API_BASE_URL}/api/v1/auth/github/login`}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 border border-slate-200/80 rounded-lg transition-colors"
            >
              Sign In
            </a>
          </div>
        </header>

        {/* Hero Section */}
        <div className="max-w-4xl mx-auto px-6 py-12 sm:py-20 text-center space-y-8 flex-1 flex flex-col justify-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 text-xs font-semibold tracking-wide text-blue-700 bg-blue-50 border border-blue-200/80 rounded-full mx-auto shadow-xs">
            <ActivityIcon className="w-3.5 h-3.5 text-blue-600" />
            <span>Delivery Risk Intelligence for Engineering Teams</span>
          </div>

          <div className="space-y-4 max-w-2xl mx-auto">
            <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-slate-900 leading-tight">
              Know whether you will hit your delivery date.
            </h1>
            <p className="text-base text-slate-600 leading-relaxed">
              TeamOS connects work items, dependency relationships, and GitHub activity into a deterministic schedule forecast with evidence-backed health reports.
            </p>
          </div>

          {/* Call to action */}
          <div className="pt-2 flex flex-col items-center justify-center gap-3">
            <a
              href={`${API_BASE_URL}/api/v1/auth/github/login`}
              className="inline-flex items-center gap-2.5 px-6 py-3 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-xl shadow-xs transition-all hover:shadow-md"
            >
              <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
              </svg>
              <span>Continue with GitHub</span>
            </a>
            <span className="text-[11px] text-slate-400">
              Zero passwords · Secure OAuth PKCE session
            </span>
            {authError && <p className="text-xs text-rose-500">{authError}</p>}
          </div>

          {/* 4 Architecture Pillars */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-8 text-left">
            <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-xs space-y-1.5">
              <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                <GitBranchIcon className="w-4 h-4" />
              </div>
              <h4 className="text-xs font-bold text-slate-900">Deterministic CPM DAG</h4>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Critical Path Method calculations with finish-to-start dependency constraints.
              </p>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-xs space-y-1.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <ShieldIcon className="w-4 h-4" />
              </div>
              <h4 className="text-xs font-bold text-slate-900">Forced PostgreSQL RLS</h4>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Guaranteed cross-tenant isolation enforced at the PostgreSQL database engine.
              </p>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-xs space-y-1.5">
              <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
                <LockIcon className="w-4 h-4" />
              </div>
              <h4 className="text-xs font-bold text-slate-900">Human-Guarded AI</h4>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Structured proposals with exact before/after diffs requiring admin sign-off.
              </p>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-xs space-y-1.5">
              <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center">
                <CheckCircleIcon className="w-4 h-4" />
              </div>
              <h4 className="text-xs font-bold text-slate-900">Verified Evidence</h4>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                All health report claims cite verified entity citations with SHA-256 integrity.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="border-t border-slate-200/80 bg-white py-4 px-6 text-center text-xs text-slate-400">
          TeamOS · Delivery Risk Intelligence Platform
        </footer>
      </main>
    );
  }

  // User role for RBAC
  const currentUserRole = (activeOrg?.role as OrgRole) || 'MEMBER';
  const canManageInvitations = currentUserRole === 'OWNER' || currentUserRole === 'ADMIN';

  // ==========================================
  // Authenticated Three-Panel Workspace Shell
  // ==========================================

  return (
    <ToastProvider>
      <div className="flex h-screen w-screen overflow-hidden bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors">
      {/* 1. Global Navigation Rail (Panel 1 - far left, 56px) */}
      <NavigationRail
        activeSection={activeSection}
        onSelectSection={(sec) => {
          setActiveSection(sec);
          if (window.innerWidth < 768) {
            setIsSidebarCollapsed(true);
          }
        }}
        orgName={activeOrg?.name}
      />

      {/* 2. Workspace / Project Sidebar (Panel 2 - 240px, collapsible) */}
      <WorkspaceSidebar
        orgs={orgs}
        activeOrg={activeOrg}
        onSelectOrg={(org) => {
          setActiveOrg(org);
          setRefreshKey((k) => k + 1);
        }}
        onOpenCreateOrg={() => setCreateOrgOpen(true)}
        projects={projects}
        selectedProjectId={selectedProjectId}
        onSelectProject={(id) => {
          setSelectedProjectId(id);
          setActiveSection('projects');
        }}
        onOpenCreateProject={() => setCreateProjectOpen(true)}
        onOpenCreateTask={() => {
          if (!selectedProjectId && projects.length > 0) {
            setSelectedProjectId(projects[0].id);
          }
          setTaskInitialStatus('TODO');
          setCreateTaskOpen(true);
        }}
        activeSection={activeSection}
        onSelectSection={(sec) => setActiveSection(sec)}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        userAssignedTaskCount={userAssignedTasks.length}
      />

      {/* 3. Main Workspace Area (Panel 3 - large workspace & controls) */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden bg-slate-100/50 dark:bg-slate-950 transition-colors">
        {/* Top Global Header */}
        <TopHeader
          sessionData={sessionData}
          activeOrg={activeOrg}
          projectName={selectedProject?.name}
          sectionTitle={
            activeSection === 'home'
              ? 'Workspace Overview'
              : activeSection === 'your-work'
              ? 'Your Work'
              : activeSection === 'risk'
              ? 'Delivery Risk'
              : activeSection === 'proposals'
              ? 'AI Planning'
              : activeSection === 'reports'
              ? 'Health Reports'
              : activeSection === 'audit'
              ? 'Audit Log'
              : activeSection === 'members'
              ? 'Team Members'
              : activeSection === 'settings'
              ? 'Settings'
              : undefined
          }
          theme={theme}
          onToggleTheme={handleToggleTheme}
          onOpenOnboarding={() => setOnboardingOpen(true)}
          onOpenSearch={() => setCommandPaletteOpen(true)}
          onOpenGuidedTour={() => setGuidedTourOpen(true)}
          onOpenAiPlanner={() => setAiPlannerOpen(true)}
          onToggleSidebar={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          isSidebarCollapsed={isSidebarCollapsed}
          onLogout={handleLogout}
        />

        {/* Main Content Workspace */}
        <main className="flex-1 overflow-y-auto p-3 sm:p-5 lg:p-6">
          {orgs.length === 0 ? (
            /* Onboarding State: No Organizations */
            <div className="max-w-md mx-auto my-12 bg-white rounded-2xl border border-slate-200/90 p-8 text-center space-y-4 shadow-sm">
              <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 border border-blue-200/70 flex items-center justify-center mx-auto">
                <BuildingIcon className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h2 className="text-lg font-bold text-slate-900">Create your workspace</h2>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Workspaces isolate projects, tasks, team memberships, and risk evaluations under forced PostgreSQL Row-Level Security.
                </p>
              </div>
              <Button
                type="button"
                variant="primary"
                size="md"
                className="w-full"
                onClick={() => setCreateOrgOpen(true)}
                leftIcon={<PlusIcon className="w-4 h-4" />}
              >
                Create Workspace
              </Button>
            </div>
          ) : activeOrg ? (
            /* Active Organization Content */
            <div>
              {/* SECTION: Projects & Work Items (Primary Screen) */}
              {activeSection === 'projects' && (
                <div>
                  {projects.length === 0 ? (
                    <EmptyState
                      icon={<FolderIcon className="w-6 h-6 text-blue-600" />}
                      title="No projects in this workspace"
                      description="Create a project to manage work items, finish-to-start dependencies, and delivery risk calculations."
                      action={
                        <Button
                          type="button"
                          variant="primary"
                          size="sm"
                          onClick={() => setCreateProjectOpen(true)}
                          leftIcon={<PlusIcon className="w-3.5 h-3.5" />}
                        >
                          Create First Project
                        </Button>
                      }
                    />
                  ) : selectedProject ? (
                    <ProjectWorkspace
                      orgId={activeOrg.id}
                      project={selectedProject}
                      tasks={tasks}
                      members={members}
                      currentUserRole={currentUserRole}
                      currentUserId={sessionData?.user?.id}
                      apiBaseUrl={API_BASE_URL}
                      onSelectTask={(task) => setSelectedTask(task)}
                      onOpenCreateTask={(initialStatus) => {
                        setTaskInitialStatus(initialStatus || 'TODO');
                        setCreateTaskOpen(true);
                      }}
                      onQuickStatusChange={handleQuickStatusChange}
                      onRefreshProject={() => setRefreshKey((k) => k + 1)}
                    />
                  ) : (
                    <div className="p-8 text-center text-xs text-slate-400">
                      Select a project from the sidebar to view work items.
                    </div>
                  )}
                </div>
              )}

              {/* SECTION: Home / Workspace Overview */}
              {activeSection === 'home' && (
                <div className="space-y-5 max-w-5xl mx-auto">
                  <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/90 dark:border-slate-800 p-5 sm:p-6 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-colors">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2.5">
                        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
                          {activeOrg.name} Overview
                        </h1>
                        <Badge variant="purple" size="sm">
                          {activeOrg.role}
                        </Badge>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Delivery Risk Intelligence and workspace operations.
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => setCreateProjectOpen(true)}
                        leftIcon={<PlusIcon className="w-3.5 h-3.5" />}
                      >
                        New Project
                      </Button>
                      {canManageInvitations && (
                        <Button
                          type="button"
                          variant="primary"
                          size="sm"
                          onClick={() => setInviteOpen(true)}
                          leftIcon={<PlusIcon className="w-3.5 h-3.5" />}
                        >
                          Invite Member
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* 3 Executive Pillars */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/90 dark:border-slate-800 p-4 shadow-xs space-y-2 transition-colors">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Team Capacity</span>
                        <UsersIcon className="w-4 h-4 text-slate-400" />
                      </div>
                      <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 font-mono">
                        {members.length} {members.length === 1 ? 'Member' : 'Members'}
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Active collaborators with tenant-isolated role permissions.
                      </p>
                    </div>

                    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/90 dark:border-slate-800 p-4 shadow-xs space-y-2 transition-colors">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Security & Isolation</span>
                        <ShieldIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      </div>
                      <div className="text-base font-bold text-slate-900 dark:text-slate-100">PostgreSQL RLS Active</div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        All tables enforce composite foreign keys and non-bypassable row-level policies.
                      </p>
                    </div>

                    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/90 dark:border-slate-800 p-4 shadow-xs space-y-2 transition-colors">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Risk Intelligence</span>
                        <ActivityIcon className="w-4 h-4 text-blue-600 dark:text-sky-400" />
                      </div>
                      <div className="text-base font-bold text-slate-900 dark:text-slate-100">Deterministic CPM Engine</div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        DAG validation, CPM critical path analysis, and zero-hallucination reporting.
                      </p>
                    </div>
                  </div>

                  {/* Active Projects List Preview */}
                  <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/90 dark:border-slate-800 p-4 sm:p-5 shadow-xs space-y-3 transition-colors">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Active Projects</h3>
                      <button
                        type="button"
                        onClick={() => setActiveSection('projects')}
                        className="text-xs font-semibold text-blue-600 dark:text-sky-400 hover:underline"
                      >
                        View all
                      </button>
                    </div>

                    <div className="divide-y divide-slate-100 dark:divide-slate-800">
                      {projects.map((p) => (
                        <div
                          key={p.id}
                          onClick={() => {
                            setSelectedProjectId(p.id);
                            setActiveSection('projects');
                          }}
                          className="flex items-center justify-between py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/60 px-2 rounded-lg cursor-pointer transition-colors"
                        >
                          <div className="flex items-center gap-2.5">
                            <span className="font-mono text-xs font-bold bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                              {p.key}
                            </span>
                            <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">{p.name}</span>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                            <span>{p.taskCount ?? 0} work items</span>
                            {p.dueDate && <span className="font-mono text-slate-400">Due {p.dueDate}</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* SECTION: Your Work */}
              {activeSection === 'your-work' && (
                <div className="space-y-4 max-w-5xl mx-auto">
                  <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/90 dark:border-slate-800 p-4 sm:p-5 shadow-xs transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-sky-400 flex items-center justify-center font-bold">
                        <CheckSquareIcon className="w-4 h-4" />
                      </div>
                      <div>
                        <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">Your Assigned Work</h2>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Work items assigned to @{sessionData.user.login} in the active project.
                        </p>
                      </div>
                    </div>
                  </div>

                  {userAssignedTasks.length === 0 ? (
                    <EmptyState
                      icon={<CheckSquareIcon className="w-6 h-6 text-slate-400" />}
                      title="No work items assigned to you"
                      description="You currently have no tasks assigned in this project."
                    />
                  ) : (
                    <WorkItemsList
                      tasks={userAssignedTasks}
                      projectKey={selectedProject?.key || 'TASK'}
                      members={members}
                      onSelectTask={(task) => setSelectedTask(task)}
                      onOpenCreateTask={(initialStatus) => {
                        setTaskInitialStatus(initialStatus || 'TODO');
                        setCreateTaskOpen(true);
                      }}
                      onQuickStatusChange={handleQuickStatusChange}
                      onInlineCreateTask={
                        selectedProject && activeOrg
                          ? async (title, status, priority) => {
                              await fetch(
                                `${API_BASE_URL}/api/v1/orgs/${activeOrg.id}/projects/${selectedProject.id}/tasks`,
                                {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  credentials: 'include',
                                  body: JSON.stringify({
                                    title,
                                    status,
                                    priority,
                                    remainingEstimateWorkdays: 3,
                                  }),
                                },
                              );
                              setRefreshKey((k) => k + 1);
                            }
                          : undefined
                      }
                    />
                  )}
                </div>
              )}

              {/* SECTION: Delivery Risk Intelligence */}
              {activeSection === 'risk' && selectedProject && (
                <div className="max-w-5xl mx-auto">
                  <RiskOverviewPanel
                    orgId={activeOrg.id}
                    projectId={selectedProject.id}
                    projectKey={selectedProject.key}
                    tasks={tasks}
                    apiBaseUrl={API_BASE_URL}
                  />
                </div>
              )}

              {/* SECTION: Proposals & Plans */}
              {activeSection === 'proposals' && selectedProject && (
                <div className="max-w-5xl mx-auto">
                  <ProposalsPanel
                    orgId={activeOrg.id}
                    projectId={selectedProject.id}
                    projectKey={selectedProject.key}
                    tasks={tasks}
                    currentUserRole={currentUserRole}
                    apiBaseUrl={API_BASE_URL}
                    onProposalApplied={() => setRefreshKey((k) => k + 1)}
                  />
                </div>
              )}

              {/* SECTION: Health Reports */}
              {activeSection === 'reports' && selectedProject && (
                <div className="max-w-5xl mx-auto">
                  <ReportsPanel
                    orgId={activeOrg.id}
                    projectId={selectedProject.id}
                    apiBaseUrl={API_BASE_URL}
                  />
                </div>
              )}

              {/* SECTION: Audit Log */}
              {activeSection === 'audit' && (
                <div className="max-w-5xl mx-auto">
                  <AuditTimeline
                    orgId={activeOrg.id}
                    apiBaseUrl={API_BASE_URL}
                  />
                </div>
              )}

              {/* SECTION: Team Members */}
              {activeSection === 'members' && (
                <div className="max-w-5xl mx-auto space-y-4">
                  <div className="flex items-center justify-between pb-2">
                    <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Workspace Members</h2>
                    {canManageInvitations && (
                      <Button
                        type="button"
                        variant="primary"
                        size="sm"
                        onClick={() => setInviteOpen(true)}
                        leftIcon={<PlusIcon className="w-3.5 h-3.5" />}
                      >
                        Invite Member
                      </Button>
                    )}
                  </div>
                  <MembersTable
                    orgId={activeOrg.id}
                    members={members}
                    currentUserRole={currentUserRole}
                    currentUserId={sessionData.user.id}
                    apiBaseUrl={API_BASE_URL}
                    onMemberUpdated={() => setRefreshKey((k) => k + 1)}
                    onOpenTransferModal={() => setTransferOpen(true)}
                  />
                  {canManageInvitations && (
                    <InvitationsPanel
                      orgId={activeOrg.id}
                      apiBaseUrl={API_BASE_URL}
                      onOpenInviteModal={() => setInviteOpen(true)}
                      refreshKey={refreshKey}
                    />
                  )}
                </div>
              )}

              {/* SECTION: Settings */}
              {activeSection === 'settings' && (
                <div className="max-w-3xl mx-auto space-y-4">
                  <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/90 dark:border-slate-800 p-5 shadow-xs space-y-3 transition-colors">
                    <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Workspace Settings</h2>
                    <div className="space-y-2 text-xs text-slate-600 dark:text-slate-300">
                      <div>
                        Name: <strong className="text-slate-900 dark:text-slate-100">{activeOrg.name}</strong>
                      </div>
                      <div>
                        Slug: <span className="font-mono text-slate-700 dark:text-slate-300">{activeOrg.slug}</span>
                      </div>
                      <div>
                        Your Role: <Badge variant="purple" size="xs">{currentUserRole}</Badge>
                      </div>
                      <div>
                        Organization ID: <span className="font-mono text-slate-400">{activeOrg.id}</span>
                      </div>
                      <div className="pt-2 flex items-center justify-between border-t border-slate-100 dark:border-slate-800">
                        <span>Theme Preference:</span>
                        <Button
                          type="button"
                          variant="secondary"
                          size="xs"
                          onClick={handleToggleTheme}
                        >
                          {theme === 'dark' ? 'Dark Mode (Active)' : 'Light Mode (Active)'}
                        </Button>
                      </div>
                    </div>

                    {currentUserRole === 'OWNER' && (
                      <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
                        <Button
                          type="button"
                          variant="danger"
                          size="sm"
                          onClick={() => setTransferOpen(true)}
                        >
                          Transfer Ownership
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </main>
      </div>

      {/* ========================================== */}
      {/* Global Modals & Command Palette            */}
      {/* ========================================== */}

      {/* Global Command Palette (⌘K) */}
      <CommandPalette
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        tasks={tasks}
        projects={projects}
        onSelectTask={(task) => setSelectedTask(task)}
        onSelectProject={(projectId) => {
          setSelectedProjectId(projectId);
          setActiveSection('projects');
        }}
        onNavigate={(sec) => setActiveSection(sec)}
      />

      {/* Create Organization Modal */}
      <CreateOrgModal
        isOpen={createOrgOpen}
        onClose={() => setCreateOrgOpen(false)}
        onSuccess={(newOrg) => {
          setOrgs((prev) => [newOrg, ...prev]);
          setActiveOrg(newOrg);
          setRefreshKey((k) => k + 1);
        }}
        apiBaseUrl={API_BASE_URL}
      />

      {/* Create Project Modal */}
      {activeOrg && (
        <CreateProjectModal
          isOpen={createProjectOpen}
          onClose={() => setCreateProjectOpen(false)}
          orgId={activeOrg.id}
          apiBaseUrl={API_BASE_URL}
          onSuccess={(newProject) => {
            setProjects((prev) => [newProject, ...prev]);
            setSelectedProjectId(newProject.id);
            setActiveSection('projects');
            setRefreshKey((k) => k + 1);
          }}
        />
      )}

      {/* Create Task Modal */}
      {activeOrg && selectedProjectId && (
        <CreateTaskModal
          isOpen={createTaskOpen}
          onClose={() => setCreateTaskOpen(false)}
          orgId={activeOrg.id}
          projectId={selectedProjectId}
          projectKey={selectedProject?.key || 'TASK'}
          members={members}
          apiBaseUrl={API_BASE_URL}
          initialStatus={taskInitialStatus}
          onSuccess={(newTask) => {
            setTasks((prev) => [newTask, ...prev]);
            setRefreshKey((k) => k + 1);
          }}
        />
      )}

      {/* Task Detail Modal / Drawer (with preserved dependency consistency) */}
      {activeOrg && selectedProject && (
        <TaskDetailModal
          isOpen={Boolean(selectedTask)}
          onClose={() => setSelectedTask(null)}
          task={selectedTask}
          allTasks={tasks}
          projectKey={selectedProject.key}
          orgId={activeOrg.id}
          members={members}
          apiBaseUrl={API_BASE_URL}
          currentUserId={sessionData?.user?.id}
          onUpdated={() => setRefreshKey((k) => k + 1)}
        />
      )}

      {/* AI Plan Generator Modal */}
      {activeOrg && selectedProject && (
        <AiPlanGeneratorModal
          isOpen={aiPlannerOpen}
          onClose={() => setAiPlannerOpen(false)}
          orgId={activeOrg.id}
          projectId={selectedProject.id}
          projectKey={selectedProject.key}
          apiBaseUrl={API_BASE_URL}
          onPlanGenerated={() => {
            setActiveSection('proposals');
            setRefreshKey((k) => k + 1);
          }}
        />
      )}

      {/* Invite Member Modal */}
      {activeOrg && (
        <InviteModal
          isOpen={inviteOpen}
          onClose={() => setInviteOpen(false)}
          orgId={activeOrg.id}
          apiBaseUrl={API_BASE_URL}
          onSuccess={() => setRefreshKey((k) => k + 1)}
        />
      )}

      {/* Transfer Ownership Modal */}
      {activeOrg && (
        <TransferOwnershipModal
          isOpen={transferOpen}
          onClose={() => setTransferOpen(false)}
          orgId={activeOrg.id}
          members={members}
          currentUserId={sessionData.user.id}
          apiBaseUrl={API_BASE_URL}
          onSuccess={() => setRefreshKey((k) => k + 1)}
        />
      )}

      {/* Product Onboarding Wizard */}
      {sessionData && (
        <OnboardingWizard
          isOpen={onboardingOpen}
          onClose={() => setOnboardingOpen(false)}
          sessionData={sessionData}
          orgs={orgs}
          activeOrg={activeOrg}
          onSelectOrg={(org) => {
            setActiveOrg(org);
            setRefreshKey((k) => k + 1);
          }}
          projects={projects}
          selectedProjectId={selectedProjectId}
          onSelectProject={(id) => {
            setSelectedProjectId(id);
            setActiveSection('projects');
          }}
          onOpenCreateProject={() => {
            setOnboardingOpen(false);
            setCreateProjectOpen(true);
          }}
          onOpenCreateOrg={() => {
            setOnboardingOpen(false);
            setCreateOrgOpen(true);
          }}
        />
      )}

      {/* Guided Tour Spotlight Tooltip */}
      <GuidedTourTooltip
        isOpen={guidedTourOpen}
        onClose={() => setGuidedTourOpen(false)}
        onOpenCommandPalette={() => setCommandPaletteOpen(true)}
      />
      </div>
    </ToastProvider>
  );
}
