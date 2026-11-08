'use client';

import React, { useState, useEffect } from 'react';
import type { MeetingDto, MeetingActionProposalDto } from '@teamos/contracts';
import { Badge, Button, EmptyState } from './ui';
import { PlusIcon, CheckCircleIcon, SparklesIcon, CalendarIcon, UsersIcon } from './ui/icons';

interface MeetingsPanelProps {
  orgId: string;
  projectId: string;
  projectName: string;
  onTaskCreated?: () => void;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export function MeetingsPanel({
  orgId,
  projectId,
  projectName,
  onTaskCreated,
}: MeetingsPanelProps) {
  const [meetings, setMeetings] = useState<MeetingDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedMeeting, setSelectedMeeting] = useState<MeetingDto | null>(null);

  // Create meeting modal state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newParticipants, setNewParticipants] = useState('Dev, Sarah, Alex');
  const [newTranscript, setNewTranscript] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Convert proposal state
  const [convertingProposal, setConvertingProposal] = useState<MeetingActionProposalDto | null>(null);
  const [isConverting, setIsConverting] = useState(false);

  const fetchMeetings = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/orgs/${orgId}/projects/${projectId}/meetings`, {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setMeetings(data);
        if (data.length > 0 && !selectedMeeting) {
          setSelectedMeeting(data[0]);
        }
      }
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (orgId && projectId) {
      fetchMeetings();
    }
  }, [orgId, projectId]);

  const handleCreateMeeting = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const parts = newParticipants.split(',').map((p) => p.trim()).filter(Boolean);
      const res = await fetch(`${API_BASE_URL}/api/v1/orgs/${orgId}/projects/${projectId}/meetings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          title: newTitle.trim(),
          participants: parts,
          transcript: newTranscript.trim() || undefined,
        }),
      });

      if (res.ok) {
        const created: MeetingDto = await res.json();
        setMeetings((prev) => [created, ...prev]);
        setSelectedMeeting(created);
        setIsCreateOpen(false);
        setNewTitle('');
        setNewTranscript('');
      }
    } catch {
      // ignore
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConvertProposal = async (proposal: MeetingActionProposalDto) => {
    if (!selectedMeeting) return;
    setIsConverting(true);

    try {
      const res = await fetch(
        `${API_BASE_URL}/api/v1/orgs/${orgId}/projects/${projectId}/meetings/${selectedMeeting.id}/proposals/${proposal.id}/convert`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            title: proposal.actionItem,
            priority: 'HIGH',
            remainingEstimateWorkdays: 3,
          }),
        }
      );

      if (res.ok) {
        // Refresh meetings list to show CONVERTED status
        await fetchMeetings();
        onTaskCreated?.();
      }
    } catch {
      // ignore
    } finally {
      setIsConverting(false);
    }
  };

  const handleDismissProposal = async (proposalId: string) => {
    if (!selectedMeeting) return;
    try {
      const res = await fetch(
        `${API_BASE_URL}/api/v1/orgs/${orgId}/projects/${projectId}/meetings/${selectedMeeting.id}/proposals/${proposalId}/dismiss`,
        {
          method: 'POST',
          credentials: 'include',
        }
      );
      if (res.ok) {
        await fetchMeetings();
      }
    } catch {
      // ignore
    }
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-900 overflow-hidden">
      {/* Action Header */}
      <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0 bg-slate-50/50 dark:bg-slate-900/50">
        <div>
          <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <span>Meeting Intelligence</span>
            <Badge variant="purple" size="xs">AI Action Extraction</Badge>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Transcribe engineering standups, extract action proposals with evidence, and convert to tasks with 1 click.
          </p>
        </div>

        <Button variant="primary" size="sm" onClick={() => setIsCreateOpen(true)}>
          <PlusIcon className="w-3.5 h-3.5" />
          Log Meeting & Transcribe
        </Button>
      </div>

      {/* Main split view */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Meetings List */}
        <div className="w-72 sm:w-80 border-r border-slate-200 dark:border-slate-800 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60 shrink-0">
          {isLoading ? (
            <div className="p-8 text-center text-xs text-slate-400">Loading meetings...</div>
          ) : meetings.length === 0 ? (
            <div className="p-8 text-center">
              <div className="text-2xl mb-1">🎙️</div>
              <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">No meetings recorded yet</div>
              <p className="text-[11px] text-slate-400 mt-1">
                Log a sprint sync or architecture discussion to extract action proposals.
              </p>
            </div>
          ) : (
            meetings.map((m) => {
              const isSelected = selectedMeeting?.id === m.id;
              const pendingCount = (m.proposals || []).filter((p) => p.status === 'PENDING').length;

              return (
                <div
                  key={m.id}
                  onClick={() => setSelectedMeeting(m)}
                  className={`p-3.5 cursor-pointer text-left transition-colors ${
                    isSelected
                      ? 'bg-purple-50/60 dark:bg-purple-950/30 border-l-3 border-purple-600'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-1">
                    <span className="text-xs font-bold text-slate-900 dark:text-slate-100 line-clamp-1">
                      {m.title}
                    </span>
                    {pendingCount > 0 && (
                      <Badge variant="purple" size="xs">
                        {pendingCount} new
                      </Badge>
                    )}
                  </div>

                  <div className="flex items-center gap-2 mt-1.5 text-[11px] text-slate-400">
                    <span className="flex items-center gap-1">
                      <CalendarIcon className="w-3 h-3" />
                      {new Date(m.meetingDate).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                    </span>
                    <span>•</span>
                    <span>{m.participants.length} attendees</span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Right: Meeting Detail View */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {selectedMeeting ? (
            <>
              {/* Meeting Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                    {selectedMeeting.title}
                  </h3>
                  <div className="flex items-center gap-2 mt-1 text-xs text-slate-500 dark:text-slate-400">
                    <span>{new Date(selectedMeeting.meetingDate).toLocaleString()}</span>
                    <span>•</span>
                    <span>Participants: {selectedMeeting.participants.join(', ')}</span>
                  </div>
                </div>
              </div>

              {/* AI Action Items Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5 uppercase tracking-wider">
                    <SparklesIcon className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                    Extracted Action Item Proposals
                  </h4>
                  <span className="text-[11px] text-slate-400">
                    Human-in-the-loop review boundary
                  </span>
                </div>

                {(!selectedMeeting.proposals || selectedMeeting.proposals.length === 0) ? (
                  <div className="p-4 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-center text-xs text-slate-400">
                    No action items extracted from this meeting.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-3">
                    {selectedMeeting.proposals.map((prop) => {
                      const isPending = prop.status === 'PENDING';
                      const isConverted = prop.status === 'CONVERTED';

                      return (
                        <div
                          key={prop.id}
                          className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 space-y-2.5"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                                  {prop.actionItem}
                                </span>
                                <Badge
                                  variant={isConverted ? 'success' : isPending ? 'purple' : 'neutral'}
                                  size="xs"
                                >
                                  {prop.status}
                                </Badge>
                                <span className="text-[10px] text-purple-600 dark:text-purple-400 font-mono">
                                  {Math.round(prop.confidence * 100)}% confidence
                                </span>
                              </div>

                              {prop.supportingEvidence && (
                                <blockquote className="text-[11px] text-slate-500 dark:text-slate-400 italic border-l-2 border-purple-300 dark:border-purple-700 pl-2 mt-1">
                                  "{prop.supportingEvidence}"
                                </blockquote>
                              )}
                            </div>

                            {isPending && (
                              <div className="flex items-center gap-1.5 shrink-0">
                                <Button
                                  variant="primary"
                                  size="xs"
                                  disabled={isConverting}
                                  onClick={() => handleConvertProposal(prop)}
                                >
                                  <CheckCircleIcon className="w-3 h-3" />
                                  Convert to Task
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="xs"
                                  onClick={() => handleDismissProposal(prop.id)}
                                >
                                  Dismiss
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Transcript & Speaker Segments */}
              <div className="space-y-3 pt-2">
                <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
                  Speaker Transcript Timeline
                </h4>

                {(!selectedMeeting.segments || selectedMeeting.segments.length === 0) ? (
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800 text-xs text-slate-600 dark:text-slate-300 whitespace-pre-wrap font-sans">
                    {selectedMeeting.transcript || 'No transcript text available.'}
                  </div>
                ) : (
                  <div className="space-y-2 border-l border-slate-200 dark:border-slate-800 pl-4 ml-2">
                    {selectedMeeting.segments.map((s) => (
                      <div key={s.id} className="relative group text-xs space-y-0.5">
                        <span className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-slate-300 dark:bg-slate-700 ring-2 ring-white dark:ring-slate-900 group-hover:bg-purple-500 transition-colors" />
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-800 dark:text-slate-200">{s.speaker}</span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {Math.floor(s.startTimeSeconds / 60)}:{(Math.floor(s.startTimeSeconds % 60)).toString().padStart(2, '0')}
                          </span>
                        </div>
                        <p className="text-slate-600 dark:text-slate-400 leading-relaxed">{s.text}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="py-20 text-center text-xs text-slate-400">
              Select a meeting from the list to view its transcript and AI proposals.
            </div>
          )}
        </div>
      </div>

      {/* Log Meeting Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs" onClick={() => setIsCreateOpen(false)} />
          <div className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl z-10 space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <span>Log Meeting & Ingest Transcript</span>
              <Badge variant="purple" size="xs">Auto-extract</Badge>
            </h3>

            <form onSubmit={handleCreateMeeting} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Meeting Title
                </label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Sprint 14 Architecture Sync"
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Participants (comma-separated)
                </label>
                <input
                  type="text"
                  value={newParticipants}
                  onChange={(e) => setNewParticipants(e.target.value)}
                  placeholder="Dev, Sarah, Alex"
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Transcript or Notes (Format: "Speaker: Text")
                </label>
                <textarea
                  rows={6}
                  value={newTranscript}
                  onChange={(e) => setNewTranscript(e.target.value)}
                  placeholder="Dev: We completed Task 1.&#10;Sarah: Backend integration in Task 2 is delayed by 4 days due to OAuth retry headers.&#10;Alex: Action item: Implement GitHub webhook HMAC idempotency buffer before frontend hook."
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 font-mono"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button variant="ghost" size="sm" type="button" onClick={() => setIsCreateOpen(false)}>
                  Cancel
                </Button>
                <Button variant="primary" size="sm" type="submit" disabled={isSubmitting || !newTitle.trim()}>
                  {isSubmitting ? 'Analyzing & Extracting...' : 'Save & Extract Actions'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
