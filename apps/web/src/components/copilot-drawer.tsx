'use client';

import React, { useState, useEffect, useRef } from 'react';
import type { CopilotMessageDto, CopilotSimulationResultDto } from '@teamos/contracts';
import { Badge, Button } from './ui';
import { SparklesIcon, XIcon, ShieldIcon, ActivityIcon } from './ui/icons';

interface CopilotDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  orgId: string;
  projectId: string;
  projectName: string;
  onOpenAiPlanner?: () => void;
  onSelectTask?: (taskId: string) => void;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export function CopilotDrawer({
  isOpen,
  onClose,
  orgId,
  projectId,
  projectName,
  onOpenAiPlanner,
  onSelectTask,
}: CopilotDrawerProps) {
  const [messages, setMessages] = useState<CopilotMessageDto[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load message history on open
  useEffect(() => {
    if (!isOpen || !orgId || !projectId) return;

    fetch(`${API_BASE_URL}/api/v1/orgs/${orgId}/projects/${projectId}/copilot/messages`, {
      credentials: 'include',
    })
      .then((res) => (res.ok ? res.json() : []))
      .then((data: CopilotMessageDto[]) => {
        if (data.length === 0) {
          // Default initial greeting
          setMessages([
            {
              id: 'init-1',
              orgId,
              projectId,
              userId: 'system',
              role: 'assistant',
              content: `👋 Hello! I am your **TeamOS Delivery Copilot** for **${projectName}**.\n\nI can verify whether your team will hit its delivery date, calculate downstream impact using deterministic Critical Path Method (CPM), and simulate schedule changes in-memory.\n\nTry asking a question or click a suggestion below:`,
              citations: [],
              createdAt: new Date().toISOString(),
            },
          ]);
        } else {
          setMessages(data);
        }
      })
      .catch(() => {});
  }, [isOpen, orgId, projectId, projectName]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSendMessage = async (textToSend?: string) => {
    const text = textToSend || inputText;
    if (!text || !text.trim() || isLoading) return;

    const userMsg: CopilotMessageDto = {
      id: `temp-${Date.now()}`,
      orgId,
      projectId,
      userId: 'current-user',
      role: 'user',
      content: text.trim(),
      citations: [],
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText('');
    setIsLoading(true);

    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/orgs/${orgId}/projects/${projectId}/copilot/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ message: text.trim() }),
      });

      if (res.ok) {
        const reply: CopilotMessageDto = await res.json();
        setMessages((prev) => [...prev, reply]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            id: `err-${Date.now()}`,
            orgId,
            projectId,
            userId: 'system',
            role: 'assistant',
            content: '⚠️ Failed to connect to Copilot service. Please try again.',
            citations: [],
            createdAt: new Date().toISOString(),
          },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          orgId,
          projectId,
          userId: 'system',
          role: 'assistant',
          content: '⚠️ Network error communicating with Copilot.',
          citations: [],
          createdAt: new Date().toISOString(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  const quickPrompts = [
    'Will we hit the delivery date?',
    'What is blocking delivery right now?',
    'What if Task #2 takes 4 more days?',
    'Show the critical path',
  ];

  return (
    <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity" onClick={onClose} />

      {/* Drawer Panel */}
      <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 shadow-2xl flex flex-col h-full border-l border-slate-200 dark:border-slate-800 animate-in slide-in-from-right duration-200 z-10">
        {/* Header */}
        <div className="px-4 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-800/40">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-purple-600/10 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 flex items-center justify-center">
              <SparklesIcon className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                <span>TeamOS Copilot</span>
                <Badge variant="purple" size="xs">AI Risk Intelligence</Badge>
              </div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400">
                Grounding in {projectName} graph & evidence
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <XIcon className="w-4 h-4" />
          </button>
        </div>

        {/* Message Stream */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((m) => {
            const isUser = m.role === 'user';

            return (
              <div key={m.id} className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
                <div
                  className={`max-w-[90%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed ${
                    isUser
                      ? 'bg-purple-600 text-white rounded-br-xs'
                      : 'bg-slate-100 dark:bg-slate-800/90 text-slate-800 dark:text-slate-200 rounded-bl-xs border border-slate-200/60 dark:border-slate-700/60'
                  }`}
                >
                  <div className="whitespace-pre-wrap">{m.content}</div>

                  {/* What-If Simulation Result Card */}
                  {m.simulationPayload && (
                    <div className="mt-3 p-3 bg-white dark:bg-slate-900 rounded-xl border border-purple-200 dark:border-purple-800/60 text-slate-900 dark:text-slate-100 shadow-xs space-y-2">
                      <div className="flex items-center justify-between text-[11px] font-bold">
                        <span className="flex items-center gap-1 text-purple-600 dark:text-purple-400">
                          <ActivityIcon className="w-3.5 h-3.5" />
                          Simulated Schedule Shift
                        </span>
                        <Badge
                          variant={m.simulationPayload.scheduleVarianceChangeDays > 0 ? 'danger' : 'success'}
                          size="xs"
                        >
                          {m.simulationPayload.scheduleVarianceChangeDays > 0
                            ? `+${m.simulationPayload.scheduleVarianceChangeDays}d variance`
                            : 'No slip'}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-[10px] pt-1">
                        <div className="p-1.5 rounded bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                          <span className="text-slate-400 block">Baseline Finish</span>
                          <span className="font-semibold text-slate-700 dark:text-slate-200">
                            {m.simulationPayload.originalForecastDate}
                          </span>
                        </div>
                        <div className="p-1.5 rounded bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50">
                          <span className="text-rose-500 block">Simulated Finish</span>
                          <span className="font-bold text-rose-700 dark:text-rose-300">
                            {m.simulationPayload.newForecastDate}
                          </span>
                        </div>
                      </div>

                      {/* 1-click Proposal Action */}
                      {onOpenAiPlanner && (
                        <div className="pt-1">
                          <button
                            type="button"
                            onClick={onOpenAiPlanner}
                            className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-[11px] font-semibold transition-colors"
                          >
                            <SparklesIcon className="w-3 h-3" />
                            Draft Mitigation Proposal
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Citations */}
                  {m.citations && m.citations.length > 0 && (
                    <div className="mt-2.5 pt-2 border-t border-slate-200/50 dark:border-slate-700/50 flex flex-wrap gap-1">
                      <span className="text-[10px] text-slate-400 mr-1">Sources:</span>
                      {m.citations.map((c, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            if (c.type === 'task' && onSelectTask) {
                              onSelectTask(c.id);
                            }
                          }}
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono bg-slate-200/60 dark:bg-slate-700/60 text-slate-700 dark:text-slate-300 hover:underline"
                        >
                          {c.title}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <span className="text-[9px] text-slate-400 mt-1 px-1">
                  {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            );
          })}

          {isLoading && (
            <div className="flex items-center gap-2 text-xs text-slate-400 italic">
              <span className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
              Copilot is calculating delivery risk & simulating graph...
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Quick Prompts */}
        <div className="px-4 py-2 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 flex items-center gap-1.5 overflow-x-auto text-[11px]">
          {quickPrompts.map((qp, i) => (
            <button
              key={i}
              type="button"
              onClick={() => handleSendMessage(qp)}
              className="shrink-0 px-2.5 py-1 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:border-purple-300 hover:text-purple-600 dark:hover:text-purple-400 transition-colors shadow-2xs"
            >
              {qp}
            </button>
          ))}
        </div>

        {/* Input Bar */}
        <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Ask Copilot or simulate: 'What if #2 takes 4 more days?'"
              className="flex-1 px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-purple-500 text-slate-900 dark:text-slate-100 placeholder-slate-400"
            />
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={isLoading || !inputText.trim()}
            >
              Send
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
