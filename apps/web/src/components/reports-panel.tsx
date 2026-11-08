'use client';

import React, { useEffect, useState } from 'react';
import type { ProjectReportDto } from '@teamos/contracts';
import { ReportDetailModal } from './report-detail-modal';

interface ReportsPanelProps {
  orgId: string;
  projectId: string;
  apiBaseUrl: string;
}

export function ReportsPanel({ orgId, projectId, apiBaseUrl }: ReportsPanelProps) {
  const [reports, setReports] = useState<ProjectReportDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedReport, setSelectedReport] = useState<ProjectReportDto | null>(null);

  async function loadReports() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `${apiBaseUrl}/api/v1/orgs/${orgId}/projects/${projectId}/reports`,
        { credentials: 'include' },
      );
      if (res.ok) {
        const data = await res.json();
        setReports(data);
      } else {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || 'Failed to load project reports.');
      }
    } catch (err: any) {
      setError(err.message || 'Error loading reports.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadReports();
  }, [orgId, projectId, apiBaseUrl]);

  async function handleGenerateReport() {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch(
        `${apiBaseUrl}/api/v1/orgs/${orgId}/projects/${projectId}/reports`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({}),
        },
      );

      if (res.ok) {
        const newReport: ProjectReportDto = await res.json();
        setReports((prev) => [newReport, ...prev]);
        setSelectedReport(newReport);
      } else {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || 'Failed to generate health report.');
      }
    } catch (err: any) {
      setError(err.message || 'Error generating health report.');
    } finally {
      setGenerating(false);
    }
  }

  const riskBadge = (risk: string) => {
    switch (risk) {
      case 'LOW':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'MEDIUM':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'HIGH':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      default:
        return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-slate-900">Evidence-Backed Health Reports</h3>
            <span className="text-[11px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">
              Phase I Ground Truth
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1 max-w-xl">
            Authoritative delivery reports compiled from deterministic CPM graph calculations and immutable task snapshots. All claims cite verified entity citations.
          </p>
        </div>

        <button
          type="button"
          onClick={handleGenerateReport}
          disabled={generating}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-xl shadow-xs transition-colors whitespace-nowrap"
        >
          {generating ? 'Verifying & Generating…' : '+ Generate Health Report'}
        </button>
      </div>

      {error && (
        <div className="p-3 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-xl">
          {error}
        </div>
      )}

      {loading ? (
        <div className="p-12 text-center text-xs text-slate-400">Loading reports…</div>
      ) : reports.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-dashed border-slate-200 space-y-3">
          <div className="text-3xl">📊</div>
          <h4 className="text-base font-bold text-slate-900">No reports generated yet</h4>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Generate your first evidence-backed delivery health snapshot to track milestone delivery risk with zero hallucinations.
          </p>
          <button
            type="button"
            onClick={handleGenerateReport}
            disabled={generating}
            className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-xl shadow-xs transition-colors"
          >
            + Generate First Report
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {reports.map((report) => (
            <div
              key={report.id}
              onClick={() => setSelectedReport(report)}
              className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs hover:border-blue-300 hover:shadow-md transition-all cursor-pointer flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${riskBadge(
                      report.deliveryRisk,
                    )}`}
                  >
                    {report.deliveryRisk} RISK
                  </span>
                  <span className="text-[11px] font-mono text-slate-400">
                    {new Date(report.createdAt).toLocaleDateString()}
                  </span>
                </div>

                <h4 className="text-sm font-bold text-slate-900 mb-1">{report.title}</h4>
                <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                  {report.summary}
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                <span className="font-mono bg-slate-50 px-2 py-0.5 rounded border border-slate-100">
                  Hash: {report.snapshotHash.slice(0, 8)}…
                </span>
                <span className="text-blue-600 font-semibold group-hover:underline">
                  View Full Report →
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedReport && (
        <ReportDetailModal
          report={selectedReport}
          onClose={() => setSelectedReport(null)}
        />
      )}
    </div>
  );
}

