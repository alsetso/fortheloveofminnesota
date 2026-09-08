import type { TextLayerData } from '@/components/media/capture/TextOverlay/types';

/** ios-2 compose media — up to 10 photos + 1 short video. */
export const COMMUNITY_POST_MAX_PHOTOS = 10;
export const COMMUNITY_POST_MAX_VIDEOS = 1;

export const COMMUNITY_POST_PHOTO_MAX_BYTES = 15 * 1024 * 1024;
export const COMMUNITY_POST_VIDEO_MAX_BYTES = 100 * 1024 * 1024;
/** Hold-to-record / library clip cap. */
export const COMMUNITY_POST_VIDEO_MAX_SECONDS = 15;

export type ComposeMediaKind = 'image' | 'video';

export type ComposeUploadPhase =
  | 'queued'
  | 'waiting_network'
  | 'uploading'
  | 'done'
  | 'error';

export type ComposeMedia = {
  /** Stable client id for list keys / remove. */
  id: string;
  kind: ComposeMediaKind;
  /** Local preview (object URL or remote URL after upload). */
  previewUrl: string;
  /** Lightweight poster for video tiles (data URL) — avoid full video in the rail. */
  thumbUrl?: string | null;
  /** Public URL after upload — required before submit. */
  remoteUrl: string | null;
  /** R2 object key after upload — persisted on `post_media.meta.key`. */
  storageKey: string | null;
  /** 0–1 while uploading to R2 (undefined when idle). */
  uploadProgress?: number;
  /** Queue / network-aware upload state for clear UX on weak cellular. */
  uploadPhase?: ComposeUploadPhase;
  uploadStatusMessage?: string;
  fileName: string;
  uploading?: boolean;
  /**
   * Video-only CSS text overlays (not baked in). Photos flatten text before upload.
   * TODO(ffmpeg): server-side burn-in for exported clips.
   */
  textLayers?: TextLayerData[];
};

/** @deprecated Use {@link ComposeMedia}. */
export type ComposePhoto = ComposeMedia;

/** Validate a single image file (type + size). */
export function assertImageFile(file: File): string | null {
  if (!file.type.startsWith('image/')) {
    return 'That file is not a photo.';
  }
  if (file.size > COMMUNITY_POST_PHOTO_MAX_BYTES) {
    return 'Photo is too large (max 15 MB).';
  }
  return null;
}

/** Validate a single video file (type + size). Duration checked separately when known. */
export function assertVideoFile(file: File): string | null {
  if (!file.type.startsWith('video/')) {
    return 'That file is not a video.';
  }
  if (file.size > COMMUNITY_POST_VIDEO_MAX_BYTES) {
    return 'Video is too large (max 100 MB).';
  }
  return null;
}

export function assertMediaFile(file: File): string | null {
  if (file.type.startsWith('video/')) return assertVideoFile(file);
  if (file.type.startsWith('image/')) return assertImageFile(file);
  return 'Only photos and one short video are allowed.';
}

export function mediaKindOfFile(file: File): ComposeMediaKind | null {
  if (file.type.startsWith('video/')) return 'video';
  if (file.type.startsWith('image/')) return 'image';
  return null;
}

/** Read duration via a temporary media element. Rejects if unreadable. */
export function readVideoDurationSeconds(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const el = document.createElement('video');
    el.preload = 'metadata';
    el.muted = true;
    el.playsInline = true;
    const cleanup = () => {
      el.removeAttribute('src');
      el.load();
      URL.revokeObjectURL(url);
    };
    el.onloadedmetadata = () => {
      const d = el.duration;
      cleanup();
      if (!Number.isFinite(d) || d <= 0) reject(new Error('Could not read video length'));
      else resolve(d);
    };
    el.onerror = () => {
      cleanup();
      reject(new Error('Could not read video'));
    };
    el.src = url;
  });
}

/** @deprecated Use {@link assertImageFile}. */
export const assertSingleImageFile = assertImageFile;
