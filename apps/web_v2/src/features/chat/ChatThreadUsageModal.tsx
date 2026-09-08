'use client';

import { useEffect, useId, useRef } from 'react';
import {
  formatDurationMs,
  formatTokenCount,
  type ThreadUsageResponse,
} from '@/features/chat/chatUsage';
import { ANSWER_MODE_COPY } from '@/lib/ai/answerModes';
import { IconSpinner, IconX } from '@/features/map/dockCore/core/icons';
import { Z_LAYER_CLASS } from '@/lib/map/zLayers';

type ChatThreadUsageModalProps = {
  open: boolean;
  onClose: () => void;
  loading: boolean;
  error: string | null;
  data: ThreadUsageResponse | null;
};

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-medium uppercase tracking-wide text-foreground-muted">
        {label}
      </p>
      <p className="mt-0.5 truncate text-[20px] font-semibold tracking-tight text-foreground">
        {value}
      </p>
      {hint ? (
        <p className="mt-0.5 text-[12px] text-foreground-muted">{hint}</p>
      ) : null}
    </div>
  );
}

/**
 * Thread usage sheet — totals for this chat + recent turns. Account rollup
 * shown as a quiet footer context line (no quotas/spend).
 */
export default function ChatThreadUsageModal({
  open,
  onClose,
  loading,
  error,
  data,
}: ChatThreadUsageModalProps) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const thread = data?.thread;
  const account = data?.account;

  return (
    <div className={`fixed inset-0 ${Z_LAYER_CLASS.APP_OVERLAY} flex items-end justify-center sm:items-center`}>
      <button
        type="button"
        className="absolute inset-0 bg-black/35"
        aria-label="Close usage"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative z-10 flex max-h-[min(88vh,36rem)] w-full max-w-md flex-col overflow-hidden rounded-t-[24px] bg-[#f7f5f1] shadow-2xl ring-1 ring-black/[0.08] sm:rounded-[24px]"
      >
        <div className="flex items-center gap-2 border-b border-black/[0.06] px-4 py-3">
          <h2
            id={titleId}
            className="min-w-0 flex-1 text-[16px] font-semibold text-foreground"
          >
            Thread usage
          </h2>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid h-9 w-9 place-items-center rounded-full transition active:bg-black/[0.06]"
          >
            <IconX className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          {loading ? (
            <div className="flex justify-center py-12">
              <IconSpinner className="h-6 w-6 animate-spin text-foreground-muted" />
            </div>
          ) : error ? (
            <p className="py-8 text-center text-[14px] text-red-700">{error}</p>
          ) : !thread || (thread.turn_count === 0 && thread.total_tokens === 0) ? (
            <p className="py-8 text-center text-[14px] text-foreground-muted">
              No model usage in this thread yet.
            </p>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-x-4 gap-y-4">
                <Stat
                  label="Total tokens"
                  value={formatTokenCount(thread.total_tokens)}
                  hint={`${thread.turn_count} turn${thread.turn_count === 1 ? '' : 's'}`}
                />
                <Stat
                  label="Time"
                  value={formatDurationMs(thread.duration_ms)}
                  hint="Model + tools"
                />
                <Stat label="Input" value={formatTokenCount(thread.input_tokens)} />
                <Stat label="Output" value={formatTokenCount(thread.output_tokens)} />
                <Stat
                  label="Reasoning"
                  value={formatTokenCount(thread.reasoning_tokens)}
                />
                <Stat
                  label="Cached"
                  value={formatTokenCount(thread.cached_tokens)}
                  hint={
                    thread.cache_write_tokens > 0
                      ? `${formatTokenCount(thread.cache_write_tokens)} written`
                      : undefined
                  }
                />
                <Stat
                  label="Web search"
                  value={String(thread.web_search_call_count)}
                  hint={`${thread.web_search_turns} turn${thread.web_search_turns === 1 ? '' : 's'}`}
                />
              </div>

              {data?.by_mode && data.by_mode.length > 1 ? (
                <div className="mt-6">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-foreground-muted">
                    By mode
                  </p>
                  <ul className="mt-2 divide-y divide-black/[0.06]">
                    {data.by_mode.map((row) => (
                      <li
                        key={row.mode}
                        className="flex items-baseline justify-between gap-3 py-2.5 text-[13px]"
                      >
                        <span className="min-w-0 text-foreground">
                          <span className="font-medium">
                            {ANSWER_MODE_COPY[row.mode].label}
                          </span>
                          <span className="text-foreground-muted">
                            {' '}
                            · {row.turn_count} turn
                            {row.turn_count === 1 ? '' : 's'}
                          </span>
                        </span>
                        <span className="shrink-0 font-medium tabular-nums text-foreground">
                          {formatTokenCount(row.total_tokens)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {data?.recent && data.recent.length > 0 ? (
                <div className="mt-6">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-foreground-muted">
                    Recent turns
                  </p>
                  <ul className="mt-2 divide-y divide-black/[0.06]">
                    {data.recent.map((turn) => (
                      <li
                        key={turn.id}
                        className="flex items-baseline justify-between gap-3 py-2.5 text-[13px]"
                      >
                        <span className="min-w-0 truncate text-foreground-muted">
                          {new Date(turn.created_at).toLocaleString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit',
                          })}
                          {turn.mode
                            ? ` · ${ANSWER_MODE_COPY[turn.mode].label}`
                            : ''}
                          {turn.web_search_used ? ' · search' : ''}
                        </span>
                        <span className="shrink-0 font-medium tabular-nums text-foreground">
                          {formatTokenCount(turn.total_tokens)}
                          {turn.reasoning_tokens > 0
                            ? ` · r${formatTokenCount(turn.reasoning_tokens)}`
                            : ''}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {account && account.turn_count > 0 ? (
                <p className="mt-6 text-center text-[12px] text-foreground-muted">
                  Account · {formatTokenCount(account.total_tokens)} tokens across{' '}
                  {account.thread_count} chat
                  {account.thread_count === 1 ? '' : 's'}
                </p>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
