'use client';

import React, { useState, useEffect } from 'react';
import type {
  ProjectRiskReportDto,
  TaskDto,
  WhatIfScenarioResultDto,
} from '@teamos/contracts';
import { Badge, Button } from './ui';
import {
  ActivityIcon,
  AlertTriangleIcon,
  CheckCircleIcon,
  ClockIcon,
  CalendarIcon,
  SlidersIcon,
  ArrowRightIcon,
} from './ui/icons';

interface RiskOverviewPanelProps {
  orgId: string;
  projectId: string;
  projectKey: string;
  tasks: TaskDto[];
  apiBaseUrl: string;
  refreshKey?: number;
}

export function RiskOverviewPanel({
  orgId,
  projectId,
  projectKey,
  tasks,
  apiBaseUrl,
  refreshKey = 0,
}: RiskOverviewPanelProps) {
  const [riskReport, setRiskReport] = useState<ProjectRiskReportDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // What-If Simulation State
  const [simulationTaskId, setSimulationTaskId] = useState('');
  const [simulatedEstimate, setSimulatedEstimate] = useState<string>('');
  const [simulating, setSimulating] = useState(false);
  const [simulationResult, setSimulationResult] = useState<WhatIfScenarioResultDto | null>(null);
  const [simError, setSimError] = useState<string | null>(null);

  useEffect(() => {
    async function loadRisk() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `${apiBaseUrl}/api/v1/orgs/${orgId}/projects/${projectId}/risk`,
          { credentials: 'include' },
        );
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.message || 'Failed to load risk report');
        }
        const data: ProjectRiskReportDto = await res.json();
        setRiskReport(data);
      } catch (err: any) {
        setError(err.message || 'Error loading risk data.');
      } finally {
        setLoading(false);
      }
    }

    loadRisk();
  }, [orgId, projectId, apiBaseUrl, refreshKey]);

  async function handleRunSimulation() {
    if (!simulationTaskId || !simulatedEstimate) return;
    setSimulating(true);
    setSimError(null);

    try {
      const res = await fetch(
        `${apiBaseUrl}/api/v1/orgs/${orgId}/projects/${projectId}/risk/what-if`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            estimateOverrides: [
              {
                taskId: simulationTaskId,
                remainingEstimateWorkdays: Number(simulatedEstimate),
              },
            ],
          }),
        },
      );

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || 'What-If simulation failed');
      }

      const sim: WhatIfScenarioResultDto = await res.json();
      setSimulationResult(sim);
    } catch (err: any) {
      setSimError(err.message || 'Simulation error.');
    } finally {
      setSimulating(false);
    }
  }

  function handleResetSimulation() {
    setSimulationResult(null);
    setSimulationTaskId('');
    setSimulatedEstimate('');
    setSimError(null);
  }

  if (loading) {
    return (
      <div className="bg-white p-12 rounded-xl border border-slate-200/90 text-center space-y-3 shadow-xs">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent mx-auto" />
        <p className="text-xs text-slate-500 font-medium">Calculating Critical Path Method & Delivery Risk...</p>
      </div>
    );
  }

  if (error || !riskReport) {
    return (
      <div className="p-4 bg-rose-50 border border-rose-200/80 rounded-xl text-xs text-rose-700">
        {error || 'Could not load project risk report.'}
      </div>
    );
  }

  const taskMap = new Map(tasks.map((t) => [t.id, t]));
  const criticalTasks = (riskReport.criticalPathTaskIds || []).map((id) =>
    taskMap.get(id),
  );

  return (
    <div className="space-y-6">
      {/* Top Executive Delivery Forecast Card */}
      <div className="bg-white rounded-xl border border-slate-200/90 p-5 sm:p-6 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-slate-900 tracking-tight">
                Delivery Risk Intelligence
              </h3>
              <Badge variant="purple" size="xs">
                CPM Deterministic
              </Badge>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Deterministic Critical Path Method calculation grounded in finish-to-start constraints.
            </p>
          </div>

          <div>
            {riskReport.isDelayed ? (
              <Badge variant="danger" size="md" dot>
                Delivery At Risk (+{riskReport.deliveryVarianceWorkdays}d Late)
              </Badge>
            ) : riskReport.forecastDeliveryDate ? (
              <Badge variant="success" size="md" dot>
                On Track for Delivery
              </Badge>
            ) : (
              <Badge variant="warning" size="md" dot>
                Estimates Required
              </Badge>
            )}
          </div>
        </div>

        {/* 4-KPI Executive Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 bg-slate-50/80 rounded-xl border border-slate-200/80 space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Target Delivery Date
            </span>
            <div className="text-base font-bold text-slate-900 font-mono">
              {riskReport.targetDeliveryDate || 'Not set'}
            </div>
            <p className="text-[10px] text-slate-400">Committed project deadline</p>
          </div>

          <div className="p-4 bg-slate-50/80 rounded-xl border border-slate-200/80 space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Forecast Delivery Date
            </span>
            <div
              className={`text-base font-bold font-mono ${
                riskReport.isDelayed ? 'text-rose-600' : 'text-slate-900'
              }`}
            >
              {riskReport.forecastDeliveryDate || 'Unknown'}
            </div>
            <p className="text-[10px] text-slate-400">
              {riskReport.isDelayed
                ? `Delayed by ${riskReport.deliveryVarianceWorkdays} workdays`
                : 'Meets schedule threshold'}
            </p>
          </div>

          <div className="p-4 bg-slate-50/80 rounded-xl border border-slate-200/80 space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Longest Path Duration
            </span>
            <div className="text-base font-bold text-slate-900 font-mono">
              {riskReport.maxDurationWorkdays} workdays
            </div>
            <p className="text-[10px] text-slate-400">Sequential critical effort</p>
          </div>

          <div className="p-4 bg-slate-50/80 rounded-xl border border-slate-200/80 space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Critical Path Tasks
            </span>
            <div className="text-base font-bold text-blue-600 font-mono">
              {riskReport.criticalPathTaskIds.length} tasks
            </div>
            <p className="text-[10px] text-slate-400">Zero total slack</p>
          </div>
        </div>

        {/* Critical Path Visual Sequence */}
        <div className="pt-2 space-y-2.5">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
              Critical Path (Zero Slack Pipeline)
            </h4>
            <span className="text-[10px] text-slate-400">Any delay here directly delays project delivery</span>
          </div>

          {criticalTasks.length === 0 ? (
            <p className="text-xs text-slate-400 italic">No critical path identified.</p>
          ) : (
            <div className="flex flex-wrap items-center gap-2 pt-1">
              {criticalTasks.map((t, idx) => (
                <React.Fragment key={t?.id || idx}>
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50/70 border border-blue-200/80 rounded-lg text-xs font-semibold text-blue-900 shadow-xs">
                    <span className="font-mono text-[11px] text-blue-700 font-bold">
                      {projectKey}-{t?.number}
                    </span>
                    <span className="max-w-[140px] truncate">{t?.title}</span>
                    <span className="text-[10px] font-mono text-blue-600 font-medium">
                      {t?.remainingEstimateWorkdays || 0}d
                    </span>
                  </div>
                  {idx < criticalTasks.length - 1 && (
                    <ArrowRightIcon className="w-3.5 h-3.5 text-slate-300" />
                  )}
                </React.Fragment>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* What-If Simulation Sandbox */}
      <div className="bg-white rounded-xl border border-slate-200/90 p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <SlidersIcon className="w-4 h-4 text-purple-600" />
              <h3 className="text-sm font-bold text-slate-900 tracking-tight">
                What-If Simulation Sandbox
              </h3>
              <Badge variant="purple" size="xs">
                Zero DB Side-Effects
              </Badge>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Simulate hypothetical estimate changes or schedule slippage in-memory to test downstream delivery impacts.
            </p>
          </div>

          {simulationResult && (
            <button
              type="button"
              onClick={handleResetSimulation}
              className="text-xs text-slate-500 hover:text-slate-800 font-semibold underline"
            >
              Reset Scenario
            </button>
          )}
        </div>

        {simError && (
          <div className="p-3 text-xs text-rose-700 bg-rose-50 border border-rose-200/80 rounded-lg">
            {simError}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
          <div className="sm:col-span-2 space-y-1.5">
            <label className="block text-xs font-semibold text-slate-700">
              Select Task to Modify
            </label>
            <select
              value={simulationTaskId}
              onChange={(e) => {
                setSimulationTaskId(e.target.value);
                const t = tasks.find((item) => item.id === e.target.value);
                if (t && t.remainingEstimateWorkdays !== undefined) {
                  setSimulatedEstimate(String(t.remainingEstimateWorkdays));
                }
              }}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 shadow-xs"
            >
              <option value="">-- Choose a task to simulate --</option>
              {tasks.map((t) => (
                <option key={t.id} value={t.id}>
                  {projectKey}-{t.number}: {t.title} (Current: {t.remainingEstimateWorkdays ?? 0}d)
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-700">
              Simulated Workdays
            </label>
            <div className="flex gap-2">
              <input
                type="number"
                min="0"
                max="365"
                value={simulatedEstimate}
                onChange={(e) => setSimulatedEstimate(e.target.value)}
                placeholder="Days"
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 shadow-xs font-mono"
              />
              <Button
                type="button"
                variant="primary"
                size="md"
                disabled={!simulationTaskId || !simulatedEstimate || simulating}
                onClick={handleRunSimulation}
                isLoading={simulating}
              >
                Simulate
              </Button>
            </div>
          </div>
        </div>

        {/* Simulation Output Card */}
        {simulationResult && (
          <div className="mt-4 p-4 rounded-xl border border-blue-200/90 bg-blue-50/40 space-y-3 animate-in fade-in duration-150">
            <div className="flex items-center justify-between pb-2 border-b border-blue-200/60">
              <span className="text-xs font-bold text-blue-900 uppercase tracking-wide">
                Simulation Results
              </span>
              <Badge
                variant={
                  simulationResult.varianceWorkdays > 0
                    ? 'danger'
                    : simulationResult.varianceWorkdays < 0
                    ? 'success'
                    : 'default'
                }
                size="sm"
                dot
              >
                {simulationResult.varianceWorkdays > 0
                  ? `+${simulationResult.varianceWorkdays} Workdays Delay`
                  : simulationResult.varianceWorkdays < 0
                  ? `${simulationResult.varianceWorkdays} Workdays Saved`
                  : 'No Net Delivery Impact (Absorbed by Slack)'}
              </Badge>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="bg-white p-3 rounded-lg border border-blue-100">
                <span className="text-slate-400 block text-[11px] mb-0.5">Baseline Forecast:</span>
                <span className="font-mono font-bold text-slate-800 text-sm">
                  {simulationResult.baselineForecastDeliveryDate || 'Unknown'}
                </span>
              </div>

              <div className="bg-white p-3 rounded-lg border border-blue-100">
                <span className="text-slate-400 block text-[11px] mb-0.5">Simulated Forecast:</span>
                <span className="font-mono font-bold text-blue-700 text-sm">
                  {simulationResult.scenarioForecastDeliveryDate || 'Unknown'}
                </span>
              </div>
            </div>

            {simulationResult.impactedTaskIds.length > 0 && (
              <div className="pt-2 border-t border-blue-200/60 text-xs space-y-1.5">
                <span className="text-slate-700 font-semibold block">
                  Downstream Impacted Tasks ({simulationResult.impactedTaskIds.length}):
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {simulationResult.impactedTaskIds.map((id) => {
                    const task = taskMap.get(id);
                    return (
                      <span
                        key={id}
                        className="font-mono text-[10px] bg-white border border-blue-200 text-slate-800 px-2 py-0.5 rounded font-medium"
                      >
                        {projectKey}-{task?.number || '?'}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
