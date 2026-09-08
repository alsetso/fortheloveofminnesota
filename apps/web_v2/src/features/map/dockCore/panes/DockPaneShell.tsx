'use client';

import type { ReactNode } from 'react';
import { MAP_SHEET_BODY_CLASS, MAP_SHEET_SHELL_X } from '@/lib/map/mapChrome';
import {
  MAP_DOCK_GLASS_BORDER_CLASS,
  MAP_DOCK_GLASS_CHIP_CLASS,
  MAP_DOCK_GLASS_FILL_CLASS,
  MAP_DOCK_GLASS_HOVER_CLASS,
  MAP_DOCK_SHEET_FILL_CLASS,
} from '@/features/map/dockCore/core/mapDockTokens';
import { IconChevronRight } from '@/features/map/dockCore/core/icons';
import { safePadBottomKeyboard } from '@/lib/despia/safeArea';

export const ENTRY_ROW_GLASS_CLASS = `${MAP_DOCK_GLASS_FILL_CLASS} ${MAP_DOCK_GLASS_BORDER_CLASS} transition-colors ${MAP_DOCK_GLASS_HOVER_CLASS}`;

/** Optional value chip(s) + nav chevron — trailing content for a `DockActionRow` that opens something. */
export function DockRowChevron({ children }: { children?: ReactNode }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5">
      {children}
      <IconChevronRight className="h-4 w-4 text-foreground-muted" />
    </span>
  );
}

type DockPaneShellProps = {
  children: ReactNode;
  /** Optional sticky section above scroll body */
  header?: ReactNode;
  /** Pinned below scroll body (e.g. chat composer), 1rem from sheet bottom */
  footer?: ReactNode;
  className?: string;
};

/**
 * Shared in-dock layout frame for every non-browse pane.
 * Scroll lives on the dock shell so content passes under sticky glass chrome;
 * optional footer sticks to the sheet bottom.
 */
export function DockPaneShell({
  children,
  header,
  footer,
  className = '',
}: DockPaneShellProps) {
  return (
    <div
      className={`flex flex-col ${footer ? 'min-h-[calc(100%-var(--dock-chrome-h,0px))]' : ''} ${className}`.trim()}
    >
      {header ? <div className="shrink-0">{header}</div> : null}
      <div className={`min-w-0 flex-1 ${MAP_SHEET_BODY_CLASS}`}>{children}</div>
      {footer ? (
        <div
          className={`sticky bottom-0 z-[15] shrink-0 ${MAP_DOCK_SHEET_FILL_CLASS} pt-2 ${MAP_SHEET_SHELL_X}`}
          style={{ paddingBottom: safePadBottomKeyboard('1rem') }}
        >
          {footer}
        </div>
      ) : null}
    </div>
  );
}

export function DockSection({
  title,
  subtitle,
  children,
  badge,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  /** Optional label beside the title (e.g. Admin / Dev). */
  badge?: ReactNode;
}) {
  return (
    <section className="space-y-2">
      <div className="px-0.5">
        <div className="flex min-w-0 items-center gap-2">
          <h2 className="min-w-0 text-sm font-semibold text-foreground">{title}</h2>
          {badge}
        </div>
        {subtitle ? <p className="text-xs text-foreground-muted">{subtitle}</p> : null}
      </div>
      <div className="space-y-1.5">{children}</div>
    </section>
  );
}

export function DockActionRow({
  title,
  subtitle,
  icon,
  onClick,
  trailing,
  disabled,
  active = false,
  activeTone = 'blue',
}: {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  onClick?: () => void;
  trailing?: ReactNode;
  disabled?: boolean;
  /** Highlight as the current dock / session tool. */
  active?: boolean;
  activeTone?: 'blue' | 'red';
}) {
  const activeChip =
    activeTone === 'red'
      ? 'bg-red-500/15 text-red-700'
      : 'bg-lake-blue/15 text-lake-blue';
  const activeRow =
    activeTone === 'red'
      ? 'border-red-400/40 bg-red-500/10 ring-1 ring-red-400/25'
      : 'border-lake-blue/35 bg-lake-blue/10 ring-1 ring-lake-blue/20';

  const content = (
    <>
      {icon ? (
        <span
          className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
            active ? activeChip : `${MAP_DOCK_GLASS_CHIP_CLASS} text-lake-blue`
          }`}
        >
          {icon}
        </span>
      ) : null}
      <span className="min-w-0 flex-1 text-left">
        <span className="block truncate text-[15px] font-semibold text-foreground">{title}</span>
        {subtitle ? (
          <span className="mt-0.5 block truncate text-[12px] text-foreground-muted">{subtitle}</span>
        ) : null}
      </span>
      {trailing ??
        (active ? (
          <span
            className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
              activeTone === 'red' ? 'bg-red-500/15 text-red-700' : 'bg-lake-blue/15 text-lake-blue'
            }`}
          >
            Active
          </span>
        ) : null)}
    </>
  );

  if (!onClick) {
    return (
      <div
        className={`flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left ${ENTRY_ROW_GLASS_CLASS} ${
          active ? activeRow : ''
        }`}
      >
        {content}
      </div>
    );
  }

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-pressed={active || undefined}
      className={`flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left disabled:opacity-40 ${ENTRY_ROW_GLASS_CLASS} ${
        active ? activeRow : ''
      }`}
    >
      {content}
    </button>
  );
}

export function DockSkeletonRows({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-1.5">
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          className={`h-14 animate-pulse rounded-2xl ${MAP_DOCK_GLASS_CHIP_CLASS}`}
        />
      ))}
    </div>
  );
}
