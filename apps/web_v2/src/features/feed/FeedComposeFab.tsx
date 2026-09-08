'use client';

import { useState } from 'react';
import { resolvePostLocationSeed } from '@/components/media/capture/PostLocationPanel';
import CreatePostSheet from '@/features/community/CreatePostSheet';
import { useScrollRevealFab } from '@/features/appShell/pageScrollContext';
import { APP_CONTENT_MAX_WIDTH_PX } from '@/features/appShell/tabs';
import { IconPlus } from '@/features/map/dockCore/core/icons';
import { haptic } from '@/lib/despia/haptics';
import { Z_LAYER_CLASS } from '@/lib/map/zLayers';

/**
 * Floating compose control on /feed and own profile — opens Create Post.
 * Hides on scroll down (slides under tab bar); returns on scroll up.
 */
export function FeedComposeFab({ onCreated }: { onCreated?: () => void }) {
  const [open, setOpen] = useState(false);
  const scrollVisible = useScrollRevealFab();
  const show = scrollVisible && !open;

  return (
    <>
      <div
        className={`pointer-events-none fixed inset-x-0 bottom-0 ${Z_LAYER_CLASS.MAP_CHROME}`}
        aria-hidden={!show}
      >
        <div
          className="pointer-events-none relative w-full mx-auto"
          style={{ maxWidth: APP_CONTENT_MAX_WIDTH_PX }}
        >
          <button
            type="button"
            aria-label="Create post"
            tabIndex={show ? 0 : -1}
            onClick={() => {
              haptic.toggle();
              setOpen(true);
            }}
            className={`pointer-events-auto absolute right-5 inline-flex h-14 w-14 items-center justify-center rounded-full bg-lake-blue text-white shadow-[0_10px_28px_rgba(42,111,143,0.42)] transition-[transform,opacity] duration-200 ease-out active:scale-95 ${
              show
                ? 'translate-y-0 opacity-100'
                : 'pointer-events-none translate-y-[calc(100%+1.25rem)] opacity-0'
            }`}
            style={{
              bottom: 'calc(var(--app-tab-bar-clearance, 0px) + 0.75rem)',
            }}
          >
            <IconPlus className="h-7 w-7" />
          </button>
        </div>
      </div>

      {open ? (
        <CreatePostSheet
          state={resolvePostLocationSeed(null)}
          onClose={() => setOpen(false)}
          onCreated={onCreated}
        />
      ) : null}
    </>
  );
}
