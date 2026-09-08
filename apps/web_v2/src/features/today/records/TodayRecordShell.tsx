'use client';

/**
 * Shared dark record-detail shell for Today page taps — same language as
 * collect / claim success modals, with a content slot per dataset.
 */

import type { ReactNode } from 'react';
import DialogBackdrop from '@/components/sheets/DialogBackdrop';

export type TodayRecordShellProps = {
  title: string;
  eyebrow?: string;
  subtitle?: string | null;
  meta?: string | null;
  /** Optional full-bleed media above the title (e.g. 3D model preview). */
  media?: ReactNode;
  children?: ReactNode;
  actionLabel?: string;
  /** Optional primary footer action above the dismiss row (e.g. See on map). */
  primaryAction?: { label: string; onClick: () => void };
  onClose: () => void;
  ariaLabel?: string;
};

export function TodayRecordShell({
  title,
  eyebrow,
  subtitle,
  meta,
  media,
  children,
  actionLabel = 'Nice',
  primaryAction,
  onClose,
  ariaLabel,
}: TodayRecordShellProps) {
  return (
    <DialogBackdrop
      onClose={onClose}
      dimClassName="bg-black/60"
      className="px-5"
      ariaLabel={ariaLabel ?? title}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="today-record-title"
        className="mx-auto w-full max-w-sm overflow-hidden rounded-2xl bg-[#1c1c1e] text-center shadow-xl"
      >
        <div className="max-h-[min(72vh,640px)] overflow-y-auto overscroll-contain">
          {media ? <div className="border-b border-white/10">{media}</div> : null}
          <div className="px-5 py-6">
            {eyebrow ? (
              <p className="text-[12px] font-semibold uppercase tracking-wide text-lake-blue">
                {eyebrow}
              </p>
            ) : null}
            <h2
              id="today-record-title"
              className={`text-[22px] font-bold tracking-tight text-white ${eyebrow ? 'mt-1.5' : ''}`}
            >
              {title}
            </h2>
            {subtitle ? (
              <p className="mt-2 text-[15px] leading-snug text-white/70">{subtitle}</p>
            ) : null}
            {meta ? <p className="mt-1.5 text-[12px] text-white/40">{meta}</p> : null}
            {children ? <div className="mt-4 text-left">{children}</div> : null}
          </div>
        </div>
        {primaryAction ? (
          <button
            type="button"
            onClick={primaryAction.onClick}
            className="w-full border-t border-white/10 py-3.5 text-[16px] font-semibold text-[#5BA3FF] transition active:bg-white/5"
          >
            {primaryAction.label}
          </button>
        ) : null}
        <button
          type="button"
          onClick={onClose}
          className={`w-full border-t border-white/10 py-3.5 text-[16px] font-semibold transition active:bg-white/5 ${
            primaryAction ? 'text-white/55' : 'text-[#5BA3FF]'
          }`}
        >
          {actionLabel}
        </button>
      </div>
    </DialogBackdrop>
  );
}

export function TodayRecordStatRow({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-white/5 px-3 py-2.5">
      <span className="text-[13px] text-white/55">{label}</span>
      <span className="text-[14px] font-semibold tabular-nums text-white">{value}</span>
    </div>
  );
}

export function TodayRecordProgress({
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
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-2 text-[12px] text-white/45">
        <span>
          {value} of {max}
        </span>
        <span className="tabular-nums">{Math.round(pct)}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-white/10">
        <span
          className={`block h-full rounded-full ${tone === 'rose' ? 'bg-[#c45c6a]' : 'bg-[#5BA3FF]'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function TodayRecordList({
  items,
}: {
  items: { id: string; title: string; detail?: string; trailing?: string }[];
}) {
  if (items.length === 0) return null;
  return (
    <ul className="max-h-40 space-y-1.5 overflow-y-auto">
      {items.map((item) => (
        <li
          key={item.id}
          className="flex items-center justify-between gap-3 rounded-xl bg-white/5 px-3 py-2"
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
