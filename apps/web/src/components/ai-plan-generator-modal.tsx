'use client';

import React, { useState } from 'react';
import type { ProposalDto } from '@teamos/contracts';
import { Modal, Textarea, Button } from './ui';
import { SparklesIcon, ShieldIcon } from './ui/icons';

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
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2">
          <SparklesIcon className="w-4 h-4 text-purple-600" />
          <span>AI Plan Generator</span>
        </div>
      }
      description={`Generate a structured, DAG-verified plan proposal for project ${projectKey}.`}
      maxWidth="lg"
    >
      <form onSubmit={handleGenerate} className="space-y-4">
        {error && (
          <div className="p-3 text-xs text-rose-700 bg-rose-50 border border-rose-200/80 rounded-lg">
            {error}
          </div>
        )}

        <Textarea
          label="Engineering Feature Brief"
          rows={4}
          required
          value={brief}
          onChange={(e) => setBrief(e.target.value)}
          placeholder="Describe deliverables, architecture, constraints, and dependencies..."
          helperText="Structured LLM planner transforms this brief into tasks and finish-to-start dependencies."
        />

        {/* Quick Engineering Templates */}
        <div className="space-y-1.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
            Quick Architecture Templates:
          </span>
          <div className="space-y-1">
            {SAMPLE_BRIEFS.map((sample, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setBrief(sample)}
                className="w-full text-left text-[11px] text-slate-700 hover:text-blue-600 bg-slate-50 hover:bg-blue-50/70 p-2 rounded-lg border border-slate-200/80 transition-colors line-clamp-1"
              >
                <span className="text-purple-600 font-bold mr-1.5">↳</span>
                {sample}
              </button>
            ))}
          </div>
        </div>

        {/* Human-in-the-Loop Security Guardrail */}
        <div className="p-3.5 bg-blue-50/70 border border-blue-200/80 rounded-lg text-blue-900 text-xs leading-relaxed space-y-1">
          <div className="flex items-center gap-1.5 font-bold text-blue-800">
            <ShieldIcon className="w-3.5 h-3.5 text-blue-600" />
            <span>Human Approval Guardrail</span>
          </div>
          <p className="text-[11px] text-blue-800/90 leading-relaxed">
            All generated items are staged as a <strong>PENDING Proposal</strong> with exact before/after diffs. No database tasks or edges will be created in {projectKey} until an authorized team member explicitly reviews and approves.
          </p>
        </div>

        <div className="pt-3 flex items-center justify-end gap-2.5">
          <Button type="button" variant="ghost" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            isLoading={loading}
            disabled={!brief.trim()}
            leftIcon={!loading ? <SparklesIcon className="w-3.5 h-3.5" /> : undefined}
          >
            Generate Proposal
          </Button>
        </div>
      </form>
    </Modal>
  );
}
