'use client';

import React, { useEffect, useState } from 'react';
import type {
  AuthMeResponseDto,
  OrgDto,
  OrgMemberDto,
  OrgRole,
} from '@teamos/contracts';
import { Navbar } from '../components/navbar';
import { CreateOrgModal } from '../components/create-org-modal';
import { InviteModal } from '../components/invite-modal';
import { TransferOwnershipModal } from '../components/transfer-ownership-modal';
import { MembersTable } from '../components/members-table';
import { InvitationsPanel } from '../components/invitations-panel';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

type Tab = 'overview' | 'members' | 'invitations';

export default function HomePage() {
  const [sessionData, setSessionData] = useState<AuthMeResponseDto | null>(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  // Tenancy State
  const [orgs, setOrgs] = useState<OrgDto[]>([]);
  const [activeOrg, setActiveOrg] = useState<OrgDto | null>(null);
  const [members, setMembers] = useState<OrgMemberDto[]>([]);
  const [loadingOrgData, setLoadingOrgData] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('overview');

  // Modals
  const [createOrgOpen, setCreateOrgOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // 1. Check active session on mount
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

  // 2. Fetch user's organizations once authenticated
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

          // Select active organization
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

  // 3. Load active organization details & members
  useEffect(() => {
    if (!sessionData || !activeOrg) {
      setMembers([]);
      return;
    }

    const orgId = activeOrg.id;

    async function loadOrgMembers() {
      setLoadingOrgData(true);
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
      } finally {
        setLoadingOrgData(false);
      }
    }

    loadOrgMembers();
  }, [sessionData, activeOrg?.id, refreshKey]);

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

  function handleOrgCreated(newOrg: OrgDto) {
    setOrgs((prev) => [newOrg, ...prev]);
    setActiveOrg(newOrg);
    setRefreshKey((k) => k + 1);
  }

  function handleDataUpdated() {
    setRefreshKey((k) => k + 1);
  }

  if (loadingSession) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="text-center space-y-2">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent mx-auto" />
          <p className="text-xs text-slate-500 font-medium">Checking authentication...</p>
        </div>
      </main>
    );
  }

  // Unauthenticated Landing Screen
  if (!sessionData) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-slate-50">
        <div className="max-w-xl w-full text-center space-y-6 bg-white p-8 sm:p-10 rounded-2xl shadow-sm border border-slate-200">
          <div className="inline-block px-3 py-1 text-xs font-semibold tracking-wider text-blue-700 uppercase bg-blue-50 rounded-full border border-blue-200">
            Delivery Risk Intelligence
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl text-slate-900">
            TeamOS
          </h1>
          <p className="text-base text-slate-600 leading-relaxed">
            Will we hit our delivery date, what is blocking it, and what changed?
            Deterministic risk calculations grounded in tasks, dependencies, and GitHub evidence.
          </p>

          <div className="pt-4 border-t border-slate-100 flex flex-col items-center justify-center gap-4">
            <a
              href={`${API_BASE_URL}/api/v1/auth/github/login`}
              className="inline-flex items-center gap-2.5 px-6 py-3 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-xl shadow-sm transition-colors"
            >
              <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
              </svg>
              Sign in with GitHub
            </a>
            {authError && <p className="text-xs text-rose-500">{authError}</p>}
          </div>
        </div>
      </main>
    );
  }

  // Authenticated State
  const currentUserRole = (activeOrg?.role as OrgRole) || 'MEMBER';
  const canManageInvitations = currentUserRole === 'OWNER' || currentUserRole === 'ADMIN';

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar
        sessionData={sessionData}
        orgs={orgs}
        activeOrg={activeOrg}
        onSelectOrg={(org) => setActiveOrg(org)}
        onOpenCreateOrg={() => setCreateOrgOpen(true)}
        onLogout={handleLogout}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {orgs.length === 0 ? (
          // Onboarding Empty State
          <div className="max-w-md mx-auto my-12 bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-4 shadow-sm">
            <div className="h-12 w-12 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xl mx-auto">
              🏢
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">Create your first organization</h2>
              <p className="text-xs text-slate-500 mt-1">
                Organizations isolate workspaces, members, projects, and risk evaluations under PostgreSQL RLS.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setCreateOrgOpen(true)}
              className="w-full py-2.5 px-4 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm transition-colors"
            >
              + Create Organization
            </button>
          </div>
        ) : activeOrg ? (
          // Active Organization Workspace
          <div className="space-y-6">
            {/* Header */}
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                    {activeOrg.name}
                  </h1>
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wide ${
                      activeOrg.role === 'OWNER'
                        ? 'bg-purple-100 text-purple-800 border border-purple-200'
                        : activeOrg.role === 'ADMIN'
                        ? 'bg-blue-100 text-blue-800 border border-blue-200'
                        : 'bg-slate-100 text-slate-700 border border-slate-200'
                    }`}
                  >
                    Your Role: {activeOrg.role}
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  Slug: <span className="font-mono text-slate-700">{activeOrg.slug}</span> | Org ID:{' '}
                  <span className="font-mono text-slate-500">{activeOrg.id}</span>
                </p>
              </div>

              {canManageInvitations && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setInviteOpen(true)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-colors"
                  >
                    <span>+</span> Invite Teammate
                  </button>
                </div>
              )}
            </div>

            {/* Navigation Tabs */}
            <div className="flex border-b border-slate-200 gap-6 text-sm font-semibold">
              <button
                type="button"
                onClick={() => setActiveTab('overview')}
                className={`pb-3 transition-colors border-b-2 ${
                  activeTab === 'overview'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                Overview
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('members')}
                className={`pb-3 transition-colors border-b-2 ${
                  activeTab === 'members'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                Members ({members.length})
              </button>
              {canManageInvitations && (
                <button
                  type="button"
                  onClick={() => setActiveTab('invitations')}
                  className={`pb-3 transition-colors border-b-2 ${
                    activeTab === 'invitations'
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Invitations
                </button>
              )}
            </div>

            {/* Tab Contents */}
            {activeTab === 'overview' && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Team Size
                  </span>
                  <div className="text-3xl font-black text-slate-900">{members.length}</div>
                  <p className="text-xs text-slate-500">
                    Active members in this organization workspace
                  </p>
                </div>

                <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Security & RBAC
                  </span>
                  <div className="text-base font-bold text-slate-900">PostgreSQL RLS Active</div>
                  <p className="text-xs text-slate-500">
                    Forced row-level security isolates all data by tenant
                  </p>
                </div>

                <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Delivery Risk Engine
                  </span>
                  <div className="text-base font-bold text-emerald-600">Deterministic Engine Ready</div>
                  <p className="text-xs text-slate-500">
                    DAG validation, CPM calculations, and slack analysis
                  </p>
                </div>
              </div>
            )}

            {activeTab === 'members' && (
              <MembersTable
                orgId={activeOrg.id}
                members={members}
                currentUserRole={currentUserRole}
                currentUserId={sessionData.user.id}
                apiBaseUrl={API_BASE_URL}
                onMemberUpdated={handleDataUpdated}
                onOpenTransferModal={() => setTransferOpen(true)}
              />
            )}

            {activeTab === 'invitations' && canManageInvitations && (
              <InvitationsPanel
                orgId={activeOrg.id}
                apiBaseUrl={API_BASE_URL}
                onOpenInviteModal={() => setInviteOpen(true)}
                refreshKey={refreshKey}
              />
            )}
          </div>
        ) : null}
      </main>

      {/* Modals */}
      <CreateOrgModal
        isOpen={createOrgOpen}
        onClose={() => setCreateOrgOpen(false)}
        onSuccess={handleOrgCreated}
        apiBaseUrl={API_BASE_URL}
      />

      {activeOrg && (
        <InviteModal
          isOpen={inviteOpen}
          onClose={() => setInviteOpen(false)}
          orgId={activeOrg.id}
          apiBaseUrl={API_BASE_URL}
          onSuccess={handleDataUpdated}
        />
      )}

      {activeOrg && (
        <TransferOwnershipModal
          isOpen={transferOpen}
          onClose={() => setTransferOpen(false)}
          orgId={activeOrg.id}
          members={members}
          currentUserId={sessionData.user.id}
          apiBaseUrl={API_BASE_URL}
          onSuccess={handleDataUpdated}
        />
      )}
    </div>
  );
}
