'use client';

import { useEffect, useId, useRef, useState } from 'react';
import {
  REPORT_REASON_OPTIONS,
  type ReportReason,
} from '@/features/community/reportReasons';
import {
  reportPinPost,
  type ReportPinPostReason,
} from '@/features/community/pinPostApi';
import { IconX } from '@/features/map/dockCore/core/icons';

type PostReportSheetProps = {
  open: boolean;
  postId: string;
  alreadyReported?: boolean;
  onClose: () => void;
  onReported?: () => void;
};

/**
 * Standalone report sheet for feed / post / profile (not map dock).
 * Uses the same reasons + API as ReportDockCard.
 */
export function PostReportSheet({
  open,
  postId,
  alreadyReported = false,
  onClose,
  onReported,
}: PostReportSheetProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(alreadyReported);

  useEffect(() => {
    if (!open) return;
    setReason(null);
    setDetails('');
    setError(null);
    setBusy(false);
    setDone(alreadyReported);
  }, [open, alreadyReported, postId]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  const onSubmit = async () => {
    if (!reason || busy || done) return;
    setBusy(true);
    setError(null);
    try {
      await reportPinPost(
        postId,
        reason as ReportPinPostReason,
        reason === 'other' ? details : undefined,
      );
      setDone(true);
      onReported?.();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not report');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center">
      <button
        type="button"
        aria-label="Dismiss"
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative z-[1] max-h-[85dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3 shadow-xl sm:rounded-3xl sm:pb-5"
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 id={titleId} className="text-[17px] font-semibold tracking-tight text-foreground">
            Report post
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-black/[0.05] text-foreground-muted transition active:scale-95"
          >
            <IconX className="h-4 w-4" />
          </button>
        </div>

        {done ? (
          <div className="py-6 text-center">
            <p className="text-[15px] font-semibold text-foreground">Reported</p>
            <p className="mt-1 text-[13px] leading-relaxed text-foreground-muted">
              Thanks — we&apos;ll review this post. You can&apos;t withdraw a report.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="mt-5 inline-flex rounded-full bg-foreground px-5 py-2.5 text-[14px] font-semibold text-white transition active:scale-95"
            >
              Done
            </button>
          </div>
        ) : (
          <>
            <p className="text-[13px] leading-relaxed text-foreground-muted">
              Reports help keep the community useful for everyone.
            </p>
            <div className="mt-3 space-y-1" role="radiogroup" aria-label="Report reason">
              {REPORT_REASON_OPTIONS.map((opt) => {
                const on = reason === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => setReason(opt.id)}
                    className={`flex w-full flex-col rounded-2xl px-3.5 py-3 text-left transition active:scale-[0.99] ${
                      on ? 'bg-lake-blue/10 ring-1 ring-lake-blue/30' : 'bg-black/[0.03]'
                    }`}
                  >
                    <span className="text-[15px] font-semibold text-foreground">{opt.label}</span>
                    <span className="mt-0.5 text-[12px] text-foreground-muted">{opt.hint}</span>
                  </button>
                );
              })}
            </div>
            {reason === 'other' ? (
              <textarea
                value={details}
                onChange={(e) => setDetails(e.target.value.slice(0, 500))}
                placeholder="Tell us briefly what’s wrong"
                rows={3}
                className="mt-3 w-full resize-none rounded-2xl border border-black/10 bg-white px-3.5 py-3 text-[14px] text-foreground outline-none focus:border-lake-blue/40"
              />
            ) : null}
            {error ? (
              <p className="mt-2 text-[13px] text-red-600">{error}</p>
            ) : null}
            <button
              type="button"
              disabled={!reason || busy || (reason === 'other' && !details.trim())}
              onClick={() => void onSubmit()}
              className="mt-4 flex w-full items-center justify-center rounded-full bg-foreground py-3 text-[15px] font-semibold text-white transition active:scale-95 disabled:opacity-40"
            >
              {busy ? 'Reporting…' : 'Submit report'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
