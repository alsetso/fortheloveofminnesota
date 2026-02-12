'use client';

import React, { createContext, useContext, useState, useCallback, useRef, ReactNode } from 'react';

export type GovToastStatus = 'pending' | 'success' | 'error';

interface GovToastState {
  status: GovToastStatus;
  actionText: string;
}

interface GovToastContextType {
  showPending: (actionText: string) => void;
  showSuccess: () => void;
  showError: () => void;
  toast: GovToastState | null;
  dismiss: () => void;
}

const GovToastContext = createContext<GovToastContextType | undefined>(undefined);

const AUTO_DISMISS_MS = 2200;

export function GovToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<GovToastState | null>(null);
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearDismissTimer = useCallback(() => {
    if (dismissTimerRef.current) {
      clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = null;
    }
  }, []);

  const dismiss = useCallback(() => {
    clearDismissTimer();
    setToast(null);
  }, [clearDismissTimer]);

  const showPending = useCallback((actionText: string) => {
    clearDismissTimer();
    setToast({ status: 'pending', actionText });
  }, [clearDismissTimer]);

  const showSuccess = useCallback(() => {
    clearDismissTimer();
    setToast((prev) => (prev ? { ...prev, status: 'success' } : { status: 'success', actionText: '' }));
    dismissTimerRef.current = setTimeout(dismiss, AUTO_DISMISS_MS);
  }, [dismiss, clearDismissTimer]);

  const showError = useCallback(() => {
    clearDismissTimer();
    setToast((prev) => (prev ? { ...prev, status: 'error' } : { status: 'error', actionText: '' }));
    dismissTimerRef.current = setTimeout(dismiss, AUTO_DISMISS_MS);
  }, [dismiss, clearDismissTimer]);

  const value: GovToastContextType = {
    showPending,
    showSuccess,
    showError,
    toast,
    dismiss,
  };

  return (
    <GovToastContext.Provider value={value}>
      {children}
    </GovToastContext.Provider>
  );
}

export function useGovToast(): GovToastContextType {
  const ctx = useContext(GovToastContext);
  if (ctx === undefined) {
    throw new Error('useGovToast must be used within GovToastProvider');
  }
  return ctx;
}
