'use client';

/**
 * XP Receipt — shared "Claimed!" / "Collected!" confirmation card.
 * Same visual language across unlock, global Pending XP overlay, and Today.
 *
 * When levelUpPrepared, Continue releases the held Level Up Ceremony so it
 * overlays next (receipt → ceremony). Always requires an explicit tap.
 */

import DialogBackdrop from '@/components/sheets/DialogBackdrop';
import { releaseLevelUpSequence } from '@/features/xp/store/levelUpStore';

export type XpClaimedSuccessProps = {
  title?: string;
  /** Primary reward line, e.g. "+30 XP" or "+10 XP · Hennepin County". */
  rewardLine: string;
  /** Secondary standing line, e.g. "Level 2 · 255 XP total". */
  standingLine?: string | null;
  /** Optional source list under the reward (multi-territory claim). */
  sources?: { id: string; name: string; detail?: string; amount: number }[];
  /** Grant crossed a level — button becomes Continue and releases the sequence. */
  levelUpPrepared?: boolean;
  onClose: () => void;
  ariaLabel?: string;
};

export function XpClaimedSuccessModal({
  title = 'Claimed!',
  rewardLine,
  standingLine,
  sources,
  levelUpPrepared = false,
  onClose,
  ariaLabel = 'XP claimed',
}: XpClaimedSuccessProps) {
  function handleClose() {
    // Arm the ceremony queue before unmounting the receipt so the overlay
    // paints in the same turn (Continue → Level Up Ceremony).
    if (levelUpPrepared) releaseLevelUpSequence();
    onClose();
  }

  return (
    <DialogBackdrop
      onClose={handleClose}
      dimClassName="bg-black/60"
      className="px-5"
      ariaLabel={ariaLabel}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="xp-claimed-title"
        className="mx-auto w-full max-w-sm overflow-hidden rounded-2xl bg-[#1c1c1e] text-center shadow-xl"
      >
        <div className="border-b border-white/10 px-5 py-6">
          <h2
            id="xp-claimed-title"
            className="text-[22px] font-bold tracking-tight text-white"
          >
            {title}
          </h2>
          <p className="mt-2 text-[15px] leading-snug text-white/70">{rewardLine}</p>
          {standingLine ? (
            <p className="mt-1.5 text-[12px] text-white/40">{standingLine}</p>
          ) : null}
          {levelUpPrepared ? (
            <p className="mt-3 text-[12px] font-semibold uppercase tracking-wide text-[#5BA3FF]">
              Level up ready
            </p>
          ) : null}

          {sources && sources.length > 0 ? (
            <ul className="mt-4 max-h-36 space-y-1.5 overflow-y-auto text-left">
              {sources.map((s) => (
                <li
                  key={s.id}
                  className="flex items-center justify-between gap-3 rounded-xl bg-white/5 px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-semibold text-white">{s.name}</p>
                    {s.detail ? (
                      <p className="mt-0.5 text-[11px] text-white/45">{s.detail}</p>
                    ) : null}
                  </div>
                  <span className="shrink-0 text-[13px] font-bold tabular-nums text-[#5BA3FF]">
                    +{s.amount}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        <button
          type="button"
          onClick={handleClose}
          className="w-full py-3.5 text-[16px] font-semibold text-[#5BA3FF] transition active:bg-white/5"
        >
          {levelUpPrepared ? 'Continue' : 'Nice'}
        </button>
      </div>
    </DialogBackdrop>
  );
}
