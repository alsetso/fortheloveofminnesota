'use client';

import Link from 'next/link';
import { 
  ArrowDownTrayIcon
} from '@heroicons/react/24/outline';

interface PWAStatusIconProps {
  variant?: 'light' | 'dark';
  size?: 'sm' | 'md';
  showLabel?: boolean;
  labelPosition?: 'inline' | 'below';
}

export function PWAStatusIcon({ 
  variant = 'light', 
  size = 'sm',
  showLabel = true,
  labelPosition = 'inline'
}: PWAStatusIconProps) {
  const isDark = variant === 'dark';
  const iconSize = size === 'sm' ? 'w-4 h-4' : 'w-5 h-5';
  const textSize = size === 'sm' ? 'text-xs' : 'text-sm';
  const labelTextSize = labelPosition === 'below' ? 'text-[9px]' : textSize;

  const linkContent = (
    <>
      <ArrowDownTrayIcon className={iconSize} />
      {showLabel && (
        <span className={`${labelTextSize} font-medium ${labelPosition === 'below' ? 'mt-0.5 leading-none' : ''}`}>
          Download
        </span>
      )}
    </>
  );

  if (labelPosition === 'below') {
    return (
      <Link
        href="/download"
        className={`flex flex-col items-center justify-center h-full transition-colors ${
          isDark
            ? 'text-white hover:text-white/80'
            : 'text-gray-600 hover:text-gray-900'
        }`}
        aria-label="Download app"
      >
        {linkContent}
      </Link>
    );
  }

  return (
    <Link
      href="/download"
      className={`flex items-center justify-center gap-1.5 p-2 transition-colors ${
        isDark
          ? 'text-white hover:text-white/80'
          : 'text-gray-600 hover:text-gray-900'
      }`}
      aria-label="Download app"
    >
      {linkContent}
    </Link>
  );
}

