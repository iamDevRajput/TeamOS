'use client';

import React, { useState, useEffect, useMemo } from 'react';
import type {
  ProjectRiskReportDto,
  ProjectRiskHistoryDto,
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
  UsersIcon,
  ShieldIcon,
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
  const [riskHistory, setRiskHistory] = useState<ProjectRiskHistoryDto[]>([]);
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
        const [riskRes, histRes] = await Promise.all([
          fetch(`${apiBaseUrl}/api/v1/orgs/${orgId}/projects/${projectId}/risk`, {
            credentials: 'include',
          }),
          fetch(
            `${apiBaseUrl}/api/v1/orgs/${orgId}/projects/${projectId}/risk/history?days=30`,
            { credentials: 'include' },
          ),
        ]);

        if (!riskRes.ok) {
          const data = await riskRes.json().catch(() => ({}));
          throw new Error(data.message || 'Failed to load risk report');
        }
        const data: ProjectRiskReportDto = await riskRes.json();
        setRiskReport(data);

        if (histRes.ok) {
          const histData: ProjectRiskHistoryDto[] = await histRes.json();
          setRiskHistory(histData);
        }
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

  const taskMap = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks]);

  const criticalTasks = useMemo(
    () => (riskReport?.criticalPathTaskIds || []).map((id) => taskMap.get(id)),
    [riskReport, taskMap],
  );

  const assigneeCriticalLoad = useMemo(() => {
    const map = new Map<string, { name: string; count: number; taskKeys: string[] }>();
    criticalTasks.forEach((t) => {
      if (t && t.status !== 'DONE' && t.status !== 'CANCELLED') {
        const key = t.assigneeId || 'unassigned';
        const name = t.assigneeName ? `@${t.assigneeName}` : 'Unassigned';
        const existing = map.get(key) || { name, count: 0, taskKeys: [] };
        existing.count += 1;
        existing.taskKeys.push(`${projectKey}-${t.number}`);
        map.set(key, existing);
      }
    });
    return Array.from(map.values()).filter((item) => item.count > 1);
  }, [criticalTasks, projectKey]);

  const trendPoints = useMemo(() => {
    return riskHistory.map((h) => ({
      date: h.snapshotDate.slice(5, 10),
      score:
        h.scheduleVarianceDays > 0
          ? Math.min(100, Math.max(10, h.scheduleVarianceDays * 15))
          : h.riskLevel === 'HIGH'
          ? 80
          : h.riskLevel === 'MEDIUM'
          ? 45
          : 15,
      critical: h.criticalTaskCount,
      blocked: 0,
    }));
  }, [riskHistory]);

  if (loading) {
    return (
      <div className="bg-white dark:bg-slate-900 p-12 rounded-xl border border-slate-200/90 dark:border-slate-800 text-center space-y-3 shadow-xs">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent mx-auto" />
        <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Calculating Critical Path Method & Delivery Risk...</p>
      </div>
    );
  }

  if (error || !riskReport) {
    return (
      <div className="p-4 bg-rose-50 dark:bg-rose-950/30 border border-rose-200/80 dark:border-rose-900/50 rounded-xl text-xs text-rose-700 dark:text-rose-400">
        {error || 'Could not load project risk report.'}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Assignee Capacity Bottleneck Warning */}
      {assigneeCriticalLoad.length > 0 && (
        <div className="p-4 bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200/90 dark:border-amber-800/80 rounded-xl space-y-2">
          <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 font-bold text-xs">
            <AlertTriangleIcon className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <span>Engineer Capacity Bottleneck Detected</span>
          </div>
          <div className="text-xs text-amber-700/90 dark:text-amber-400/90 space-y-1">
            {assigneeCriticalLoad.map((b) => (
              <p key={b.name} className="leading-relaxed">
                <strong>{b.name}</strong> is assigned to <strong>{b.count} critical path tasks</strong> ({b.taskKeys.join(', ')}). Multiple serial critical path items on a single engineer eliminate concurrency and introduce single-point-of-failure risk.
              </p>
            ))}
          </div>
        </div>
      )}
      {/* Top Executive Delivery Forecast Card */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/90 dark:border-slate-800 p-5 sm:p-6 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 tracking-tight">
                Delivery Risk Intelligence
              </h3>
              <Badge variant="purple" size="xs">
                CPM Deterministic
              </Badge>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
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
          <div className="p-4 bg-slate-50/80 dark:bg-slate-950/50 rounded-xl border border-slate-200/80 dark:border-slate-800/80 space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Target Delivery Date
            </span>
            <div className="text-base font-bold text-slate-900 dark:text-slate-100 font-mono">
              {riskReport.targetDeliveryDate || 'Not set'}
            </div>
            <p className="text-[10px] text-slate-400 dark:text-slate-500">Committed project deadline</p>
          </div>

          <div className="p-4 bg-slate-50/80 dark:bg-slate-950/50 rounded-xl border border-slate-200/80 dark:border-slate-800/80 space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Forecast Delivery Date
            </span>
            <div
              className={`text-base font-bold font-mono ${
                riskReport.isDelayed ? 'text-rose-600 dark:text-rose-400' : 'text-slate-900 dark:text-slate-100'
              }`}
            >
              {riskReport.forecastDeliveryDate || 'Unknown'}
            </div>
            <p className="text-[10px] text-slate-400 dark:text-slate-500">
              {riskReport.isDelayed
                ? `Delayed by ${riskReport.deliveryVarianceWorkdays} workdays`
                : 'Meets schedule threshold'}
            </p>
          </div>

          <div className="p-4 bg-slate-50/80 dark:bg-slate-950/50 rounded-xl border border-slate-200/80 dark:border-slate-800/80 space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Longest Path Duration
            </span>
            <div className="text-base font-bold text-slate-900 dark:text-slate-100 font-mono">
              {riskReport.maxDurationWorkdays} workdays
            </div>
            <p className="text-[10px] text-slate-400 dark:text-slate-500">Sequential critical effort</p>
          </div>

          <div className="p-4 bg-slate-50/80 dark:bg-slate-950/50 rounded-xl border border-slate-200/80 dark:border-slate-800/80 space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Critical Path Tasks
            </span>
            <div className="text-base font-bold text-blue-600 dark:text-blue-400 font-mono">
              {riskReport.criticalPathTaskIds.length} tasks
            </div>
            <p className="text-[10px] text-slate-400 dark:text-slate-500">Zero total slack</p>
          </div>
        </div>

        {/* Critical Path Visual Sequence */}
        <div className="pt-2 space-y-2.5">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
              Critical Path (Zero Slack Pipeline)
            </h4>
            <span className="text-[10px] text-slate-400 dark:text-slate-500">Any delay here directly delays project delivery</span>
          </div>

          {criticalTasks.length === 0 ? (
            <p className="text-xs text-slate-400 dark:text-slate-500 italic">No critical path identified.</p>
          ) : (
            <div className="flex flex-wrap items-center gap-2 pt-1">
              {criticalTasks.map((t, idx) => (
                <React.Fragment key={t?.id || idx}>
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200/80 dark:border-blue-900/60 rounded-lg text-xs font-semibold text-blue-900 dark:text-blue-200 shadow-xs">
                    <span className="font-mono text-[11px] text-blue-700 dark:text-blue-400 font-bold">
                      {projectKey}-{t?.number}
                    </span>
                    <span className="max-w-[140px] truncate">{t?.title}</span>
                    <span className="text-[10px] font-mono text-blue-600 dark:text-blue-400 font-medium">
                      {t?.remainingEstimateWorkdays || 0}d
                    </span>
                  </div>
                  {idx < criticalTasks.length - 1 && (
                    <ArrowRightIcon className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600" />
                  )}
                </React.Fragment>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Delivery Risk & Schedule Stability Telemetry */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/90 dark:border-slate-800 p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <ActivityIcon className="w-4 h-4 text-blue-600 dark:text-sky-400" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 tracking-tight">
                Delivery Risk & Schedule Stability Telemetry
              </h3>
              <Badge variant={riskHistory.length > 0 ? "info" : "neutral"} size="xs">
                {riskHistory.length > 0
                  ? `${riskHistory.length} Snapshot${riskHistory.length > 1 ? 's' : ''} Recorded`
                  : 'Telemetry Initialized'}
              </Badge>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Daily telemetry tracking risk score, critical path volume, and bottleneck trajectory over time.
            </p>
          </div>

          {riskHistory.length > 0 && (
            <div className="flex items-center gap-3 text-[11px] text-slate-500 font-mono">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500" /> Risk Score
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-400" /> Daily Snapshots
              </span>
            </div>
          )}
        </div>

        {/* Telemetry Visualizer: Empty State, Single Point, or Sparkline */}
        <div className="pt-2">
          {riskHistory.length === 0 ? (
            <div className="p-6 bg-slate-50/60 dark:bg-slate-950/40 rounded-lg border border-dashed border-slate-200 dark:border-slate-800 text-center space-y-1.5">
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Telemetry Collection Active
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                Daily delivery risk snapshots are automatically recorded as the project progresses. No historical snapshots exist prior to collection initiation.
              </p>
            </div>
          ) : riskHistory.length === 1 ? (
            <div className="p-4 bg-slate-50/60 dark:bg-slate-950/40 rounded-lg border border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  Initial Snapshot Recorded ({trendPoints[0].date})
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Calculated Risk Score: {trendPoints[0].score}% &bull; Critical Path Tasks: {trendPoints[0].critical}
                </p>
              </div>
              <Badge variant="purple" size="xs">Baseline Recorded Today</Badge>
            </div>
          ) : (
            <div className="relative w-full h-36 bg-slate-50/60 dark:bg-slate-950/40 rounded-lg p-3 border border-slate-100 dark:border-slate-800/80 overflow-hidden flex flex-col justify-between">
              <svg viewBox="0 0 700 100" className="w-full h-24 overflow-visible" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="riskArea" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.25" />
                    <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.0" />
                  </linearGradient>
                </defs>

                {/* Horizontal Reference Lines */}
                <line x1="0" y1="25" x2="700" y2="25" stroke="#cbd5e1" strokeDasharray="3 3" opacity="0.35" />
                <line x1="0" y1="50" x2="700" y2="50" stroke="#cbd5e1" strokeDasharray="3 3" opacity="0.35" />
                <line x1="0" y1="75" x2="700" y2="75" stroke="#cbd5e1" strokeDasharray="3 3" opacity="0.35" />

                {/* Area Fill */}
                <polygon
                  fill="url(#riskArea)"
                  points={`0,100 ${trendPoints
                    .map((p, idx) => {
                      const x = (idx / (trendPoints.length - 1)) * 700;
                      const y = 90 - (p.score / 100) * 80;
                      return `${x},${y}`;
                    })
                    .join(' ')} 700,100`}
                />

                {/* Trend Polyline */}
                <polyline
                  fill="none"
                  stroke="#3b82f6"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  points={trendPoints
                    .map((p, idx) => {
                      const x = (idx / (trendPoints.length - 1)) * 700;
                      const y = 90 - (p.score / 100) * 80;
                      return `${x},${y}`;
                    })
                    .join(' ')}
                />

                {/* Data points */}
                {trendPoints.map((p, idx) => {
                  const x = (idx / (trendPoints.length - 1)) * 700;
                  const y = 90 - (p.score / 100) * 80;
                  return (
                    <circle
                      key={idx}
                      cx={x}
                      cy={y}
                      r="3.5"
                      fill="#3b82f6"
                      className="hover:r-5 transition-all"
                    />
                  );
                })}
              </svg>

              {/* X-Axis Dates */}
              <div className="flex justify-between text-[10px] text-slate-400 font-mono px-1">
                {trendPoints.map((p, idx) => (
                  <span key={idx}>{p.date}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* What-If Simulation Sandbox */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/90 dark:border-slate-800 p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <SlidersIcon className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 tracking-tight">
                What-If Simulation Sandbox
              </h3>
              <Badge variant="purple" size="xs">
                Zero DB Side-Effects
              </Badge>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Simulate hypothetical estimate changes or schedule slippage in-memory to test downstream delivery impacts.
            </p>
          </div>

          {simulationResult && (
            <button
              type="button"
              onClick={handleResetSimulation}
              className="text-xs text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 font-semibold underline"
            >
              Reset Scenario
            </button>
          )}
        </div>

        {simError && (
          <div className="p-3 text-xs text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border border-rose-200/80 dark:border-rose-900/60 rounded-lg">
            {simError}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
          <div className="sm:col-span-2 space-y-1.5">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
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
              className="w-full px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 shadow-xs"
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
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
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
                className="w-full px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 rounded-lg text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 shadow-xs font-mono"
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
          <div className="mt-4 p-4 rounded-xl border border-blue-200/90 dark:border-blue-900/60 bg-blue-50/40 dark:bg-blue-950/20 space-y-3 animate-in fade-in duration-150">
            <div className="flex items-center justify-between pb-2 border-b border-blue-200/60 dark:border-blue-900/40">
              <span className="text-xs font-bold text-blue-900 dark:text-blue-300 uppercase tracking-wide">
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
              <div className="bg-white dark:bg-slate-900 p-3 rounded-lg border border-blue-100 dark:border-slate-800">
                <span className="text-slate-400 dark:text-slate-500 block text-[11px] mb-0.5">Baseline Forecast:</span>
                <span className="font-mono font-bold text-slate-800 dark:text-slate-200 text-sm">
                  {simulationResult.baselineForecastDeliveryDate || 'Unknown'}
                </span>
              </div>

              <div className="bg-white dark:bg-slate-900 p-3 rounded-lg border border-blue-100 dark:border-slate-800">
                <span className="text-slate-400 dark:text-slate-500 block text-[11px] mb-0.5">Simulated Forecast:</span>
                <span className="font-mono font-bold text-blue-700 dark:text-blue-400 text-sm">
                  {simulationResult.scenarioForecastDeliveryDate || 'Unknown'}
                </span>
              </div>
            </div>

            {simulationResult.impactedTaskIds.length > 0 && (
              <div className="pt-2 border-t border-blue-200/60 dark:border-blue-900/40 text-xs space-y-1.5">
                <span className="text-slate-700 dark:text-slate-300 font-semibold block">
                  Downstream Impacted Tasks ({simulationResult.impactedTaskIds.length}):
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {simulationResult.impactedTaskIds.map((id) => {
                    const task = taskMap.get(id);
                    return (
                      <span
                        key={id}
                        className="font-mono text-[10px] bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-800 text-slate-800 dark:text-slate-200 px-2 py-0.5 rounded font-medium"
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
