'use client';

/**
 * `/map` — Play hub: full-width map hero, then level / standing.
 * Full play surface stays at `/game` (Open game map).
 */

import { useRouter } from 'next/navigation';
import { PageScroll } from '@/features/appShell/PageScroll';
import { TopBar } from '@/features/appShell/TopBar';
import { MapExperienceZones } from '@/features/map/MapExperienceZones';
import { MapHubPreview } from '@/features/map/MapHubPreview';
import InsightsTodayDockCard from '@/features/map/game/InsightsTodayDockCard';
import WalletCreditsCount from '@/features/tools/wallet/WalletCreditsCount';
import { settingsBillingPath } from '@/lib/routes/routePolicy';

export default function MapPage() {
  const router = useRouter();

  return (
    <PageScroll>
      <TopBar
        title="Play"
        trailing={
          <WalletCreditsCount
            onOpenCredits={() => router.push(settingsBillingPath())}
          />
        }
      />
      <div className="pb-10">
        <MapHubPreview />
        <div className="px-4 pt-4">
          <InsightsTodayDockCard embedded />
        </div>
        <MapExperienceZones />
      </div>
    </PageScroll>
  );
}
