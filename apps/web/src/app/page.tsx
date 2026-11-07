'use client';

import { useEffect, useState } from 'react';
import type { AuthMeResponseDto } from '@teamos/contracts';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function HomePage() {
  const [sessionData, setSessionData] = useState<AuthMeResponseDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
        setError(err.message || 'Failed to check session');
      } finally {
        setLoading(false);
      }
    }

    checkAuth();
  }, []);

  async function handleLogout() {
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      });
      if (res.ok) {
        setSessionData(null);
      }
    } catch (err: any) {
      alert(`Logout failed: ${err.message}`);
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-slate-50">
      <div className="max-w-2xl w-full text-center space-y-6 bg-white p-8 rounded-xl shadow-sm border border-slate-200">
        <div className="inline-block px-3 py-1 text-xs font-semibold tracking-wider text-blue-700 uppercase bg-blue-50 rounded-full border border-blue-200">
          Delivery Risk Intelligence
        </div>
        <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl text-slate-900">
          TeamOS
        </h1>
        <p className="text-lg text-slate-600 leading-relaxed">
          Will we hit our delivery date, what is blocking it, and what changed?
          Deterministic risk calculations grounded in tasks, dependencies, and GitHub evidence.
        </p>

        <div className="pt-2 border-t border-slate-100 flex flex-col items-center justify-center gap-4">
          {loading ? (
            <p className="text-sm text-slate-500">Checking active session...</p>
          ) : sessionData ? (
            <div className="space-y-4 w-full">
              <div className="flex items-center justify-center space-x-3 bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                {sessionData.user.avatarUrl && (
                  <img
                    src={sessionData.user.avatarUrl}
                    alt={sessionData.user.login}
                    className="w-10 h-10 rounded-full border border-emerald-300"
                  />
                )}
                <div className="text-left">
                  <p className="text-sm font-semibold text-emerald-900">
                    {sessionData.user.displayName || sessionData.user.login}
                  </p>
                  <p className="text-xs text-emerald-700">@{sessionData.user.login}</p>
                </div>
              </div>
              <p className="text-xs text-slate-400">
                Session: {sessionData.sessionId.slice(0, 8)}... | Expires:{' '}
                {new Date(sessionData.expiresAt).toLocaleDateString()}
              </p>
              <button
                onClick={handleLogout}
                className="px-4 py-2 text-sm font-medium text-white bg-rose-600 hover:bg-rose-700 rounded-md transition-colors"
              >
                Sign Out
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <a
                href={`${API_BASE_URL}/api/v1/auth/github/login`}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-sm transition-colors"
              >
                <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                  <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
                </svg>
                Sign in with GitHub
              </a>
              {error && <p className="text-xs text-rose-500">{error}</p>}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

