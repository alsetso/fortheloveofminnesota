'use client';

import { useEffect, useState } from 'react';
import { useGovToast } from '../contexts/GovToastContext';

/**
 * Single gov toast: yellow circle + action text (pending) → green "Success" or red "Fail".
 * Renders nothing when toast is null. Theme-aware.
 */
export default function GovToast() {
  const { toast, dismiss } = useGovToast();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setVisible(true), 10);
      return () => clearTimeout(t);
    }
    setVisible(false);
  }, [toast]);

  if (!toast) return null;

  const isPending = toast.status === 'pending';
  const isSuccess = toast.status === 'success';
  const isError = toast.status === 'error';

  const circleClass = isPending
    ? 'bg-amber-400 dark:bg-amber-500'
    : isSuccess
      ? 'bg-emerald-500 dark:bg-emerald-400'
      : 'bg-red-500 dark:bg-red-400';

  const text = isPending ? toast.actionText : isSuccess ? 'Success' : 'Fail';
  const panelClass =
    'flex items-center gap-2 px-3 py-2 rounded-md border shadow-lg bg-surface border-border text-foreground';

  return (
    <div
      className="fixed top-4 left-1/2 -translate-x-1/2 z-[110] pointer-events-auto"
      role="status"
      aria-live="polite"
    >
      <div
        className={`${panelClass} transition-all duration-200 ${
          visible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'
        }`}
      >
        <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${circleClass}`} />
        <span className="text-xs font-medium">{text}</span>
        <button
          type="button"
          onClick={dismiss}
          className="ml-1 p-0.5 rounded hover:bg-surface-accent text-foreground-muted hover:text-foreground transition-colors"
          aria-label="Dismiss"
        >
          <span className="sr-only">Dismiss</span>
          <span aria-hidden>×</span>
        </button>
      </div>
    </div>
  );
}
