'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { DockPaneShell, DockSection } from '@/features/map/dockCore/panes/DockPaneShell';
import { useMapDock } from '@/features/map/dockCore/shell/MapDockContext';
import { settingsBillingPath } from '@/lib/routes/routePolicy';

/**
 * Legacy credits subpage — redirects to Settings → Billing.
 */
export default function CreditsPane() {
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
            Plan, credits, costs, and activity live in Settings → Billing.
          </p>
        </DockSection>
      </div>
    </DockPaneShell>
  );
}
