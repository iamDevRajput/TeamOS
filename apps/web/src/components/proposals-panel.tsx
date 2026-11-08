'use client';

import React, { useState, useEffect } from 'react';
import type { ProposalDto, TaskDto, OrgRole } from '@teamos/contracts';
import { CreateProposalModal } from './create-proposal-modal';
import { ProposalDetailModal } from './proposal-detail-modal';
import { AiPlanGeneratorModal } from './ai-plan-generator-modal';

interface ProposalsPanelProps {
  orgId: string;
  projectId: string;
  projectKey: string;
  tasks: TaskDto[];
  currentUserRole: OrgRole;
  apiBaseUrl: string;
  refreshKey?: number;
  onProposalApplied?: () => void;
}

export function ProposalsPanel({
  orgId,
  projectId,
  projectKey,
  tasks,
  currentUserRole,
  apiBaseUrl,
  refreshKey = 0,
  onProposalApplied,
}: ProposalsPanelProps) {
  const [proposals, setProposals] = useState<ProposalDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [selectedProposal, setSelectedProposal] = useState<ProposalDto | null>(null);
  const [localRefresh, setLocalRefresh] = useState(0);

  useEffect(() => {
    async function loadProposals() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `${apiBaseUrl}/api/v1/orgs/${orgId}/projects/${projectId}/proposals`,
          { credentials: 'include' },
        );
        if (res.ok) {
          const data: ProposalDto[] = await res.json();
          setProposals(data);
        } else {
          throw new Error('Failed to load proposals.');
        }
      } catch (err: any) {
        setError(err.message || 'Error loading proposals.');
      } finally {
        setLoading(false);
      }
    }

    loadProposals();
  }, [orgId, projectId, apiBaseUrl, refreshKey, localRefresh]);

  function handleSuccess() {
    setLocalRefresh((k) => k + 1);
    onProposalApplied?.();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-slate-900">
              Project Proposals & Plans
            </h3>
            <span className="text-[10px] font-bold uppercase bg-slate-100 text-slate-600 px-2 py-0.5 rounded border border-slate-200">
              Human Review & Concurrency Checked
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Structured change sets, AI plans, and status proposals. Changes only mutate the project when an authorized admin approves.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setAiModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-lg shadow-sm transition-colors whitespace-nowrap"
          >
            <span>🤖</span> AI Plan Generator
          </button>
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-colors whitespace-nowrap"
          >
            <span>+</span> New Proposal
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg">
          {error}
        </div>
      )}

      {loading ? (
        <div className="p-8 text-center text-xs text-slate-400">Loading proposals...</div>
      ) : proposals.length === 0 ? (
        <div className="p-10 text-center bg-white rounded-xl border border-dashed border-slate-200 space-y-2">
          <div className="text-2xl">📝</div>
          <h4 className="text-sm font-bold text-slate-800">No proposals yet</h4>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Create structured plans of tasks and dependencies for team review and atomic application.
          </p>
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="px-3 py-1.5 text-xs font-semibold text-blue-600 hover:text-blue-800 font-medium"
          >
            + Submit First Proposal
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {proposals.map((p) => {
            const taskCount = p.payload.tasksToCreate?.length || 0;
            const depCount = p.payload.dependenciesToAdd?.length || 0;

            return (
              <div
                key={p.id}
                onClick={() => setSelectedProposal(p)}
                className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:shadow transition-shadow cursor-pointer flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 group"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${
                        p.state === 'APPROVED'
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : p.state === 'REJECTED'
                          ? 'bg-rose-50 text-rose-800 border-rose-200'
                          : 'bg-blue-50 text-blue-800 border-blue-200'
                      }`}
                    >
                      {p.state}
                    </span>
                    <h4 className="text-sm font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                      {p.title}
                    </h4>
                  </div>
                  <p className="text-xs text-slate-500">
                    By @{p.creatorLogin || 'user'} • {new Date(p.createdAt).toLocaleDateString()}
                    {p.description ? ` • "${p.description}"` : ''}
                  </p>
                </div>

                <div className="flex items-center gap-3 text-xs text-slate-400">
                  <span className="bg-slate-50 px-2 py-0.5 rounded border border-slate-200 text-slate-600 font-mono text-[11px]">
                    +{taskCount} tasks, +{depCount} deps
                  </span>
                  <span className="text-slate-300">➔</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modals */}
      <CreateProposalModal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        orgId={orgId}
        projectId={projectId}
        projectKey={projectKey}
        tasks={tasks}
        apiBaseUrl={apiBaseUrl}
        onSuccess={handleSuccess}
      />

      <ProposalDetailModal
        isOpen={Boolean(selectedProposal)}
        onClose={() => setSelectedProposal(null)}
        proposal={selectedProposal}
        orgId={orgId}
        projectKey={projectKey}
        currentUserRole={currentUserRole}
        apiBaseUrl={apiBaseUrl}
        onUpdated={handleSuccess}
      />

      <AiPlanGeneratorModal
        isOpen={aiModalOpen}
        onClose={() => setAiModalOpen(false)}
        orgId={orgId}
        projectId={projectId}
        projectKey={projectKey}
        apiBaseUrl={apiBaseUrl}
        onPlanGenerated={(newProposal) => {
          handleSuccess();
          setSelectedProposal(newProposal);
        }}
      />
    </div>
  );
}
