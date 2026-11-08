'use client';

import React, { useState } from 'react';
import type { OrgDto, ProjectDto, AuthMeResponseDto } from '@teamos/contracts';
import {
  ActivityIcon,
  SparklesIcon,
  CheckCircleIcon,
  FolderIcon,
  BuildingIcon,
  ShieldIcon,
  XIcon,
  ChevronRightIcon,
  ArrowRightIcon,
  CommandIcon,
} from './ui/icons';
import { Badge, Button } from './ui';

interface OnboardingWizardProps {
  isOpen: boolean;
  onClose: () => void;
  sessionData: AuthMeResponseDto;
  orgs: OrgDto[];
  activeOrg: OrgDto | null;
  onSelectOrg: (org: OrgDto) => void;
  projects: ProjectDto[];
  selectedProjectId: string | null;
  onSelectProject: (projectId: string) => void;
  onOpenCreateProject: () => void;
  onOpenCreateOrg: () => void;
}

export function OnboardingWizard({
  isOpen,
  onClose,
  sessionData,
  orgs,
  activeOrg,
  onSelectOrg,
  projects,
  selectedProjectId,
  onSelectProject,
  onOpenCreateProject,
  onOpenCreateOrg,
}: OnboardingWizardProps) {
  const [step, setStep] = useState<number>(1);
  const [selectedRole, setSelectedRole] = useState<string>('Engineering Lead');
  const [selectedGoal, setSelectedGoal] = useState<string>('Delivery Risk & Blockers');

  if (!isOpen) return null;

  const handleFinish = () => {
    try {
      localStorage.setItem('teamos_onboarding_completed', 'true');
    } catch {
      // Ignore storage errors
    }
    onClose();
  };

  const roles = [
    { id: 'Engineering Lead', label: 'Engineering Lead / Manager', desc: 'Forecast delivery dates and unblock teams' },
    { id: 'Product Manager', label: 'Product Manager', desc: 'Track milestone health and release timelines' },
    { id: 'Software Engineer', label: 'Senior Software Engineer', desc: 'Focus on critical-path tasks and dependency edges' },
  ];

  const goals = [
    { id: 'Delivery Risk & Blockers', label: 'Delivery Risk & Blockers', desc: 'Identify bottlenecks before dates slip' },
    { id: 'Dependency Graph Intelligence', label: 'Dependency Graph Intelligence', desc: 'Model finish-to-start task DAGs' },
    { id: 'AI Planning & Human Approvals', label: 'AI Planning & Human Approvals', desc: 'Generate verified execution proposals' },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-title"
    >
      <div className="w-full max-w-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-modal overflow-hidden transform transition-all text-slate-900 dark:text-slate-100">
        {/* Header with Progress Steps and Skip */}
        <div className="px-6 pt-5 pb-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center font-black text-xs">
              OS
            </div>
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                Getting Started
              </span>
              <span className="text-xs text-slate-400 ml-2">
                Step {step} of 4
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={handleFinish}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-xs font-medium"
            title="Skip onboarding"
          >
            Skip Tour ✕
          </button>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-slate-100 dark:bg-slate-800 h-1">
          <div
            className="bg-blue-600 dark:bg-blue-500 h-1 transition-all duration-300"
            style={{ width: `${(step / 4) * 100}%` }}
          />
        </div>

        {/* Step 1: Welcome & Value Proposition */}
        {step === 1 && (
          <div className="p-6 space-y-5">
            <div className="space-y-1.5">
              <h2 id="onboarding-title" className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
                Welcome to TeamOS, {sessionData.user.displayName || sessionData.user.login}!
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                TeamOS is a Delivery Risk Intelligence platform designed specifically for software engineering teams. We connect task dependencies, GitHub activity, and deterministic graph math to answer:
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-bold text-blue-600 dark:text-blue-400">
                  <ActivityIcon className="w-4 h-4" />
                  <span>Will we hit the release date?</span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Calculated via pure Critical Path Method (CPM) algorithms with zero hallucinations.
                </p>
              </div>

              <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-bold text-amber-600 dark:text-amber-400">
                  <ShieldIcon className="w-4 h-4" />
                  <span>What is blocking delivery?</span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Real-time dependency chain analysis isolates root blocker tasks immediately.
                </p>
              </div>

              <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-bold text-purple-600 dark:text-purple-400">
                  <SparklesIcon className="w-4 h-4" />
                  <span>AI Planning & Proposals</span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  AI proposes changes with structured diffs; engineers review and approve before commit.
                </p>
              </div>

              <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                  <CheckCircleIcon className="w-4 h-4" />
                  <span>Evidence-Backed Health</span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Cryptographically verifiable SHA-256 snapshots prove report data authenticity.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Confirm Workspace & Project */}
        {step === 2 && (
          <div className="p-6 space-y-5">
            <div className="space-y-1">
              <h2 className="text-lg font-bold tracking-tight text-slate-900 dark:text-slate-50">
                Confirm your Workspace & Project
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Your account is linked to your existing organizations. Choose which workspace to inspect:
              </p>
            </div>

            {/* Organizations list */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Active Organization
              </label>
              <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                {orgs.map((org) => {
                  const isSelected = activeOrg?.id === org.id;
                  return (
                    <button
                      key={org.id}
                      type="button"
                      onClick={() => onSelectOrg(org)}
                      className={`w-full flex items-center justify-between p-2.5 rounded-xl border text-left transition-all ${
                        isSelected
                          ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/30 text-blue-900 dark:text-blue-100 ring-1 ring-blue-500'
                          : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <BuildingIcon className="w-4 h-4 text-slate-500 shrink-0" />
                        <div>
                          <div className="text-xs font-bold">{org.name}</div>
                          <div className="text-[10px] text-slate-400 font-mono">Role: {org.role}</div>
                        </div>
                      </div>
                      {isSelected && (
                        <CheckCircleIcon className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Projects list */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Project ({projects.length} available)
              </label>
              {projects.length > 0 ? (
                <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                  {projects.map((proj) => {
                    const isSelected = selectedProjectId === proj.id;
                    return (
                      <button
                        key={proj.id}
                        type="button"
                        onClick={() => onSelectProject(proj.id)}
                        className={`w-full flex items-center justify-between p-2.5 rounded-xl border text-left transition-all ${
                          isSelected
                            ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/30 text-blue-900 dark:text-blue-100 ring-1 ring-blue-500'
                            : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <FolderIcon className="w-4 h-4 text-slate-500 shrink-0" />
                          <div>
                            <div className="text-xs font-bold">{proj.name}</div>
                            <div className="text-[10px] text-slate-400 font-mono">Key: {proj.key}</div>
                          </div>
                        </div>
                        {isSelected && (
                          <CheckCircleIcon className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                        )}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="p-3 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 text-center">
                  <p className="text-xs text-slate-500 mb-2">No projects yet in this workspace.</p>
                  <Button size="xs" variant="secondary" onClick={onOpenCreateProject}>
                    + Create First Project
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Step 3: Role & Delivery Goal */}
        {step === 3 && (
          <div className="p-6 space-y-5">
            <div className="space-y-1">
              <h2 className="text-lg font-bold tracking-tight text-slate-900 dark:text-slate-50">
                Personalize your TeamOS Experience
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Tell us about your team's primary focus to optimize layout density and alerts:
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                What is your primary engineering role?
              </label>
              <div className="grid grid-cols-1 gap-2">
                {roles.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setSelectedRole(r.id)}
                    className={`flex items-center justify-between p-3 rounded-xl border text-left transition-all ${
                      selectedRole === r.id
                        ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/30 ring-1 ring-blue-500'
                        : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                    }`}
                  >
                    <div>
                      <div className="text-xs font-bold text-slate-900 dark:text-slate-100">{r.label}</div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">{r.desc}</div>
                    </div>
                    {selectedRole === r.id && (
                      <CheckCircleIcon className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2 pt-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                What is your team's primary delivery objective?
              </label>
              <div className="grid grid-cols-1 gap-2">
                {goals.map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => setSelectedGoal(g.id)}
                    className={`flex items-center justify-between p-3 rounded-xl border text-left transition-all ${
                      selectedGoal === g.id
                        ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/30 ring-1 ring-blue-500'
                        : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                    }`}
                  >
                    <div>
                      <div className="text-xs font-bold text-slate-900 dark:text-slate-100">{g.label}</div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">{g.desc}</div>
                    </div>
                    {selectedGoal === g.id && (
                      <CheckCircleIcon className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Pro Shortcuts & Launch */}
        {step === 4 && (
          <div className="p-6 space-y-5">
            <div className="space-y-1">
              <h2 className="text-lg font-bold tracking-tight text-slate-900 dark:text-slate-50">
                You're ready to engineer with precision!
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Here are high-leverage keyboard shortcuts to navigate TeamOS like a senior engineer:
              </p>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-600 dark:text-slate-300 font-medium">Command Palette & Global Search</span>
                <kbd className="px-2 py-1 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono text-[11px] text-slate-500">
                  ⌘K / Ctrl+K
                </kbd>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-600 dark:text-slate-300 font-medium">Create New Work Item</span>
                <kbd className="px-2 py-1 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono text-[11px] text-slate-500">
                  C
                </kbd>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-600 dark:text-slate-300 font-medium">Toggle Sidebar</span>
                <kbd className="px-2 py-1 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono text-[11px] text-slate-500">
                  [
                </kbd>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-600 dark:text-slate-300 font-medium">Dismiss Modals / Overlays</span>
                <kbd className="px-2 py-1 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono text-[11px] text-slate-500">
                  Esc
                </kbd>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200/80 dark:border-blue-900/50 flex items-start gap-2.5">
              <ShieldIcon className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
              <p className="text-[11px] text-blue-800 dark:text-blue-300 leading-relaxed">
                <strong>Data Protection:</strong> All records are isolated per-tenant via PostgreSQL Row-Level Security. Your workspace data is strictly private and never exposed.
              </p>
            </div>
          </div>
        )}

        {/* Footer Navigation Buttons */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-900/90 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
          {step > 1 ? (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setStep(step - 1)}
            >
              Back
            </Button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2">
            {step < 4 ? (
              <Button
                variant="primary"
                size="sm"
                onClick={() => setStep(step + 1)}
              >
                Continue
                <ArrowRightIcon className="w-3.5 h-3.5 ml-1" />
              </Button>
            ) : (
              <Button
                variant="primary"
                size="sm"
                onClick={handleFinish}
              >
                Open TeamOS Workspace
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
