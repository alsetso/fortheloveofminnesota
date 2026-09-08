'use client';

/**
 * Error boundary for the (app) route group (/game, /discover, etc.)
 * Mirrors the root error.tsx so map-shell crashes show real error text
 * on device instead of the generic Next.js "Application error" splash.
 */

import { useEffect } from 'react';

export default function AppGroupError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[ftlomn/app] client exception', error.message, error.stack, error.digest);
  }, [error]);

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
        padding: '24px',
        backgroundColor: '#0f1a14',
        color: '#e8f0e8',
        fontFamily: 'ui-monospace, monospace',
        gap: '16px',
        zIndex: 9999,
        overflowY: 'auto',
      }}
    >
      <p style={{ fontSize: 13, fontWeight: 600, color: '#a3c9a8', letterSpacing: '0.05em' }}>
        FOR THE LOVE OF MINNESOTA
      </p>
      <p style={{ fontSize: 15, fontWeight: 600, textAlign: 'center', color: '#f5f0e8' }}>
        Map failed to load.
      </p>
      <div
        style={{
          width: '100%',
          maxWidth: 480,
          background: 'rgba(255,255,255,0.06)',
          borderRadius: 12,
          padding: '14px 16px',
          fontSize: 12,
          lineHeight: 1.6,
          color: '#c8dcc8',
          wordBreak: 'break-all',
        }}
      >
        <p style={{ color: '#f87171', fontWeight: 700, marginBottom: 6 }}>
          {error.name}: {error.message}
        </p>
        {error.digest && (
          <p style={{ color: '#86a886', marginBottom: 6 }}>digest: {error.digest}</p>
        )}
        {isDev && error.stack && (
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: 10, color: '#7a9a7a', margin: 0 }}>
            {error.stack}
          </pre>
        )}
      </div>
      <button
        type="button"
        onClick={reset}
        style={{
          padding: '12px 28px',
          borderRadius: 24,
          background: '#2F5D4A',
          color: '#f5f0e8',
          fontSize: 14,
          fontWeight: 600,
          border: 'none',
          cursor: 'pointer',
        }}
      >
        Try again
      </button>
      <button
        type="button"
        onClick={() => window.location.reload()}
        style={{
          padding: '10px 24px',
          borderRadius: 24,
          background: 'transparent',
          color: '#86a886',
          fontSize: 13,
          fontWeight: 500,
          border: '1px solid rgba(134,168,134,0.3)',
          cursor: 'pointer',
        }}
      >
        Full reload
      </button>
    </div>
  );
}
