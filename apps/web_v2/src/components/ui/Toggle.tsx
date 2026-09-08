'use client';

/**
 * Shared haptic toggle — dynamic color + type.
 * Fires `haptic.toggle()` on every user press (Despia light).
 */

import type { CSSProperties, ReactNode } from 'react';
import { haptic } from '@/lib/despia/haptics';
import {
  MAP_DOCK_GLASS_BORDER_CLASS,
  MAP_DOCK_GLASS_FILL_CLASS,
} from '@/features/map/dockCore/core/mapDockTokens';

export type ToggleType = 'default' | 'compact';

const TRACK: Record<
  ToggleType,
  { track: string; thumb: string; onX: string }
> = {
  default: {
    track: 'h-7 w-11',
    thumb: 'top-0.5 left-0.5 h-6 w-6',
    onX: 'translate-x-4',
  },
  compact: {
    track: 'h-6 w-9',
    thumb: 'top-0.5 left-0.5 h-5 w-5',
    onX: 'translate-x-3',
  },
};

export type ToggleProps = {
  on: boolean;
  /** On-state track fill. Defaults to lake-blue. */
  color?: string;
  type?: ToggleType;
  disabled?: boolean;
  className?: string;
  /** Fire `haptic.toggle()` on press. Default true. */
  withHaptic?: boolean;
  'aria-label'?: string;
  onClick?: () => void;
};

function trackStyle(on: boolean, color?: string): CSSProperties | undefined {
  if (!on || !color) return undefined;
  return { backgroundColor: color };
}

function trackClass(on: boolean, color?: string, type: ToggleType = 'default'): string {
  const size = TRACK[type];
  return [
    'relative inline-block shrink-0 rounded-full transition-colors',
    size.track,
    on && !color ? 'bg-lake-blue' : '',
    on ? '' : 'bg-map-ink-subtle',
  ]
    .filter(Boolean)
    .join(' ');
}

function thumbClass(on: boolean, type: ToggleType = 'default'): string {
  const size = TRACK[type];
  return [
    'absolute rounded-full bg-white shadow-sm transition-transform duration-200 ease-out',
    size.thumb,
    on ? size.onX : 'translate-x-0',
  ].join(' ');
}

/** Visual track only (use inside a labeled control). */
export function ToggleTrack({
  on,
  color,
  type = 'default',
  className,
}: {
  on: boolean;
  color?: string;
  type?: ToggleType;
  className?: string;
}) {
  return (
    <span
      className={`${trackClass(on, color, type)}${className ? ` ${className}` : ''}`}
      style={trackStyle(on, color)}
      aria-hidden
    >
      <span className={thumbClass(on, type)} />
    </span>
  );
}

/**
 * Interactive switch — fires haptic on press, then `onClick`.
 * Use when the switch itself is the hit target.
 */
export function Toggle({
  on,
  color,
  type = 'default',
  disabled = false,
  className,
  withHaptic = true,
  onClick,
  'aria-label': ariaLabel,
}: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => {
        if (disabled) return;
        if (withHaptic) haptic.toggle();
        onClick?.();
      }}
      className={`inline-flex shrink-0 items-center disabled:opacity-40 ${className ?? ''}`}
    >
      <ToggleTrack on={on} color={color} type={type} />
    </button>
  );
}

export type ToggleRowProps = {
  label: string;
  on: boolean;
  onClick: () => void;
  nested?: boolean;
  disabled?: boolean;
  hint?: string | null;
  /** On-state switch fill (defaults to lake-blue). */
  color?: string;
  type?: ToggleType;
  /** Fire `haptic.toggle()` on press. Default true. */
  withHaptic?: boolean;
};

/** Full-width labeled row with switch — map layer / settings pattern. */
export function ToggleRow({
  label,
  on,
  onClick,
  nested = false,
  disabled = false,
  hint,
  color,
  type = 'default',
  withHaptic = true,
}: ToggleRowProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={disabled}
      onClick={() => {
        if (disabled) return;
        if (withHaptic) haptic.toggle();
        onClick();
      }}
      className={`flex w-full items-center justify-between gap-3 py-3 text-left transition-colors active:bg-map-glass-hover disabled:opacity-40 ${
        nested
          ? 'border-t border-[rgb(var(--map-ink-subtle))] pl-8 pr-3.5'
          : 'px-3.5'
      }`}
    >
      <span className="min-w-0">
        <span className="block truncate text-[15px] font-medium text-foreground">{label}</span>
        {hint ? (
          <span className="mt-0.5 block text-[11px] leading-snug text-foreground-muted">
            {hint}
          </span>
        ) : null}
      </span>
      <ToggleTrack on={on} color={color} type={type} />
    </button>
  );
}

export function ToggleGroupCard({
  label,
  children,
}: {
  label?: string;
  children: ReactNode;
}) {
  return (
    <section>
      {label ? (
        <p className="mb-1.5 px-1 text-[11px] font-semibold uppercase tracking-wide text-foreground-muted">
          {label}
        </p>
      ) : null}
      <div
        className={`overflow-hidden rounded-2xl ${MAP_DOCK_GLASS_BORDER_CLASS} ${MAP_DOCK_GLASS_FILL_CLASS} divide-y divide-[rgb(var(--map-ink-subtle))]`}
      >
        {children}
      </div>
    </section>
  );
}
