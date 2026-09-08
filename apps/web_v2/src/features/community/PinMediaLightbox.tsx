'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { PinPostMedia } from '@/features/community/pinPostApi';
import { IconX } from '@/features/map/dockCore/core/icons';
import { Z_LAYER_CLASS } from '@/lib/map/zLayers';

export type PinMediaLightboxAuthor = {
  name: string;
  imageUrl?: string | null;
  /** Fallback glyph when no image (emoji or initial). */
  fallback?: string | null;
};

/**
 * Full-screen image pager — opens above the pin dock. Images only (videos stay
 * inline on the card). Swipe horizontally; tap backdrop or X to close.
 * Optional `footer` hosts post actions (like / comment) under the pager.
 */
export function PinMediaLightbox({
  items,
  index,
  onClose,
  onIndexChange,
  footer,
  author,
}: {
  items: PinPostMedia[];
  index: number;
  onClose: () => void;
  onIndexChange?: (index: number) => void;
  footer?: ReactNode;
  author?: PinMediaLightboxAuthor | null;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const count = items.length;
  const safeIndex = count === 0 ? 0 : Math.min(Math.max(0, index), count - 1);
  const initial =
    author?.name.replace(/^@/, '').trim().slice(0, 1).toUpperCase() || 'M';
  const emojiFallback = author?.fallback?.trim() || null;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el || count === 0) return;
    el.scrollLeft = el.clientWidth * safeIndex;
  }, [count, safeIndex]);

  if (typeof document === 'undefined' || count === 0) return null;

  const onScroll = () => {
    const el = scrollerRef.current;
    if (!el || !onIndexChange) return;
    const w = el.clientWidth || 1;
    const next = Math.round(el.scrollLeft / w);
    if (next !== safeIndex && next >= 0 && next < count) onIndexChange(next);
  };

  return createPortal(
    <div
      className={`fixed inset-0 ${Z_LAYER_CLASS.CRITICAL_DIALOG} flex flex-col bg-black`}
      role="dialog"
      aria-modal="true"
      aria-label="Photo preview"
    >
      <div className="relative flex items-center gap-2 px-3 pt-[max(0.75rem,env(safe-area-inset-top))] pb-2">
        {author ? (
          <div className="flex min-w-0 flex-1 items-center gap-2.5 pr-2">
            <div className="h-8 w-8 shrink-0 overflow-hidden rounded-full border border-white/20 bg-white/15">
              {author.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={author.imageUrl}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-[12px] font-semibold text-white">
                  {emojiFallback || initial}
                </div>
              )}
            </div>
            <span className="truncate text-[15px] font-semibold tracking-tight text-white">
              {author.name}
            </span>
          </div>
        ) : (
          <span className="min-w-[2.5rem] flex-1 text-[13px] font-semibold tabular-nums text-white/80">
            {count > 1 ? `${safeIndex + 1} / ${count}` : null}
          </span>
        )}

        {author && count > 1 ? (
          <span className="pointer-events-none absolute inset-x-0 text-center text-[13px] font-semibold tabular-nums text-white/80">
            {safeIndex + 1} / {count}
          </span>
        ) : null}

        <button
          type="button"
          onClick={onClose}
          aria-label="Close photo preview"
          className="relative z-[1] inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/15 text-white transition active:scale-95"
        >
          <IconX className="h-5 w-5" />
        </button>
      </div>

      <div
        ref={scrollerRef}
        onScroll={onScroll}
        onClick={onClose}
        className="flex min-h-0 flex-1 snap-x snap-mandatory overflow-x-auto overscroll-contain scrollbar-hide"
      >
        {items.map((item) => (
          <div
            key={item.id || item.url}
            className="flex h-full w-full shrink-0 snap-center items-center justify-center px-2"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={item.url}
              alt={item.alt || ''}
              className="max-h-full max-w-full object-contain"
              draggable={false}
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        ))}
      </div>

      <div className="shrink-0 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
        {count > 1 ? (
          <div className="mb-3 flex items-center justify-center gap-1.5">
            {items.map((item, i) => (
              <span
                key={item.id || item.url}
                className={`h-1.5 w-1.5 rounded-full ${
                  i === safeIndex ? 'bg-white' : 'bg-white/35'
                }`}
              />
            ))}
          </div>
        ) : null}
        {footer ? <div onClick={(e) => e.stopPropagation()}>{footer}</div> : null}
      </div>
    </div>,
    document.body,
  );
}
