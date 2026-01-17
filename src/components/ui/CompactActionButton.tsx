'use client';

import { ReactNode } from 'react';

interface CompactActionButtonProps {
  onClick: () => void;
  children: ReactNode;
  title?: string;
  className?: string;
  disabled?: boolean;
}

/**
 * Compact action button component with minimal padding
 * Designed for small icon buttons in tight spaces
 */
export default function CompactActionButton({
  onClick,
  children,
  title,
  className = '',
  disabled = false,
}: CompactActionButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`
        w-3.5 h-3.5
        min-w-[14px]
        min-h-[14px]
        flex items-center justify-center
        border border-gray-300 rounded
        hover:bg-gray-50
        disabled:opacity-50 disabled:cursor-not-allowed
        transition-colors
        p-0
        m-0
        box-border
        ${className}
      `}
      style={{ padding: 0, margin: 0 }}
    >
      {children}
    </button>
  );
}
