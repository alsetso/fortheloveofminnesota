'use client';

import { IconArrowLeft, IconBillboard, IconShield } from '@/features/map/dockCore/core/icons';
import { PageAudienceChips } from '@/features/map/directory/PageAudienceChips';
import { PageLogoDisc } from '@/features/map/directory/PageLogoDisc';
import type { PageAudienceChip } from '@/lib/directory/pageAudience';

/**
 * Sticky page identity — uses dock card header so title/chips stay visible while details scroll.
 */
export function PageCardIdentityHeader({
  title,
  typeLine,
  address,
  logoUrl,
  icon,
  chips,
  verified,
  executive,
  backLabel,
  onBack,
  onAdvertise,
}: {
  title: string;
  typeLine?: string | null;
  address?: string | null;
  logoUrl?: string | null;
  icon?: string | null;
  chips: PageAudienceChip[];
  verified?: boolean;
  executive?: boolean;
  backLabel?: string;
  onBack?: () => void;
  /** Owner-only — open Advertise for this page. */
  onAdvertise?: () => void;
}) {
  return (
    <div className="space-y-2">
      {onBack ? (
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1 rounded-full py-1 pr-2 text-[13px] font-semibold text-foreground-muted transition active:opacity-70"
          aria-label={`Back to ${backLabel ?? 'previous'}`}
        >
          <IconArrowLeft className="h-4 w-4" />
          <span>{backLabel ?? 'Back'}</span>
        </button>
      ) : null}

      <div className="flex items-start gap-3">
        <PageLogoDisc
          title={title}
          logoUrl={logoUrl}
          icon={icon}
          size="md"
          verified={verified}
          executive={executive}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <h2 className="min-w-0 truncate text-[1.05rem] font-semibold tracking-tight text-foreground">
              {title}
            </h2>
            {verified ? (
              <IconShield className="h-3.5 w-3.5 shrink-0 text-lake-blue" />
            ) : null}
          </div>
          {typeLine ? (
            <p className="mt-0.5 truncate text-[12px] text-foreground-muted">{typeLine}</p>
          ) : null}
          {address ? (
            <p className="mt-0.5 truncate text-[12px] text-foreground-muted">{address}</p>
          ) : null}
          <PageAudienceChips chips={chips} className="mt-1.5" />
        </div>
      </div>

      {onAdvertise ? (
        <button
          type="button"
          onClick={onAdvertise}
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-lake-blue px-3 py-2.5 text-[14px] font-semibold text-white transition active:scale-[0.99]"
        >
          <IconBillboard className="h-4 w-4 shrink-0" />
          Advertise
        </button>
      ) : null}
    </div>
  );
}
