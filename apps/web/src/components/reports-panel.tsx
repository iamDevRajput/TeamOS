'use client';

import React, { useEffect, useState } from 'react';
import type { ProjectReportDto } from '@teamos/contracts';
import { Badge, Button, EmptyState } from './ui';
import { FileTextIcon, ShieldIcon, CheckCircleIcon, PlusIcon } from './ui/icons';
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

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white p-5 rounded-xl border border-slate-200/90 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-slate-900 tracking-tight">Evidence-Backed Health Reports</h3>
            <Badge variant="info" size="xs">
              Verified Ground Truth
            </Badge>
          </div>
          <p className="text-xs text-slate-500 mt-0.5 max-w-xl">
            Authoritative delivery reports compiled from deterministic CPM graph calculations and immutable task snapshots. All claims cite verified entity citations.
          </p>
        </div>

        <Button
          type="button"
          variant="primary"
          size="sm"
          onClick={handleGenerateReport}
          isLoading={generating}
          leftIcon={<PlusIcon className="w-3.5 h-3.5" />}
        >
          {generating ? 'Verifying & Generating…' : 'Generate Health Report'}
        </Button>
      </div>

      {error && (
        <div className="p-3 text-xs text-rose-700 bg-rose-50 border border-rose-200/80 rounded-xl">
          {error}
        </div>
      )}

      {loading ? (
        <div className="p-12 text-center text-xs text-slate-400">Loading reports…</div>
      ) : reports.length === 0 ? (
        <EmptyState
          icon={<FileTextIcon className="w-5 h-5" />}
          title="No reports generated yet"
          description="Generate your first evidence-backed delivery health snapshot to track milestone delivery risk with zero hallucinations."
          action={
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={handleGenerateReport}
              isLoading={generating}
            >
              Generate First Report
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {reports.map((report) => (
            <div
              key={report.id}
              onClick={() => setSelectedReport(report)}
              className="bg-white p-5 rounded-xl border border-slate-200/90 shadow-xs hover:border-blue-500 hover:shadow-card-hover transition-all cursor-pointer flex flex-col justify-between group"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Badge
                    variant={
                      report.deliveryRisk === 'HIGH'
                        ? 'danger'
                        : report.deliveryRisk === 'MEDIUM'
                        ? 'warning'
                        : 'success'
                    }
                    size="xs"
                    dot
                  >
                    {report.deliveryRisk} RISK
                  </Badge>
                  <span className="text-[11px] font-mono text-slate-400">
                    {new Date(report.createdAt).toLocaleDateString()}
                  </span>
                </div>

                <h4 className="text-sm font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                  {report.title}
                </h4>
                <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                  {report.summary}
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                <span className="font-mono bg-slate-50 px-2 py-0.5 rounded border border-slate-200/80 text-[10px]">
                  Hash: {report.snapshotHash.slice(0, 8)}…
                </span>
                <span className="text-blue-600 font-semibold group-hover:translate-x-0.5 transition-transform">
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
