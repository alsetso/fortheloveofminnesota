'use client';

/**
 * Inline meta under the place map — kind, visit stamp, open-on-map.
 * Replaces the floating boundary card and the large “Open on map” CTA card.
 */

type PlaceIdentityStripProps = {
  kindLabel: string;
  visited: boolean;
  xpAmount: number | null;
  onOpenMap: () => void;
  /** CTU-only — hide stamp / visit-to-stamp for reference territory kinds. */
  showPresence?: boolean;
};

export function PlaceIdentityStrip({
  kindLabel,
  visited,
  xpAmount,
  onOpenMap,
  showPresence = true,
}: PlaceIdentityStripProps) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
      <span className="text-[12px] font-semibold uppercase tracking-wide text-foreground-muted">
        {kindLabel}
      </span>
      {showPresence ? (
        <>
          <span className="text-foreground-muted/40" aria-hidden>
            ·
          </span>
          {visited ? (
            <span className="text-[13px] font-semibold text-lake-blue">
              Stamped
              {xpAmount != null && xpAmount > 0 ? (
                <span className="font-medium text-foreground-muted"> · +{xpAmount} XP</span>
              ) : null}
            </span>
          ) : (
            <span className="text-[13px] text-foreground-muted">Visit to stamp</span>
          )}
        </>
      ) : null}
      <span className="flex-1" />
      <button
        type="button"
        onClick={onOpenMap}
        className="text-[13px] font-semibold text-lake-blue transition active:opacity-70"
      >
        Open on map
      </button>
    </div>
  );
}
