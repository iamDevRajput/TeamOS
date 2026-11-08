'use client';

import React, { useState, useEffect } from 'react';
import { XIcon, SparklesIcon, SearchIcon, ActivityIcon } from './ui/icons';
import { Button } from './ui';

interface GuidedTourTooltipProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenCommandPalette?: () => void;
}

const TOUR_STEPS = [
  {
    step: 1,
    title: 'Find anything instantly',
    description:
      'Use universal search to jump directly to tasks, projects, dependencies, and delivery risk—without leaving your flow.',
    shortcut: '⌘ K',
    icon: <SearchIcon className="w-4 h-4 text-blue-400" />,
  },
  {
    step: 2,
    title: 'Deterministic Delivery Risk (CPM)',
    description:
      'Critical Path Method calculations grounded in finish-to-start constraints identify delivery delays with zero AI hallucination.',
    shortcut: 'Alt + R',
    icon: <ActivityIcon className="w-4 h-4 text-emerald-400" />,
  },
  {
    step: 3,
    title: 'Human-Guarded AI Planning',
    description:
      'Transform briefs into structured task DAGs with Gemini. Changes are staged as proposals and only apply with admin sign-off.',
    shortcut: 'Alt + P',
    icon: <SparklesIcon className="w-4 h-4 text-purple-400" />,
  },
];

export function GuidedTourTooltip({
  isOpen,
  onClose,
  onOpenCommandPalette,
}: GuidedTourTooltipProps) {
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    if (isOpen) {
      setCurrentStep(0);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const current = TOUR_STEPS[currentStep];

  const handleNext = () => {
    if (currentStep < TOUR_STEPS.length - 1) {
      setCurrentStep((prev) => prev + 1);
    } else {
      onClose();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  return (
    <aside
      className="fixed top-14 left-1/2 -translate-x-1/2 z-50 w-full max-w-sm px-3 animate-in fade-in slide-in-from-top-2 duration-200"
      aria-label="Interactive Guided Tour"
      role="region"
    >
      <div className="relative bg-slate-900/95 dark:bg-slate-950/95 text-slate-100 rounded-xl border border-slate-700/80 shadow-2xl p-4 backdrop-blur-md space-y-3">
        {/* Top Stem Pointer pointing to Universal Search Bar */}
        <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-slate-900 dark:bg-slate-950 border-t border-l border-slate-700/80 rotate-45" />

        {/* Header with Title and Close button */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-slate-800/80 border border-slate-700">
              {current.icon}
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-100 tracking-tight">
                {current.title}
              </h4>
              <span className="text-[10px] font-mono text-slate-400">
                Shortcut: {current.shortcut}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 p-1 rounded-md transition-colors"
            title="Dismiss tour"
            aria-label="Dismiss tour"
          >
            <XIcon className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Body Description */}
        <p className="text-xs text-slate-300 leading-relaxed">
          {current.description}
        </p>

        {/* Footer with Step indicator and Controls */}
        <div className="flex items-center justify-between pt-1 border-t border-slate-800/80 text-xs">
          <span className="text-[11px] text-slate-400 font-medium">
            Step {current.step} of {TOUR_STEPS.length}
          </span>

          <div className="flex items-center gap-2">
            {currentStep === 0 && onOpenCommandPalette && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenCommandPalette();
                }}
                className="text-[11px] text-blue-400 hover:text-blue-300 font-semibold underline px-1"
              >
                Try Search
              </button>
            )}

            {currentStep > 0 && (
              <Button
                type="button"
                variant="ghost"
                size="xs"
                onClick={handlePrev}
                className="text-slate-300 hover:text-slate-100"
              >
                Back
              </Button>
            )}

            <Button
              type="button"
              variant="primary"
              size="xs"
              onClick={handleNext}
            >
              {currentStep < TOUR_STEPS.length - 1 ? 'Next' : 'Got it!'}
            </Button>
          </div>
        </div>
      </div>
    </aside>
  );
}
