'use client';

import { useRef, useState, type DragEvent, type ReactNode } from 'react';
import { IconUser } from '@/features/map/dockCore/core/icons';

type ContactAvatarCircleProps = {
  src?: string | null;
  name?: string | null;
  size?: 'md' | 'lg' | 'xl';
  uploading?: boolean;
  disabled?: boolean;
  /** When set, circle is interactive (click / drop to pick a photo). */
  onFile?: (file: File) => void;
  className?: string;
};

const SIZE = {
  md: 'h-16 w-16',
  lg: 'h-20 w-20',
  xl: 'h-28 w-28',
} as const;

function initialsFromName(name: string | null | undefined): string {
  if (!name?.trim()) return '';
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}

/**
 * Simple circular contact photo.
 * Empty = dashed ring + soft prompt. Click or drop an image to set.
 */
export function ContactAvatarCircle({
  src,
  name,
  size = 'lg',
  uploading = false,
  disabled = false,
  onFile,
  className = '',
}: ContactAvatarCircleProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [imgFailed, setImgFailed] = useState(false);
  const [dragging, setDragging] = useState(false);
  const interactive = Boolean(onFile) && !disabled && !uploading;
  const showImage = Boolean(src?.trim()) && !imgFailed;
  const initials = initialsFromName(name);

  function takeFile(file: File | undefined | null) {
    if (!file || !onFile) return;
    if (!file.type.startsWith('image/')) return;
    onFile(file);
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    if (!interactive) return;
    takeFile(e.dataTransfer.files?.[0]);
  }

  const ring = dragging
    ? 'border-lake-blue bg-lake-blue/10 ring-2 ring-lake-blue/30'
    : showImage
      ? 'border-transparent'
      : 'border-dashed border-black/20 bg-black/[0.03]';

  const inner: ReactNode = uploading ? (
    <span className="text-[11px] font-medium text-foreground-muted">…</span>
  ) : showImage ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src!}
      alt=""
      className="h-full w-full rounded-full object-cover"
      onError={() => setImgFailed(true)}
      decoding="async"
      referrerPolicy="no-referrer"
    />
  ) : initials ? (
    <span className="text-[18px] font-semibold text-lake-blue">{initials}</span>
  ) : (
    <span className="flex flex-col items-center gap-0.5 text-foreground-muted">
      <IconUser className="h-6 w-6" />
      <span className="text-[9px] font-semibold uppercase tracking-wide">Add</span>
    </span>
  );

  if (!interactive) {
    return (
      <span
        className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border-2 ${SIZE[size]} ${ring} ${className}`}
        aria-hidden
      >
        {inner}
      </span>
    );
  }

  return (
    <div className={`inline-flex flex-col items-center gap-1.5 ${className}`}>
      <button
        type="button"
        aria-label={showImage ? 'Change photo' : 'Add photo'}
        disabled={!interactive}
        onClick={() => inputRef.current?.click()}
        onDragEnter={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          setDragging(false);
        }}
        onDrop={onDrop}
        className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border-2 transition active:scale-[0.98] ${SIZE[size]} ${ring}`}
      >
        {inner}
      </button>
      <p className="text-[11px] text-foreground-muted">
        {uploading ? 'Uploading…' : showImage ? 'Tap to change' : 'Tap or drop a photo'}
      </p>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          takeFile(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
    </div>
  );
}
