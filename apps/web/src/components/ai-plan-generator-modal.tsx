'use client';

import React, { useState } from 'react';
import type { ProposalDto } from '@teamos/contracts';

interface AiPlanGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  orgId: string;
  projectId: string;
  projectKey: string;
  apiBaseUrl: string;
  onPlanGenerated: (proposal: ProposalDto) => void;
}

const SAMPLE_BRIEFS = [
  'Multi-factor Authentication with TOTP, recovery codes, and rate limiting',
  'Stripe subscription checkout with webhook invoice handler and customer portal',
  'Automated PostgreSQL database read replicas, connection pooling, and failover health checks',
  'GitHub App webhook receiver with constant-time HMAC-SHA256 signature verification and outbox retry',
];

export function AiPlanGeneratorModal({
  isOpen,
  onClose,
  orgId,
  projectId,
  projectKey,
  apiBaseUrl,
  onPlanGenerated,
}: AiPlanGeneratorModalProps) {
  const [brief, setBrief] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    if (!brief.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(
        `${apiBaseUrl}/api/v1/orgs/${orgId}/projects/${projectId}/ai/generate-plan`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ brief: brief.trim() }),
        },
      );

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || 'Failed to generate plan.');
      }

      const proposal: ProposalDto = await res.json();
      onPlanGenerated(proposal);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error generating plan.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl border border-slate-200 my-8 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <span className="text-xl">🤖</span>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                AI Plan Generator
              </h3>
              <p className="text-xs text-slate-500">
                Convert an engineering brief into a structured, DAG-verified plan proposal.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors text-sm font-semibold p-1"
          >
            ✕
          </button>
        </div>

        {error && (
          <div className="p-3 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg">
            {error}
          </div>
        )}

        <form onSubmit={handleGenerate} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
              Project / Feature Brief <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={4}
              required
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              placeholder="Describe what needs to be built, key deliverables, technologies, and constraints..."
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="space-y-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              Quick Templates:
            </span>
            <div className="space-y-1">
              {SAMPLE_BRIEFS.map((sample, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setBrief(sample)}
                  className="w-full text-left text-[11px] text-slate-600 hover:text-blue-600 bg-slate-50 hover:bg-blue-50 p-2 rounded border border-slate-200 transition-colors line-clamp-1"
                >
                  💡 {sample}
                </button>
              ))}
            </div>
          </div>

          <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-lg text-xs text-blue-900 leading-relaxed">
            <strong>🛡️ Human Review Guardrail:</strong> Generated tasks will be staged as a{' '}
            <span className="font-semibold underline">PENDING Proposal</span>. No tasks or dependencies will be created in {projectKey} until you review the exact diff and approve it.
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !brief.trim()}
              className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg shadow-sm transition-colors flex items-center gap-1.5"
            >
              {loading ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Generating Plan...
                </>
              ) : (
                <>
                  <span>🤖</span> Generate Plan Proposal
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

