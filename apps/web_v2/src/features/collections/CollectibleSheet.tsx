'use client';

/**
 * Locked collectibles presentation — solid dark bottom sheet + blue action.
 * Use this for every collectible detail popover (Today, map, etc.).
 */

import type { ReactNode } from 'react';
import DialogBackdrop from '@/components/sheets/DialogBackdrop';
import { SAFE_AREA } from '@/lib/despia/safeArea';

export type CollectibleSheetProps = {
  title: string;
  eyebrow?: string;
  subtitle?: string | null;
  meta?: string | null;
  media?: ReactNode;
  children?: ReactNode;
  actionLabel?: string;
  onClose: () => void;
  ariaLabel?: string;
};

/** Solid dark surface — same language as PlacementFound / Today record modals. */
const SHEET_SURFACE = 'bg-[#1c1c1e] shadow-xl';

export function CollectibleSheet({
  title,
  eyebrow,
  subtitle,
  meta,
  media,
  children,
  actionLabel = 'Nice',
  onClose,
  ariaLabel,
}: CollectibleSheetProps) {
  return (
    <DialogBackdrop
      onClose={onClose}
      dimClassName="bg-black/60"
      align="end"
      className="px-0"
      ariaLabel={ariaLabel ?? title}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="collectible-sheet-title"
        className={`mx-auto w-full max-w-lg overflow-hidden rounded-t-[1.75rem] ${SHEET_SURFACE}`}
        style={{ paddingBottom: SAFE_AREA.bottom }}
      >
        <div className="flex justify-center pt-2.5 pb-1" aria-hidden>
          <span className="h-1 w-9 rounded-full bg-white/25" />
        </div>

        <div className="max-h-[min(72vh,640px)] overflow-y-auto overscroll-contain">
          {media ? (
            <div className="mx-4 mt-1 overflow-hidden rounded-[1.25rem] border border-white/10 bg-[#121214]">
              {media}
            </div>
          ) : null}

          <div className="px-5 pb-2 pt-4 text-center">
            {eyebrow ? (
              <p className="text-[12px] font-semibold uppercase tracking-wide text-lake-blue">
                {eyebrow}
              </p>
            ) : null}
            <h2
              id="collectible-sheet-title"
              className={`text-[24px] font-bold tracking-tight text-white ${
                eyebrow ? 'mt-1.5' : ''
              }`}
            >
              {title}
            </h2>
            {subtitle ? (
              <p className="mt-1.5 text-[15px] font-semibold tabular-nums text-lake-blue">
                {subtitle}
              </p>
            ) : null}
            {meta ? <p className="mt-1 text-[13px] text-white/45">{meta}</p> : null}
            {children ? <div className="mt-4 text-left">{children}</div> : null}
          </div>
        </div>

        <div className="border-t border-white/10 px-4 pt-3 pb-3">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-2xl bg-[#5BA3FF] py-3.5 text-[16px] font-semibold text-white transition active:scale-[0.98]"
          >
            {actionLabel}
          </button>
        </div>
      </div>
    </DialogBackdrop>
  );
}

export function CollectibleStatRow({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl bg-white/5 px-3.5 py-2.5">
      <span className="text-[13px] text-white/50">{label}</span>
      <span className="text-[14px] font-semibold tabular-nums text-white">{value}</span>
    </div>
  );
}

export function CollectibleProgress({
  value,
  max,
  tone = 'lake',
}: {
  value: number;
  max: number;
  tone?: 'lake' | 'rose';
}) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="space-y-2 rounded-2xl bg-white/5 px-3.5 py-3">
      <div className="flex items-baseline justify-between gap-2 text-[12px] text-white/45">
        <span>
          {value} of {max}
        </span>
        <span className="tabular-nums">{Math.round(pct)}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-white/10">
        <span
          className={`block h-full rounded-full ${
            tone === 'rose' ? 'bg-[#c45c6a]' : 'bg-[#5BA3FF]'
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function CollectibleList({
  items,
}: {
  items: { id: string; title: string; detail?: string; trailing?: string }[];
}) {
  if (items.length === 0) return null;
  return (
    <ul className="max-h-44 space-y-1.5 overflow-y-auto">
      {items.map((item) => (
        <li
          key={item.id}
          className="flex items-center justify-between gap-3 rounded-2xl bg-white/5 px-3.5 py-2.5"
        >
          <div className="min-w-0">
            <p className="truncate text-[13px] font-semibold text-white">{item.title}</p>
            {item.detail ? (
              <p className="mt-0.5 text-[11px] text-white/45">{item.detail}</p>
            ) : null}
          </div>
          {item.trailing ? (
            <span className="shrink-0 text-[13px] font-bold tabular-nums text-[#5BA3FF]">
              {item.trailing}
            </span>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
