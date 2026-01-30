'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';

export type ViewAsMode = 'owner' | 'public';

const VIEW_OPTIONS: { value: ViewAsMode; label: string }[] = [
  { value: 'owner', label: 'Owner' },
  { value: 'public', label: 'Public' },
];

interface ViewAsSelectorProps {
  /** When false, render nothing. Caller ensures this is only passed when owner. */
  visible?: boolean;
  /** Use dark text (light header). When false, use white (dark header). */
  darkText?: boolean;
  className?: string;
}

export default function ViewAsSelector({ visible = true, darkText = true, className = '' }: ViewAsSelectorProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const current = (searchParams.get('view') as ViewAsMode) || 'owner';
  const validView = VIEW_OPTIONS.some((o) => o.value === current) ? current : 'owner';

  const setView = useCallback(
    (view: ViewAsMode) => {
      const next = new URLSearchParams(searchParams.toString());
      if (view === 'owner') {
        next.delete('view');
      } else {
        next.set('view', view);
      }
      const q = next.toString();
      router.replace(pathname + (q ? `?${q}` : ''), { scroll: false });
    },
    [pathname, router, searchParams]
  );

  if (!visible) return null;

  return (
    <div
      className={`inline-flex items-center rounded-md border border-gray-200 bg-white/80 backdrop-blur-sm p-0.5 gap-0 ${className}`}
      role="group"
      aria-label="View as"
    >
      {VIEW_OPTIONS.map(({ value, label }) => (
        <button
          key={value}
          type="button"
          onClick={() => setView(value)}
          className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
            validView === value
              ? darkText
                ? 'bg-gray-200 text-gray-900'
                : 'bg-white/20 text-white'
              : darkText
                ? 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                : 'text-white/80 hover:text-white hover:bg-white/10'
          }`}
          aria-pressed={validView === value}
          aria-label={`View as ${label}`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
