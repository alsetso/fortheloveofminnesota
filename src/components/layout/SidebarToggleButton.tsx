'use client';

import { ComponentType } from 'react';
import { useHeaderTheme } from '@/contexts/HeaderThemeContext';

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
 * Uses header theme context for dark iOS gray on default light background.
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
  const { isDefaultLightBg } = useHeaderTheme();
  const buttonClass = isDefaultLightBg
    ? 'flex items-center justify-center w-8 h-8 text-[#3C3C43] hover:text-[#3C3C43] bg-black/5 hover:bg-black/10 rounded-full transition-all duration-200 backdrop-blur-sm'
    : 'flex items-center justify-center w-8 h-8 text-white/90 hover:text-white bg-white/10 hover:bg-white/20 rounded-full transition-all duration-200 backdrop-blur-sm';
  const iconClass = isDefaultLightBg ? 'w-4 h-4 text-[#3C3C43]' : 'w-4 h-4';
  return (
    <button
      onClick={onClick}
      className={buttonClass}
      aria-label={ariaLabel}
      title={title}
    >
      <Icon className={iconClass} />
    </button>
  );
}
