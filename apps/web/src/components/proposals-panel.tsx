'use client';

import React, { useState, useEffect } from 'react';
import type { ProposalDto, TaskDto, OrgRole } from '@teamos/contracts';
import { Badge, Button, EmptyState } from './ui';
import { SparklesIcon, PlusIcon, FileTextIcon, CheckCircleIcon, ClockIcon } from './ui/icons';
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
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200/90 dark:border-slate-800 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 tracking-tight">
              Project Proposals & Plans
            </h3>
            <Badge variant="purple" size="xs">
              Human Review & Concurrency Guarded
            </Badge>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Structured change sets and AI plans. Changes only mutate the project when an authorized owner or admin approves.
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setAiModalOpen(true)}
            leftIcon={<SparklesIcon className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />}
            className="flex-1 sm:flex-initial"
          >
            AI Plan Generator
          </Button>
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={() => setCreateOpen(true)}
            leftIcon={<PlusIcon className="w-3.5 h-3.5" />}
            className="flex-1 sm:flex-initial"
          >
            New Proposal
          </Button>
        </div>
      </div>

      {error && (
        <div className="p-3 text-xs text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border border-rose-200/80 dark:border-rose-900/60 rounded-lg">
          {error}
        </div>
      )}

      {loading ? (
        <div className="p-8 text-center text-xs text-slate-400 dark:text-slate-500">Loading proposals...</div>
      ) : proposals.length === 0 ? (
        <EmptyState
          icon={<FileTextIcon className="w-5 h-5" />}
          title="No proposals submitted yet"
          description="Create structured plans of tasks and dependencies for team review, or generate one with the AI Plan Generator."
          action={
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setAiModalOpen(true)}>
                Use AI Generator
              </Button>
              <Button type="button" variant="primary" size="sm" onClick={() => setCreateOpen(true)}>
                Submit Proposal
              </Button>
            </div>
          }
        />
      ) : (
        <div className="space-y-2.5">
          {proposals.map((p) => {
            const taskCount = p.payload.tasksToCreate?.length || 0;
            const depCount = p.payload.dependenciesToAdd?.length || 0;

            return (
              <div
                key={p.id}
                onClick={() => setSelectedProposal(p)}
                className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200/90 dark:border-slate-800 shadow-xs hover:border-blue-500 dark:hover:border-blue-500 hover:shadow-card-hover transition-all cursor-pointer flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 group"
              >
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={
                        p.state === 'APPROVED'
                          ? 'success'
                          : p.state === 'REJECTED'
                          ? 'danger'
                          : 'info'
                      }
                      size="xs"
                    >
                      {p.state}
                    </Badge>
                    <span className="font-mono text-[10px] text-slate-400 dark:text-slate-500 font-medium">
                      {p.kind}
                    </span>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors truncate">
                      {p.title}
                    </h4>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    By @{p.creatorLogin || 'user'} • {new Date(p.createdAt).toLocaleDateString()}
                    {p.description ? ` • "${p.description}"` : ''}
                  </p>
                </div>

                <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 shrink-0">
                  <span className="bg-slate-50 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 px-2 py-0.5 rounded font-mono text-slate-700 dark:text-slate-300">
                    +{taskCount} tasks
                  </span>
                  {depCount > 0 && (
                    <span className="bg-slate-50 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 px-2 py-0.5 rounded font-mono text-slate-700 dark:text-slate-300">
                      +{depCount} edges
                    </span>
                  )}
                  <span className="text-blue-600 dark:text-blue-400 font-semibold group-hover:translate-x-0.5 transition-transform text-xs">
                    Review →
                  </span>
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

      <AiPlanGeneratorModal
        isOpen={aiModalOpen}
        onClose={() => setAiModalOpen(false)}
        orgId={orgId}
        projectId={projectId}
        projectKey={projectKey}
        apiBaseUrl={apiBaseUrl}
        onPlanGenerated={(proposal) => {
          setSelectedProposal(proposal);
          handleSuccess();
        }}
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
    </div>
  );
}
