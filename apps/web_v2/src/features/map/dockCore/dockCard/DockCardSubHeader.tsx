'use client';

import { IconArrowLeft } from '@/features/map/dockCore/core/icons';

/** Subcard chrome — back to Map layers + centered title. */
export function DockCardSubHeader({
  backLabel = 'Map layers',
  onBack,
  eyebrow,
  title,
  subtitle,
}: {
  backLabel?: string;
  onBack: () => void;
  eyebrow?: string;
  title: string;
  subtitle?: string | null;
}) {
  return (
    <div className="relative pb-1 pt-1">
      <button
        type="button"
        onClick={onBack}
        className="absolute left-0 top-1 z-10 inline-flex items-center gap-1 rounded-full py-1.5 pr-2 text-[13px] font-semibold text-foreground-muted transition active:opacity-70"
        aria-label={`Back to ${backLabel}`}
      >
        <IconArrowLeft className="h-4 w-4" />
        <span>{backLabel}</span>
      </button>
      <div className="px-8 text-center">
        {eyebrow ? (
          <p className="text-[11px] font-semibold uppercase tracking-wide text-foreground-muted">
            {eyebrow}
          </p>
        ) : null}
        <h2 className="mt-0.5 text-[1.2rem] font-semibold tracking-tight text-foreground">
          {title}
        </h2>
        {subtitle ? (
          <p className="mt-1 text-[13px] text-foreground-muted">{subtitle}</p>
        ) : null}
      </div>
    </div>
  );
}
