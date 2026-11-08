'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircleIcon, AlertTriangleIcon, XIcon } from './icons';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  title: string;
  description?: string;
}

interface ToastContextType {
  showToast: (type: 'success' | 'error' | 'info', title: string, description?: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = useCallback(
    (type: 'success' | 'error' | 'info', title: string, description?: string) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      setToasts((prev) => [...prev, { id, type, title, description }]);

      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 4000);
    },
    [],
  );

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {/* Toast Notification Container (Bottom Right, matching Plane) */}
      <div
        className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none max-w-sm w-full px-2"
        aria-live="polite"
        aria-atomic="true"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="pointer-events-auto flex items-center justify-between gap-3 p-3.5 bg-slate-900/95 dark:bg-slate-950/95 text-slate-100 rounded-xl border border-slate-800 shadow-modal backdrop-blur-xs animate-in slide-in-from-bottom-2 fade-in duration-200"
            role="status"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              {toast.type === 'success' && (
                <CheckCircleIcon className="w-4 h-4 text-emerald-400 shrink-0" />
              )}
              {toast.type === 'error' && (
                <AlertTriangleIcon className="w-4 h-4 text-rose-400 shrink-0" />
              )}
              {toast.type === 'info' && (
                <span className="w-2 h-2 rounded-full bg-blue-400 shrink-0" />
              )}
              <div className="text-xs min-w-0">
                <span className="font-semibold block truncate">{toast.title}</span>
                {toast.description && (
                  <span className="text-[11px] text-slate-400 block truncate">
                    {toast.description}
                  </span>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={() => removeToast(toast.id)}
              className="text-slate-400 hover:text-slate-200 p-1 rounded-md transition-colors shrink-0"
              aria-label="Dismiss notification"
            >
              <XIcon className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    // Fallback if rendered outside provider
    return {
      showToast: (type: 'success' | 'error' | 'info', title: string, description?: string) => {
        console.log(`[Toast ${type}]: ${title}`, description);
      },
    };
  }
  return context;
}
