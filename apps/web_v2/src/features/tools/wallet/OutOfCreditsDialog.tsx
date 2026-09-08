'use client';

import { useRouter } from 'next/navigation';
import DialogBackdrop from '@/components/sheets/DialogBackdrop';
import { useMapDock } from '@/features/map/dockCore/shell/MapDockContext';
import {
  MAP_DOCK_GLASS_BORDER_CLASS,
  MAP_DOCK_GLASS_FILL_CLASS,
} from '@/features/map/dockCore/core/mapDockTokens';
import { useWalletSummary } from '@/features/tools/wallet/useWalletSummary';
import { settingsBillingPath } from '@/lib/routes/routePolicy';

/**
 * Out-of-credits dialog — earn-only for V1 (no purchase path).
 * Balance management lives on Settings → Billing.
 */
export default function OutOfCreditsDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const { collapse } = useMapDock();
  const { refresh } = useWalletSummary();

  if (!open) return null;

  return (
    <DialogBackdrop
      onClose={onClose}
      layer="CRITICAL_DIALOG"
      className="px-6 backdrop-blur-[2px]"
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="out-of-credits-title"
        className={`mx-auto w-full max-w-[300px] overflow-hidden rounded-[16px] text-center shadow-2xl ${MAP_DOCK_GLASS_FILL_CLASS} ${MAP_DOCK_GLASS_BORDER_CLASS}`}
      >
        <div className="px-5 pb-4 pt-5">
          <h2 id="out-of-credits-title" className="text-[17px] font-semibold text-foreground">
            Out of credits
          </h2>
          <p className="mt-1.5 text-[13px] leading-[18px] text-foreground-muted">
            You don&apos;t have enough credits for this lookup. Earn more by collecting
            coins and finds on the map around you.
          </p>
        </div>
        <div className="border-t border-black/10">
          <button
            type="button"
            autoFocus
            onClick={() => {
              onClose();
              void refresh();
              collapse();
              router.push(settingsBillingPath());
            }}
            className="w-full border-b border-black/10 py-3 text-[16px] font-semibold text-lake-blue"
          >
            View balance
          </button>
          <button
            type="button"
            onClick={onClose}
            className="w-full py-3 text-[16px] font-medium text-foreground"
          >
            Not now
          </button>
        </div>
      </div>
    </DialogBackdrop>
  );
}
