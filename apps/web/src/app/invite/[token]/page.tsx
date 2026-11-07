'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import type { InvitationDetailsDto, AuthMeResponseDto } from '@teamos/contracts';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function AcceptInvitationPage() {
  const params = useParams();
  const router = useRouter();
  const token = typeof params.token === 'string' ? params.token : '';

  const [invitation, setInvitation] = useState<InvitationDetailsDto | null>(null);
  const [currentUser, setCurrentUser] = useState<AuthMeResponseDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      if (!token) return;
      setLoading(true);
      setError(null);

      try {
        // 1. Check if user is authenticated
        const authRes = await fetch(`${API_BASE_URL}/api/v1/auth/me`, {
          credentials: 'include',
        });
        if (authRes.ok) {
          const authData: AuthMeResponseDto = await authRes.json();
          setCurrentUser(authData);
        } else {
          setCurrentUser(null);
        }

        // 2. Inspect invitation details
        const invRes = await fetch(`${API_BASE_URL}/api/v1/invitations/${token}`, {
          credentials: 'include',
        });

        if (invRes.ok) {
          const invData: InvitationDetailsDto = await invRes.json();
          setInvitation(invData);
        } else {
          const invData = await invRes.json().catch(() => ({}));
          setError(invData.message || 'Invitation not found or invalid.');
        }
      } catch (err: any) {
        setError(err.message || 'Network error loading invitation.');
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [token]);

  async function handleAccept() {
    setAccepting(true);
    setError(null);

    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/invitations/${token}/accept`, {
        method: 'POST',
        credentials: 'include',
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.message || `Failed to accept invitation (${res.status})`);
      }

      setSuccessMessage(data.message || 'Invitation accepted! Redirecting to workspace...');
      setTimeout(() => {
        router.push('/');
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'Error accepting invitation.');
      setAccepting(false);
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="text-center space-y-2">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent mx-auto" />
          <p className="text-xs text-slate-500 font-medium">Loading invitation details...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 bg-slate-50">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-sm border border-slate-200">
        <div className="flex items-center justify-center gap-2 mb-6">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-white font-black text-lg shadow-sm">
            T
          </span>
          <span className="text-xl font-black tracking-tight text-slate-900">
            TeamOS
          </span>
        </div>

        {error && (
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-center mb-6">
            <p className="text-sm font-semibold">Invitation Error</p>
            <p className="text-xs mt-1 text-rose-700">{error}</p>
          </div>
        )}

        {successMessage ? (
          <div className="p-6 bg-emerald-50 border border-emerald-200 rounded-xl text-center space-y-2">
            <div className="text-2xl">🎉</div>
            <h3 className="text-base font-bold text-emerald-900">Welcome to the Team!</h3>
            <p className="text-xs text-emerald-700">{successMessage}</p>
          </div>
        ) : invitation && !invitation.isValid ? (
          <div className="text-center space-y-4">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-600 text-xl font-bold">
              !
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Invitation Unavailable</h2>
              <p className="text-xs text-slate-500 mt-1">
                {invitation.invalidReason === 'EXPIRED' &&
                  'This invitation has expired. Ask an organization admin to generate a new invite link.'}
                {invitation.invalidReason === 'REVOKED' &&
                  'This invitation has been revoked by an administrator.'}
                {invitation.invalidReason === 'ALREADY_ACCEPTED' &&
                  'This invitation has already been accepted.'}
                {!invitation.invalidReason &&
                  'This invitation link is no longer valid.'}
              </p>
            </div>
            <button
              onClick={() => router.push('/')}
              className="text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors"
            >
              ← Back to TeamOS Home
            </button>
          </div>
        ) : invitation && invitation.isValid ? (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <span className="inline-block px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-blue-700 bg-blue-50 border border-blue-200 rounded-full">
                Workspace Invitation
              </span>
              <h1 className="text-2xl font-extrabold text-slate-900">
                Join {invitation.orgName}
              </h1>
              <p className="text-sm text-slate-600">
                You have been invited to join as an{' '}
                <strong className="text-slate-900 font-semibold">{invitation.role}</strong>.
              </p>
            </div>

            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs text-slate-600">
              {invitation.email && (
                <div className="flex justify-between">
                  <span className="text-slate-400">Target Email:</span>
                  <span className="font-semibold text-slate-800">{invitation.email}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-slate-400">Assigned Role:</span>
                <span className="font-semibold text-blue-700">{invitation.role}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Expires:</span>
                <span className="font-medium text-slate-700">
                  {new Date(invitation.expiresAt).toLocaleDateString()}
                </span>
              </div>
            </div>

            {currentUser ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 p-2.5 bg-slate-100 rounded-lg text-xs text-slate-700">
                  <span className="text-slate-400">Signed in as:</span>
                  <span className="font-semibold text-slate-900">
                    @{currentUser.user.login}
                  </span>
                </div>

                <button
                  type="button"
                  disabled={accepting}
                  onClick={handleAccept}
                  className="w-full py-2.5 px-4 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-xl shadow-sm transition-colors"
                >
                  {accepting ? 'Joining Organization...' : `Accept & Join ${invitation.orgName}`}
                </button>
              </div>
            ) : (
              <div className="space-y-3 text-center">
                <p className="text-xs text-slate-500">
                  You need to sign in with GitHub to accept this invitation.
                </p>
                <a
                  href={`${API_BASE_URL}/api/v1/auth/github/login?redirect=/invite/${token}`}
                  className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-xl shadow-sm transition-colors"
                >
                  <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
                  </svg>
                  Sign in with GitHub to Accept
                </a>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </main>
  );
}
