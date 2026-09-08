'use client';

/**
 * `/discover/standing` — level, unlocked areas, and collectibles (off Discover home).
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { usePassport } from '@/features/accountTerritories/store/usePassport';
import { PageScroll } from '@/features/appShell/PageScroll';
import { useAuthSafe } from '@/features/auth';
import { DiscoverCollectiblesSection } from '@/features/discover/DiscoverCollectiblesSection';
import { DiscoverLevelSection } from '@/features/discover/DiscoverLevelSection';
import { AreasPlacesSection } from '@/features/explore/shared/AreasPlacesSection';
import { IconArrowLeft } from '@/features/map/dockCore/core/icons';
import { TodayRecordHost, type TodayRecord } from '@/features/today/records';
import { safePadTop } from '@/lib/despia/safeArea';
import {
  DISCOVER_PATH,
  discoverKindPath,
} from '@/lib/routes/routePolicy';
import { passportKindByUnitKind } from '@/features/accountTerritories/store/passportKinds';

function StandingPushHeader({ onBack }: { onBack: () => void }) {
  return (
    <header
      className="sticky top-0 z-10 border-b border-black/[0.08] bg-[#f7f5f1]"
      style={{ paddingTop: safePadTop('0.2rem') }}
    >
      <div className="relative flex h-11 items-center px-3">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to Discover"
          className="relative z-[1] inline-flex h-9 items-center gap-0.5 rounded-full px-1.5 text-lake-blue transition active:opacity-70"
        >
          <IconArrowLeft className="h-5 w-5" />
          <span className="text-[16px] font-semibold">Discover</span>
        </button>
        <h1 className="pointer-events-none absolute inset-x-0 truncate px-24 text-center text-[17px] font-bold tracking-tight text-foreground">
          Your standing
        </h1>
        <div className="ml-auto w-[88px]" aria-hidden />
      </div>
    </header>
  );
}

export default function DiscoverStandingPage() {
  const router = useRouter();
  const { account } = useAuthSafe();
  const accountId = account?.id ?? null;
  const { passport, loading: passportLoading } = usePassport(accountId);
  const [selectedRecord, setSelectedRecord] = useState<TodayRecord | null>(null);

  return (
    <PageScroll>
      <StandingPushHeader onBack={() => router.push(DISCOVER_PATH)} />

      <div className="pb-10">
        {!accountId ? (
          <p className="px-5 py-8 text-center text-[14px] leading-relaxed text-foreground-muted">
            Sign in to see your level, unlocked areas, and collectibles.
          </p>
        ) : (
          <>
            <DiscoverLevelSection onSelectRecord={setSelectedRecord} />
            <div className="pt-2">
              <AreasPlacesSection
                accountId={accountId}
                passport={passport}
                loading={passportLoading}
                variant="explore"
                onSelectRecord={setSelectedRecord}
                onOpenKind={(kind) => {
                  const def = passportKindByUnitKind(kind.unitKind);
                  if (def) router.push(discoverKindPath(def.slug));
                }}
              />
            </div>
            <DiscoverCollectiblesSection />
          </>
        )}
      </div>

      <TodayRecordHost
        record={selectedRecord}
        onClose={() => setSelectedRecord(null)}
      />
    </PageScroll>
  );
}
