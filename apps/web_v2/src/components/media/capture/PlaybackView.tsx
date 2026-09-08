'use client';

/**
 * Capture preview playback (CameraCard).
 *
 * - No native controls — clean story-style preview.
 * - Video autoplays muted + looped (iOS WKWebView requires muted for autoplay).
 * - Live camera viewfinder stays separately muted in CameraCard.
 */

export type PlaybackViewProps = {
  src: string;
  kind: 'image' | 'video';
  className?: string;
  /** Optional poster / cover for video before play. */
  objectFit?: 'cover' | 'contain';
};

export default function PlaybackView({
  src,
  kind,
  className = '',
  objectFit = 'cover',
}: PlaybackViewProps) {
  const fitClass = objectFit === 'contain' ? 'object-contain' : 'object-cover';

  if (kind === 'image') {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        className={`h-full w-full ${fitClass} ${className}`}
        draggable={false}
      />
    );
  }

  return (
    <video
      key={src}
      src={src}
      playsInline
      autoPlay
      loop
      muted
      preload="auto"
      // No `controls` — preview chrome stays app-owned.
      className={`pointer-events-none h-full w-full ${fitClass} ${className}`}
    />
  );
}
