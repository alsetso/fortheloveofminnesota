'use client';

import { useEffect, useState } from 'react';

type CapturedError = {
  kind: 'error' | 'rejection';
  message: string;
  source?: string;
  stack?: string;
};

/** Soft-nav / AbortController cancellations — expected, not app failures. */
function isBenignAbort(reason: unknown): boolean {
  const name =
    reason && typeof reason === 'object' && 'name' in reason
      ? String((reason as { name?: unknown }).name ?? '')
      : '';
  if (name === 'AbortError') return true;
  const message =
    reason instanceof Error
      ? reason.message
      : typeof reason === 'string'
        ? reason
        : '';
  return /fetch is aborted|aborted without reason|the operation was aborted|the user aborted a request/i.test(
    message,
  );
}

/** Never JSON.stringify unknown rejection reasons — circular values blow the stack. */
function safeRejectionMessage(reason: unknown): string {
  if (reason instanceof Error) return reason.message || reason.name;
  if (typeof reason === 'string') return reason;
  if (reason == null) return 'Unknown rejection';
  try {
    return String(reason);
  } catch {
    return Object.prototype.toString.call(reason);
  }
}

/**
 * ClientErrorOverlay
 *
 * React error boundaries only catch render/lifecycle errors.
 * useEffect throws and unhandled promise rejections bypass them entirely —
 * those show Next.js's generic "Application error" page with NO useful info.
 *
 * This component sets up window.addEventListener('error') and
 * window.addEventListener('unhandledrejection') to catch those cases and
 * display the real message + source directly on screen in the same style
 * as error.tsx, so it's readable on TestFlight / Despia without console access.
 *
 * Mount once at the root layout level (inside Providers so auth context is
 * available if needed, but outside AuthBootstrap so it activates immediately).
 */
export function ClientErrorOverlay() {
  const [captured, setCaptured] = useState<CapturedError | null>(null);

  useEffect(() => {
    function onError(event: ErrorEvent) {
      // WKWebView fires window.error for missing images, bridge noise, and
      // ResizeObserver — covering the app for those looks like a crash.
      const message = event.message || '';
      const ignorable =
        !event.error ||
        message === 'ResizeObserver loop limit exceeded' ||
        message === 'ResizeObserver loop completed with undelivered notifications.' ||
        message === 'Script error.' ||
        isBenignAbort(event.error ?? message) ||
        /loading chunk|chunkloaderror|failed to fetch dynamically imported module/i.test(
          message,
        );
      if (ignorable) {
        console.warn('[ftlomn/ignored-error]', message, event.filename);
        return;
      }
      console.error('[ftlomn/unhandled-error]', message, event.filename, event.error?.stack);
      setCaptured({
        kind: 'error',
        message,
        source: event.filename ? `${event.filename}:${event.lineno}` : undefined,
        stack: event.error?.stack,
      });
    }

    function onUnhandledRejection(event: PromiseRejectionEvent) {
      const reason = event.reason;
      if (isBenignAbort(reason)) {
        event.preventDefault();
        return;
      }
      const message = safeRejectionMessage(reason);
      const stack = reason instanceof Error ? reason.stack : undefined;
      console.error('[ftlomn/unhandled-rejection]', message, stack);
      setCaptured({
        kind: 'rejection',
        message,
        stack,
      });
    }

    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onUnhandledRejection);
    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onUnhandledRejection);
    };
  }, []);

  if (!captured) return null;

  const isDev = process.env.NODE_ENV === 'development';

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '32px 24px',
        backgroundColor: '#0f1a14',
        color: '#e8f0e8',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        gap: '12px',
        zIndex: 99999,
      }}
    >
      <p style={{ fontSize: 13, fontWeight: 600, color: '#5a8f6e', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
        For the Love of Minnesota
      </p>

      <p style={{ fontSize: 22, fontWeight: 700, textAlign: 'center', color: '#f5f0e8', marginTop: 8 }}>
        Still loading…
      </p>

      <p style={{ fontSize: 14, color: '#86a886', textAlign: 'center', lineHeight: 1.5, maxWidth: 280, marginBottom: 8 }}>
        The app needs a moment to get ready. Tap Retry to continue.
      </p>

      <button
        type="button"
        onClick={() => setCaptured(null)}
        style={{
          padding: '13px 36px',
          borderRadius: 28,
          background: '#2F5D4A',
          color: '#f5f0e8',
          fontSize: 15,
          fontWeight: 600,
          border: 'none',
          cursor: 'pointer',
          marginTop: 4,
        }}
      >
        Retry
      </button>

      <button
        type="button"
        onClick={() => window.location.reload()}
        style={{
          padding: '10px 24px',
          borderRadius: 24,
          background: 'transparent',
          color: '#4a7a5e',
          fontSize: 13,
          fontWeight: 500,
          border: '1px solid rgba(74,122,94,0.35)',
          cursor: 'pointer',
        }}
      >
        Full reload
      </button>

      {isDev && (
        <pre style={{
          marginTop: 16,
          padding: '10px 14px',
          background: 'rgba(255,255,255,0.04)',
          borderRadius: 8,
          fontSize: 10,
          color: '#4a6a52',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-all',
          maxWidth: 380,
          maxHeight: 160,
          overflow: 'auto',
        }}>
          {captured.message}{captured.source ? `\n${captured.source}` : ''}{captured.stack ? `\n\n${captured.stack.slice(0, 800)}` : ''}
        </pre>
      )}
    </div>
  );
}
