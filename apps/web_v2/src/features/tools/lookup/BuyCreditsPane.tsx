'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { DockPaneShell, DockSection } from '@/features/map/dockCore/panes/DockPaneShell';
import { useMapDock } from '@/features/map/dockCore/shell/MapDockContext';
import { settingsBillingPath } from '@/lib/routes/routePolicy';

/**
 * Legacy buy-credits subpage — V1 is earn-only; redirects to Settings → Billing.
 */
export default function BuyCreditsPane() {
  const router = useRouter();
  const { collapse } = useMapDock();

  useEffect(() => {
    collapse();
    router.replace(settingsBillingPath());
  }, [collapse, router]);

  return (
    <DockPaneShell>
      <div className="space-y-5 pb-6">
        <DockSection title="Billing" subtitle="Opening Settings…">
          <p className="px-1 text-[13px] leading-snug text-foreground-muted">
            Purchases aren’t available in this version. Balance and plan live in
            Settings → Billing.
          </p>
        </DockSection>
      </div>
    </DockPaneShell>
  );
}
