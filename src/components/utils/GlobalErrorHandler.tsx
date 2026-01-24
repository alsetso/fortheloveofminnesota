'use client';

import { useEffect } from 'react';
import { useToast } from '@/features/ui/hooks/useToast';

/**
 * Global error handler that catches unhandled errors and shows toasts
 */
export function GlobalErrorHandler() {
  const toast = useToast();

  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      // Skip known errors that are handled elsewhere
      if (event.error?.message?.includes('ResizeObserver') || 
          event.error?.message?.includes('Non-Error promise rejection') ||
          event.error?.message?.includes('NetworkError')) {
        return;
      }

      toast.error('Error', event.error?.message || 'An unexpected error occurred');
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const message = event.reason?.message || event.reason || 'An unexpected error occurred';
      toast.error('Error', String(message));
    };

    const handleErrorToast = (event: CustomEvent<{ message: string }>) => {
      toast.error('Error', event.detail.message);
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    window.addEventListener('show-error-toast', handleErrorToast as EventListener);

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      window.removeEventListener('show-error-toast', handleErrorToast as EventListener);
    };
  }, [toast]);

  return null;
}
