'use client';

import type { PageAudienceChip } from '@/lib/directory/pageAudience';

const TONE: Record<PageAudienceChip['tone'], string> = {
  lake: 'bg-lake-blue/15 text-lake-blue',
  amber: 'bg-amber-500/15 text-amber-800',
  muted: 'bg-map-ink-subtle text-foreground-muted',
};

const COVER_TONE: Record<PageAudienceChip['tone'], string> = {
  lake: 'bg-white/90 text-lake-blue shadow-sm backdrop-blur-sm',
  amber: 'bg-white/90 text-amber-800 shadow-sm backdrop-blur-sm',
  muted: 'bg-black/45 text-white shadow-sm backdrop-blur-sm',
};

export function PageAudienceChips({
  chips,
  className = '',
  variant = 'default',
}: {
  chips: PageAudienceChip[];
  className?: string;
  variant?: 'default' | 'cover';
}) {
  if (chips.length === 0) return null;
  const tones = variant === 'cover' ? COVER_TONE : TONE;
  return (
    <span className={`inline-flex flex-wrap items-center gap-1 ${className}`.trim()}>
      {chips.map((chip) => (
        <span
          key={chip.key}
          className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${tones[chip.tone]}`}
        >
          {chip.label}
        </span>
      ))}
    </span>
  );
}
