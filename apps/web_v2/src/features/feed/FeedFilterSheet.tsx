'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import {
  FEED_FILTER_TOPICS,
  getFeedHiddenTopicsSnapshot,
  resetFeedFilters,
  setFeedTopicHidden,
  subscribeFeedFilters,
  type FeedFilterTopicId,
} from '@/features/feed/feedFilterStore';
import { IconX } from '@/features/map/dockCore/core/icons';
import { safePadBottom } from '@/lib/despia/safeArea';

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-7 w-12 shrink-0 rounded-full transition ${
        checked ? 'bg-lake-blue' : 'bg-black/15'
      }`}
    >
      <span
        className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition ${
          checked ? 'left-[1.35rem]' : 'left-0.5'
        }`}
      />
    </button>
  );
}

/**
 * Community posts filter card — X-style bottom sheet to hide contribution topics.
 */
export function FeedFilterSheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  const hidden = useSyncExternalStore(
    subscribeFeedFilters,
    getFeedHiddenTopicsSnapshot,
    () => new Set<FeedFilterTopicId>(),
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!mounted || !open) return null;

  const hiddenCount = hidden.size;

  return createPortal(
    <div className="fixed inset-0 z-[80]" role="presentation">
      <button
        type="button"
        aria-label="Dismiss"
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="feed-filter-title"
        className="absolute inset-x-0 bottom-0 flex max-h-[88vh] flex-col rounded-t-[1.35rem] bg-white shadow-[0_-8px_40px_rgba(0,0,0,0.18)]"
        style={{ paddingBottom: safePadBottom('1rem') }}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 px-5 pb-2 pt-4">
          <div className="min-w-0 flex-1">
            <h2
              id="feed-filter-title"
              className="text-[22px] font-extrabold tracking-tight text-foreground"
            >
              Filter posts
            </h2>
            <p className="mt-1 text-[14px] text-foreground-muted">
              Hide topics from this feed
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-black/[0.06] text-foreground transition active:scale-95"
          >
            <IconX className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-2">
          {FEED_FILTER_TOPICS.map((topic) => {
            const isHidden = hidden.has(topic.id);
            return (
              <div
                key={topic.id}
                className="flex items-center gap-3 px-3 py-3.5"
              >
                <span
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-black/[0.04] text-[18px]"
                  aria-hidden
                >
                  {topic.emoji}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[16px] font-semibold text-foreground">
                    {topic.label}
                  </span>
                  <span className="mt-0.5 block text-[13px] text-foreground-muted">
                    {topic.description}
                  </span>
                </span>
                <Toggle
                  checked={isHidden}
                  label={`Hide ${topic.label}`}
                  onChange={(next) => setFeedTopicHidden(topic.id, next)}
                />
              </div>
            );
          })}
        </div>

        <div className="shrink-0 border-t border-black/[0.06] px-5 pt-3">
          <button
            type="button"
            disabled={hiddenCount === 0}
            onClick={() => resetFeedFilters()}
            className="inline-flex w-full items-center justify-center rounded-full bg-black/[0.06] px-4 py-3.5 text-[16px] font-bold text-foreground transition active:scale-[0.99] disabled:opacity-40"
          >
            Reset
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
