'use client';

/**
 * Map-layer toggle aliases over `@/components/ui/Toggle`.
 * Prefer the shared Toggle API (`color`, `type`) for new call sites.
 */

import type { ReactNode } from 'react';
import {
  ToggleGroupCard,
  ToggleRow,
  ToggleTrack,
  type ToggleType,
} from '@/components/ui/Toggle';

/** Visual switch track (safe inside an outer button). */
export function DockSwitch({
  on,
  activeColor,
  color,
  type = 'default',
}: {
  on: boolean;
  /** @deprecated Prefer `color`. */
  activeColor?: string;
  color?: string;
  type?: ToggleType;
}) {
  return <ToggleTrack on={on} color={color ?? activeColor} type={type} />;
}

export function DockLayerToggle({
  label,
  on,
  onClick,
  nested = false,
  disabled = false,
  hint,
  activeColor,
  color,
  type = 'default',
  withHaptic = true,
}: {
  label: string;
  on: boolean;
  onClick: () => void;
  nested?: boolean;
  disabled?: boolean;
  hint?: string | null;
  /** @deprecated Prefer `color`. */
  activeColor?: string;
  color?: string;
  type?: ToggleType;
  withHaptic?: boolean;
}) {
  return (
    <ToggleRow
      label={label}
      on={on}
      onClick={onClick}
      nested={nested}
      disabled={disabled}
      hint={hint}
      color={color ?? activeColor}
      type={type}
      withHaptic={withHaptic}
    />
  );
}

export function DockLayerGroupCard({
  label,
  children,
}: {
  label?: string;
  children: ReactNode;
}) {
  return <ToggleGroupCard label={label}>{children}</ToggleGroupCard>;
}

export type { ToggleType };
