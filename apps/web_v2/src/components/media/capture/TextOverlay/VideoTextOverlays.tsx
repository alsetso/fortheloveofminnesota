'use client';

/**
 * CSS-positioned text layers over a video element at playback time.
 *
 * TODO(ffmpeg): replace with server-side burn-in when exporting/sharing clips.
 * Client-side frame compositing is intentionally not attempted in v1.
 */

import TextLayer from '@/components/media/capture/TextOverlay/TextLayer';
import type { TextLayerData } from '@/components/media/capture/TextOverlay/types';

export type VideoTextOverlaysProps = {
  layers: readonly TextLayerData[] | null | undefined;
  className?: string;
};

/** Non-interactive overlays — parent should be `relative` over the video. */
export default function VideoTextOverlays({
  layers,
  className = '',
}: VideoTextOverlaysProps) {
  if (!layers?.length) return null;
  return (
    <div
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
      aria-hidden
    >
      {layers.map((layer) => (
        <TextLayer key={layer.id} layer={layer} interactive={false} />
      ))}
    </div>
  );
}
