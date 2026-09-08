'use client';

import type { ReactNode } from 'react';
import {
  IconBillboard,
  IconPhoto,
  IconPost,
  IconUser,
} from '@/features/map/dockCore/core/icons';

export type ProfileContentTabId = 'about' | 'feed' | 'media' | 'pages';

const TABS: {
  id: ProfileContentTabId;
  label: string;
  Icon: (props: { className?: string }) => ReactNode;
}[] = [
  { id: 'about', label: 'About', Icon: IconUser },
  { id: 'feed', label: 'Feed', Icon: IconPost },
  { id: 'media', label: 'Media', Icon: IconPhoto },
  { id: 'pages', label: 'Pages', Icon: IconBillboard },
];

/**
 * Icon tab strip on `/:username` — About / Feed / Media / Pages.
 * Default landing tab is Feed; About holds Discover identity + game stats + traits.
 */
export function ProfileContentTabs({
  active,
  onChange,
}: {
  active: ProfileContentTabId;
  onChange: (id: ProfileContentTabId) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Profile content"
      className="relative flex border-t border-black/[0.08]"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-black/[0.08]"
      />
      {TABS.map(({ id, label, Icon }) => {
        const isActive = active === id;
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={isActive}
            aria-label={label}
            onClick={() => onChange(id)}
            className={`relative flex h-11 flex-1 items-center justify-center transition-colors active:opacity-70 ${
              isActive ? 'text-foreground' : 'text-foreground-muted'
            }`}
          >
            <Icon className="h-[22px] w-[22px]" />
            {isActive ? (
              <span
                aria-hidden
                className="absolute inset-x-0 bottom-0 z-[1] mx-auto h-[2px] w-full bg-foreground"
              />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
