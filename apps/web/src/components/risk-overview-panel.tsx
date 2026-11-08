'use client';

import React, { useState, useEffect } from 'react';
import type {
  ProjectRiskReportDto,
  TaskDto,
  WhatIfScenarioResultDto,
} from '@teamos/contracts';

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
  const [simulationResult, setSimulationResult] = useState<WhatIfScenarioResultDto | null>(
    null,
  );
  const [simError, setSimError] = useState<string | null>(null);

  useEffect(() => {
    async function loadRisk() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `${apiBaseUrl}/api/v1/orgs/${orgId}/projects/${projectId}/risk`,
          {
            credentials: 'include',
          },
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
      <div className="bg-white p-8 rounded-xl border border-slate-200 text-center space-y-2">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent mx-auto" />
        <p className="text-xs text-slate-500">Calculating Critical Path Method & Delivery Risk...</p>
      </div>
    );
  }

  if (error || !riskReport) {
    return (
      <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700">
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
      {/* Top Level Delivery Forecast Card */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-black text-slate-900">
                Delivery Risk Intelligence
              </h3>
              <span className="font-mono text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded border border-slate-200">
                CPM Deterministic
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Deterministic Critical Path Method calculation grounded in finish-to-start constraints.
            </p>
          </div>

          <div>
            {riskReport.isDelayed ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase bg-rose-50 text-rose-700 border border-rose-200">
                <span>⚠️</span> Delivery At Risk (+{riskReport.deliveryVarianceWorkdays}d Late)
              </span>
            ) : riskReport.forecastDeliveryDate ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">
                <span>✓</span> On Track for Delivery
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase bg-amber-50 text-amber-800 border border-amber-200">
                <span>ℹ️</span> Missing Task Estimates
              </span>
            )}
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Target Due Date
            </span>
            <div className="text-base font-black text-slate-900 font-mono">
              {riskReport.targetDeliveryDate || 'Not set'}
            </div>
          </div>

          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Forecast Delivery Date
            </span>
            <div
              className={`text-base font-black font-mono ${
                riskReport.isDelayed ? 'text-rose-600' : 'text-slate-900'
              }`}
            >
              {riskReport.forecastDeliveryDate || 'Unknown'}
            </div>
          </div>

          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Longest Path Duration
            </span>
            <div className="text-base font-black text-slate-900">
              {riskReport.maxDurationWorkdays} workdays
            </div>
          </div>

          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Critical Path Tasks
            </span>
            <div className="text-base font-black text-blue-600">
              {riskReport.criticalPathTaskIds.length} tasks
            </div>
          </div>
        </div>

        {/* Critical Path Sequence */}
        <div className="pt-2 space-y-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
            Critical Path (Zero Slack)
          </h4>
          <p className="text-[11px] text-slate-400">
            Any delay in these tasks directly delays the project delivery date.
          </p>

          {criticalTasks.length === 0 ? (
            <p className="text-xs text-slate-400 italic">No critical path identified.</p>
          ) : (
            <div className="flex flex-wrap items-center gap-2 pt-1">
              {criticalTasks.map((t, idx) => (
                <React.Fragment key={t?.id || idx}>
                  <div className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 border border-blue-200 rounded-lg text-xs font-semibold text-blue-900">
                    <span className="font-mono text-[10px] text-blue-700">
                      {projectKey}-{t?.number}
                    </span>
                    <span>{t?.title}</span>
                    <span className="text-[10px] font-normal text-blue-600">
                      ({t?.remainingEstimateWorkdays || 0}d)
                    </span>
                  </div>
                  {idx < criticalTasks.length - 1 && (
                    <span className="text-slate-300 font-bold">➔</span>
                  )}
                </React.Fragment>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* What-If Simulation Sandbox */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-slate-900">
                What-If Simulation Sandbox
              </h3>
              <span className="text-[10px] bg-purple-50 text-purple-700 border border-purple-200 px-2 py-0.5 rounded-full font-bold uppercase">
                Zero DB Side-Effects
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
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
          <div className="p-3 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg">
            {simError}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
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
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select a task...</option>
              {tasks.map((t) => (
                <option key={t.id} value={t.id}>
                  {projectKey}-{t.number}: {t.title} (Current: {t.remainingEstimateWorkdays ?? 0}d)
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
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
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="button"
                disabled={!simulationTaskId || !simulatedEstimate || simulating}
                onClick={handleRunSimulation}
                className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg shadow-sm whitespace-nowrap transition-colors"
              >
                {simulating ? 'Simulating...' : 'Simulate'}
              </button>
            </div>
          </div>
        </div>

        {/* Simulation Output Card */}
        {simulationResult && (
          <div className="mt-4 p-4 rounded-xl border border-blue-200 bg-blue-50/50 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-blue-200/60">
              <span className="text-xs font-bold text-blue-900 uppercase tracking-wide">
                Simulation Results
              </span>
              <span
                className={`text-xs font-bold px-2 py-0.5 rounded ${
                  simulationResult.varianceWorkdays > 0
                    ? 'bg-rose-100 text-rose-800'
                    : simulationResult.varianceWorkdays < 0
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-slate-200 text-slate-700'
                }`}
              >
                {simulationResult.varianceWorkdays > 0
                  ? `+${simulationResult.varianceWorkdays} Workdays Delay`
                  : simulationResult.varianceWorkdays < 0
                  ? `${simulationResult.varianceWorkdays} Workdays Saved`
                  : 'No Net Delivery Impact (Absorbed by Slack)'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-slate-500 block">Baseline Delivery Date:</span>
                <span className="font-mono font-bold text-slate-800">
                  {simulationResult.baselineForecastDeliveryDate || 'Unknown'}
                </span>
              </div>

              <div>
                <span className="text-slate-500 block">Simulated Delivery Date:</span>
                <span className="font-mono font-bold text-blue-700">
                  {simulationResult.scenarioForecastDeliveryDate || 'Unknown'}
                </span>
              </div>
            </div>

            {simulationResult.impactedTaskIds.length > 0 && (
              <div className="pt-2 border-t border-blue-200/60 text-xs">
                <span className="text-slate-600 font-semibold block mb-1">
                  Downstream Impacted Tasks ({simulationResult.impactedTaskIds.length}):
                </span>
                <div className="flex flex-wrap gap-1">
                  {simulationResult.impactedTaskIds.map((id) => {
                    const task = taskMap.get(id);
                    return (
                      <span
                        key={id}
                        className="font-mono text-[10px] bg-white border border-blue-200 text-slate-700 px-1.5 py-0.5 rounded"
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

