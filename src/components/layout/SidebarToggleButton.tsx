'use client';

import { ComponentType } from 'react';

interface SidebarToggleButtonProps {
  /** Icon component to display */
  icon: ComponentType<{ className?: string }>;
  /** Click handler */
  onClick: () => void;
  /** Accessibility label */
  ariaLabel: string;
  /** Optional tooltip title */
  title?: string;
}

/**
 * Reusable sidebar toggle button component for header icons.
 * 
 * Provides consistent styling and behavior for sidebar toggle buttons
 * that appear next to the account dropdown in PageWrapper header.
 * 
 * @example
 * ```tsx
 * <SidebarToggleButton
 *   icon={FunnelIcon}
 *   onClick={toggleLeft}
 *   ariaLabel="Toggle left sidebar"
 *   title="Feed filters"
 * />
 * ```
 */
export default function SidebarToggleButton({
  icon: Icon,
  onClick,
  ariaLabel,
  title,
}: SidebarToggleButtonProps) {
  return (
    <button
      onClick={onClick}
      className="flex items-center justify-center w-8 h-8 text-white/70 hover:text-white hover:bg-white/10 rounded-md transition-colors"
      aria-label={ariaLabel}
      title={title}
    >
      <Icon className="w-5 h-5" />
    </button>
  );
}
