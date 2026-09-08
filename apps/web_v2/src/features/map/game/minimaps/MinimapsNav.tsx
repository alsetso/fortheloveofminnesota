'use client';

/**
 * Floating capsule nav for the Minimaps sheet — Objects / Unlocked / Records.
 */

import type { ComponentType } from 'react';
import {
  MINIMAPS_NAV_CAPSULE_PX,
  MINIMAPS_NAV_FLOAT_GAP_PX,
  MINIMAPS_TABS,
  type MinimapsTabId,
} from '@/features/map/game/minimaps/minimapsTabs';
import { haptic } from '@/lib/despia/haptics';
import { safePadBottom } from '@/lib/despia/safeArea';

function IconObjects({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <circle cx="8" cy="9" r="2.25" />
      <circle cx="16.5" cy="7.5" r="1.75" />
      <circle cx="14" cy="16" r="2.5" />
    </svg>
  );
}

function IconUnlocked({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M9 4.5 3.5 6.5v13L9 17.5l6 2 5.5-2v-13L15 6.5 9 4.5z" />
      <path d="M9 4.5v13M15 6.5v13" />
    </svg>
  );
}

function IconRecords({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <rect x="4" y="3.5" width="16" height="17" rx="2.5" />
      <path d="M8 8h8M8 12h8M8 16h5" />
    </svg>
  );
}

const TAB_ICON: Record<MinimapsTabId, ComponentType<{ className?: string }>> = {
  objects: IconObjects,
  unlocked: IconUnlocked,
  records: IconRecords,
};

export function MinimapsNav({
  active,
  onChange,
  zoneAccent = false,
}: {
  active: MinimapsTabId;
  onChange: (tab: MinimapsTabId) => void;
  zoneAccent?: boolean;
}) {
  return (
    <nav
      aria-label="Minimaps"
      data-minimaps="nav"
      className="pointer-events-none absolute inset-x-0 bottom-0 z-30"
      style={{ paddingBottom: safePadBottom(`${MINIMAPS_NAV_FLOAT_GAP_PX}px`) }}
    >
      <div
        className="pointer-events-auto mx-auto w-[min(100%-1.25rem,22rem)]"
        style={{ height: MINIMAPS_NAV_CAPSULE_PX }}
      >
        <div
          className={`flex h-full items-stretch justify-between rounded-full border px-1 shadow-[0_10px_32px_rgba(0,0,0,0.28)] [backdrop-filter:blur(24px)] [-webkit-backdrop-filter:blur(24px)] ${
            zoneAccent
              ? 'border-violet-300/25 bg-[#1a1028]/92'
              : 'border-white/12 bg-black/78'
          }`}
          role="tablist"
        >
          {MINIMAPS_TABS.map((tab) => {
            const Icon = TAB_ICON[tab.id];
            const isActive = active === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-label={tab.label}
                aria-selected={isActive}
                onClick={() => {
                  if (isActive) return;
                  haptic.toggle();
                  onChange(tab.id);
                }}
                className="flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-full px-1 transition active:scale-[0.96]"
              >
                <span
                  className={`inline-flex h-8 w-8 items-center justify-center rounded-full transition-colors ${
                    isActive
                      ? zoneAccent
                        ? 'bg-violet-500/35 text-violet-100'
                        : 'bg-white/18 text-white'
                      : 'text-white/40'
                  }`}
                >
                  <Icon className="h-[1.2rem] w-[1.2rem]" />
                </span>
                <span
                  className={`text-[9px] font-semibold uppercase tracking-[0.12em] ${
                    isActive ? 'text-white/90' : 'text-white/35'
                  }`}
                >
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
