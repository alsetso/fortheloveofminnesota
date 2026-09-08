'use client';

import { useRouter } from 'next/navigation';
import { PageScroll } from '@/features/appShell/PageScroll';
import DockPageFoundationPane from '@/features/map/dockCore/panes/DockPageFoundationPane';
import { IconArrowLeft } from '@/features/map/dockCore/core/icons';
import { safePadTop } from '@/lib/despia/safeArea';
import { DISCOVER_PATH } from '@/lib/routes/routePolicy';

/** Despia push header — matches Discover subpages (safe area + lake-blue back). */
function PageLaunchHeader({ onBack }: { onBack: () => void }) {
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
          Create a page
        </h1>
        <div className="ml-auto w-[88px]" aria-hidden />
      </div>
    </header>
  );
}

/**
 * /pages/new — standalone page launch (same flow as map dock, on a scroll surface).
 */
export default function PageLaunchPage() {
  const router = useRouter();

  return (
    <PageScroll>
      <PageLaunchHeader
        onBack={() => {
          if (typeof window !== 'undefined' && window.history.length > 1) {
            router.back();
            return;
          }
          router.push(DISCOVER_PATH);
        }}
      />
      <div className="px-4 pb-10">
        <DockPageFoundationPane mode="launch" title="Create a page" />
      </div>
    </PageScroll>
  );
}
