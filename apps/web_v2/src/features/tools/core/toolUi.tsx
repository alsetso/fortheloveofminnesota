'use client';

import type { ReactNode } from 'react';
import {
  MAP_DOCK_GLASS_BORDER_CLASS,
  MAP_DOCK_GLASS_FILL_CLASS,
} from '@/features/map/dockCore/core/mapDockTokens';
import { formatCredits } from '@/features/tools/core/toolCreditCosts';

export const TOOL_FIELD_CLASS = `h-12 w-full rounded-2xl border border-black/[0.08] bg-[#F2F2F7] px-3.5 text-[15px] text-foreground outline-none transition placeholder:text-foreground-muted focus:border-lake-blue/50 focus:ring-2 focus:ring-lake-blue/20`;

/** Small pill — Free (green) or N credit(s). */
export function CreditCostBadge({ credits }: { credits: number }) {
  const free = credits === 0;
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${
        free ? 'bg-green-600/10 text-green-700' : 'bg-map-ink-subtle text-foreground-muted'
      }`}
    >
      {formatCredits(credits)}
    </span>
  );
}

/** Segmented control — Name | Email | Phone, etc. */
export function ToolSegmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { id: T; label: string }[];
  value: T;
  onChange: (next: T) => void;
}) {
  return (
    <div
      className={`flex gap-1 rounded-2xl p-1 ${MAP_DOCK_GLASS_FILL_CLASS} ${MAP_DOCK_GLASS_BORDER_CLASS}`}
      role="tablist"
    >
      {options.map((opt) => {
        const active = opt.id === value;
        return (
          <button
            key={opt.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.id)}
            className={`min-w-0 flex-1 rounded-xl px-2 py-2 text-[13px] font-semibold transition ${
              active
                ? 'bg-map-glass-hover text-lake-blue shadow-sm'
                : 'text-foreground-muted hover:text-foreground'
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

export function ToolPrimaryButton({
  children,
  credits,
  onClick,
  disabled = false,
  loading = false,
  variant = 'primary',
}: {
  children: ReactNode;
  credits?: number;
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: 'primary' | 'secondary';
}) {
  const primary = variant === 'primary';
  return (
    <button
      type="button"
      disabled={disabled || loading}
      onClick={onClick}
      className={`flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3.5 text-[15px] font-semibold transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-45 ${
        primary
          ? 'bg-lake-blue text-white shadow-sm hover:bg-lake-blue/90'
          : `${MAP_DOCK_GLASS_FILL_CLASS} ${MAP_DOCK_GLASS_BORDER_CLASS} text-foreground hover:bg-map-glass-hover`
      }`}
    >
      <span className="min-w-0 truncate">{loading ? 'Working…' : children}</span>
      {typeof credits === 'number' && !loading ? <CreditCostBadge credits={credits} /> : null}
    </button>
  );
}

export function ToolCostNote({ children }: { children: ReactNode }) {
  return <p className="px-0.5 text-center text-[11px] leading-snug text-foreground-muted">{children}</p>;
}

export function ToolStatusLine({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-2xl bg-lake-blue/10 px-3 py-2.5 text-center text-[13px] font-medium text-lake-blue">
      {children}
    </p>
  );
}

/** Contact / address result row — lighter than DockActionRow for lists. */
export function ToolResultRow({
  title,
  subtitle,
  onClick,
  trailing,
  icon,
}: {
  title: string;
  subtitle?: string;
  onClick?: () => void;
  trailing?: ReactNode;
  icon?: ReactNode;
}) {
  const text = (
    <span className="min-w-0 flex-1">
      <span className="block truncate text-[15px] font-semibold text-foreground">{title}</span>
      {subtitle ? (
        <span className="mt-0.5 block truncate text-[12px] text-foreground-muted">{subtitle}</span>
      ) : null}
    </span>
  );

  const iconSlot = icon ? (
    <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-lake-blue/10 text-lake-blue">
      {icon}
    </span>
  ) : null;

  const shell = `${MAP_DOCK_GLASS_FILL_CLASS} ${MAP_DOCK_GLASS_BORDER_CLASS}`;

  // Dual action: main tap + trailing control (e.g. Save) — avoid nested <button>.
  if (onClick && trailing) {
    return (
      <div className={`flex w-full items-center gap-2 rounded-2xl px-2 py-2 ${shell}`}>
        <button
          type="button"
          onClick={onClick}
          className="flex min-w-0 flex-1 items-center gap-3 rounded-xl px-1 py-1 text-left transition hover:bg-map-ink-subtle"
        >
          {iconSlot}
          {text}
        </button>
        <span className="shrink-0 pr-1">{trailing}</span>
      </div>
    );
  }

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left ${shell} transition hover:bg-map-glass-hover`}
      >
        {iconSlot}
        {text}
        {trailing}
      </button>
    );
  }

  return (
    <div className={`flex w-full items-center gap-3 rounded-2xl px-3 py-3 ${shell}`}>
      {iconSlot}
      {text}
      {trailing}
    </div>
  );
}

export function ToolEmptyState({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div
      className={`rounded-2xl px-4 py-8 text-center ${MAP_DOCK_GLASS_FILL_CLASS} ${MAP_DOCK_GLASS_BORDER_CLASS}`}
    >
      <p className="text-[15px] font-semibold text-foreground">{title}</p>
      <p className="mt-1 text-[12px] leading-snug text-foreground-muted">{subtitle}</p>
    </div>
  );
}
