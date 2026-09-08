'use client';

import { useState, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react';
import VideoTextOverlays from '@/components/media/capture/TextOverlay/VideoTextOverlays';
import type { PinPostMedia } from '@/features/community/pinPostApi';
import {
  PinMediaLightbox,
  type PinMediaLightboxAuthor,
} from '@/features/community/PinMediaLightbox';
import { IconRefresh } from '@/features/map/dockCore/core/icons';
import { MAP_DOCK_GLASS_BORDER_CLASS } from '@/features/map/dockCore/core/mapDockTokens';

function isVideo(item: PinPostMedia): boolean {
  if (item.type === 'video') return true;
  if (item.type === 'image') return false;
  return /\.(mp4|webm|mov|m4v|ogg)(\?|#|$)/i.test(item.url);
}

function withCacheBust(url: string, token: number): string {
  if (!token) return url;
  // data: URLs can't use query params — return as-is (reload remounts via key).
  if (url.startsWith('data:')) return url;
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}_retry=${token}`;
}

/** Fill a sized parent. Avoid stacking `relative` + `absolute` on this node (Tailwind prefers relative). */
function MediaTile({
  item,
  className = '',
  onOpen,
}: {
  item: PinPostMedia;
  className?: string;
  /** Images only — opens the fullscreen pager. */
  onOpen?: () => void;
}) {
  const video = isVideo(item);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const src = withCacheBust(item.url, retry);
  const openable = Boolean(onOpen) && !video;

  const onReload = (e: MouseEvent) => {
    e.stopPropagation();
    setFailed(false);
    setRetry((n) => n + 1);
  };

  return (
    <div
      className={`min-h-0 min-w-0 overflow-hidden bg-black/[0.06] ${className}${
        openable ? ' cursor-pointer' : ''
      }`}
      onClick={openable ? onOpen : undefined}
      onKeyDown={
        openable
          ? (e: KeyboardEvent) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onOpen?.();
              }
            }
          : undefined
      }
      role={openable ? 'button' : undefined}
      tabIndex={openable ? 0 : undefined}
      aria-label={openable ? 'View photo' : undefined}
    >
      {video ? (
        <div className="relative h-full w-full">
          <video
            key={`v-${item.id}-${retry}`}
            src={src}
            className="h-full w-full object-cover"
            // Audible playback via native controls — no autoplay-with-sound.
            playsInline
            controls
            preload="metadata"
            onError={() => setFailed(true)}
            onLoadedData={() => setFailed(false)}
          />
          {/* CSS overlays until ffmpeg burn-in exists. */}
          <VideoTextOverlays layers={item.textLayers} />
        </div>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={`i-${item.id}-${retry}`}
          src={src}
          alt={item.alt || ''}
          className="h-full w-full object-cover"
          onError={() => setFailed(true)}
          onLoad={() => setFailed(false)}
        />
      )}

      {failed ? (
        <div className="absolute inset-0 z-[1] flex flex-col items-center justify-center gap-2 bg-black/45 px-3">
          <p className="text-center text-[12px] font-medium text-white/90">
            Couldn’t load {video ? 'video' : 'photo'}
          </p>
          <button
            type="button"
            onClick={onReload}
            aria-label="Reload media"
            className="inline-flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-2 text-[13px] font-semibold text-foreground shadow-sm transition active:scale-95"
          >
            <IconRefresh className="h-4 w-4" />
            Reload
          </button>
        </div>
      ) : null}
    </div>
  );
}

/** Post/pin media above the caption. `compact` shortens the hero for half-snap dock cards. */
export function PinPostMediaBlock({
  media,
  compact = false,
  lightboxFooter,
  lightboxAuthor,
}: {
  media: PinPostMedia[];
  compact?: boolean;
  /** Rendered under the fullscreen image pager (like / comment). */
  lightboxFooter?:
    | ReactNode
    | ((api: { close: () => void }) => ReactNode);
  /** Account chip opposite the close control. */
  lightboxAuthor?: PinMediaLightboxAuthor | null;
}) {
  const items = media.filter((m) => typeof m.url === 'string' && m.url.trim());
  const images = items.filter((m) => !isVideo(m));
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const closeLightbox = () => setPreviewIndex(null);

  if (items.length === 0) return null;

  const openImage = (item: PinPostMedia) => {
    const idx = images.findIndex((img) => (img.id || img.url) === (item.id || item.url));
    if (idx >= 0) setPreviewIndex(idx);
  };

  const tile = (item: PinPostMedia, className: string) => (
    <MediaTile
      key={item.id || item.url}
      item={item}
      className={className}
      onOpen={isVideo(item) ? undefined : () => openImage(item)}
    />
  );

  const footer =
    typeof lightboxFooter === 'function'
      ? lightboxFooter({ close: closeLightbox })
      : lightboxFooter;

  return (
    <>
      {items.length === 1 ? (
        <div
          className={`relative mt-2 w-full overflow-hidden rounded-2xl ${
            compact ? 'aspect-[4/3] max-h-[min(36vh,16rem)]' : 'aspect-square'
          } ${MAP_DOCK_GLASS_BORDER_CLASS}`}
        >
          {tile(items[0]!, 'absolute inset-0')}
        </div>
      ) : items.length === 2 ? (
        <div
          className={`relative mt-2 grid w-full grid-cols-2 gap-0.5 overflow-hidden rounded-2xl ${
            compact ? 'aspect-[4/3] max-h-[min(36vh,16rem)]' : 'aspect-[4/3]'
          } ${MAP_DOCK_GLASS_BORDER_CLASS}`}
        >
          {tile(items[0]!, 'relative h-full w-full')}
          {tile(items[1]!, 'relative h-full w-full')}
        </div>
      ) : items.length === 3 ? (
        <div
          className={`relative mt-2 grid w-full grid-cols-2 grid-rows-2 gap-0.5 overflow-hidden rounded-2xl ${
            compact ? 'aspect-[4/3] max-h-[min(36vh,16rem)]' : 'aspect-square'
          } ${MAP_DOCK_GLASS_BORDER_CLASS}`}
        >
          {tile(items[0]!, 'relative row-span-2 h-full w-full')}
          {tile(items[1]!, 'relative h-full w-full')}
          {tile(items[2]!, 'relative h-full w-full')}
        </div>
      ) : (
        <div
          className={`relative mt-2 grid w-full grid-cols-2 grid-rows-2 gap-0.5 overflow-hidden rounded-2xl ${
            compact ? 'aspect-[4/3] max-h-[min(36vh,16rem)]' : 'aspect-square'
          } ${MAP_DOCK_GLASS_BORDER_CLASS}`}
        >
          {items.slice(0, 4).map((item, i) => {
            const extra = items.length - 4;
            return (
              <div key={item.id || i} className="relative h-full min-h-0 w-full">
                {tile(item, 'absolute inset-0')}
                {i === 3 && extra > 0 ? (
                  <div className="pointer-events-none absolute inset-0 z-[2] flex items-center justify-center bg-black/55">
                    <span className="text-sm font-semibold text-white">+{extra}</span>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      {previewIndex != null && images.length > 0 ? (
        <PinMediaLightbox
          items={images}
          index={previewIndex}
          onClose={closeLightbox}
          onIndexChange={setPreviewIndex}
          footer={footer}
          author={lightboxAuthor}
        />
      ) : null}
    </>
  );
}
