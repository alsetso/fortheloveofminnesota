'use client';

import { useEffect, useState } from 'react';
import { IconPhoto } from '@/features/map/dockCore/core/icons';
import { makeVideoPoster } from '@/lib/community/mediaThumbnails';
import {
  patchRecentMediaEntry,
  recentThumbnailUrl,
  type RecentMediaEntry,
} from '@/lib/despia/media';

function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, '0')}`;
}

/**
 * Grid tile visual — always an `<img>` (or placeholder). Never mounts `<video>`
 * for Recents cells; lazy-generates a poster once if missing.
 */
export default function RecentMediaTileVisual({
  entry,
}: {
  entry: RecentMediaEntry;
}) {
  const [thumb, setThumb] = useState<string | null>(
    () => recentThumbnailUrl(entry),
  );
  const [durationSec, setDurationSec] = useState<number | null>(
    () => entry.durationSec ?? null,
  );

  useEffect(() => {
    setThumb(recentThumbnailUrl(entry));
    setDurationSec(entry.durationSec ?? null);
  }, [entry]);

  useEffect(() => {
    if (entry.kind !== 'video') return;
    if (thumb) return;
    if (!entry.remoteUrl) return;
    let cancelled = false;
    void makeVideoPoster(entry.remoteUrl).then((result) => {
      if (cancelled) return;
      if (result.thumbUrl) {
        setThumb(result.thumbUrl);
        patchRecentMediaEntry(entry.id, {
          thumbUrl: result.thumbUrl,
          durationSec: result.durationSec,
        });
      }
      if (result.durationSec != null) setDurationSec(result.durationSec);
    });
    return () => {
      cancelled = true;
    };
  }, [entry.id, entry.kind, entry.remoteUrl, thumb]);

  return (
    <>
      {thumb ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={thumb} alt="" className="h-full w-full object-cover" />
      ) : (
        <span className="flex h-full items-center justify-center bg-white/[0.06] text-white/35">
          <IconPhoto className="h-6 w-6" />
        </span>
      )}
      {entry.kind === 'video' ? (
        <span className="pointer-events-none absolute bottom-1 left-1 rounded bg-black/55 px-1 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">
          Video
        </span>
      ) : null}
      {entry.kind === 'video' && durationSec != null && durationSec > 0 ? (
        <span className="pointer-events-none absolute bottom-1 right-1 rounded bg-black/65 px-1 py-0.5 text-[10px] font-semibold tabular-nums text-white">
          {formatDuration(durationSec)}
        </span>
      ) : null}
    </>
  );
}
