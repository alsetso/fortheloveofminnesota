'use client';

interface PartyBadgeProps {
  party: string | null | undefined;
  /** 'text' renders as a colored text label (default). 'pill' renders as a small rounded badge. */
  variant?: 'text' | 'pill';
  className?: string;
}

export function partyColorClass(party: string | null | undefined): string {
  if (party === 'DFL') return 'text-blue-600 dark:text-blue-400';
  if (party === 'R' || party === 'Republican') return 'text-red-600 dark:text-red-400';
  return 'text-foreground-muted';
}

export default function PartyBadge({ party, variant = 'text', className = '' }: PartyBadgeProps) {
  if (!party) return null;

  if (variant === 'pill') {
    const bgClass =
      party === 'DFL'
        ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-800'
        : party === 'R' || party === 'Republican'
        ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-800'
        : 'bg-surface-muted text-foreground-muted border-border';

    return (
      <span
        className={`inline-flex items-center text-[9px] font-medium px-1.5 py-0.5 rounded border ${bgClass} ${className}`}
      >
        {party}
      </span>
    );
  }

  return (
    <span className={`text-[10px] font-medium ${partyColorClass(party)} ${className}`}>
      {party}
    </span>
  );
}
