import {
  COMMUNITY_POST_PHOTO_MAX_BYTES,
  COMMUNITY_POST_VIDEO_MAX_BYTES,
} from '@/lib/community/composeMediaLimits';

export const R2_ALLOWED_CONTENT_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'video/mp4',
  'video/webm',
  'video/quicktime',
] as const;

const EXT_BY_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/quicktime': 'mov',
};

const SAFE_EXT = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif', 'mp4', 'webm', 'mov', 'm4v']);

export type R2ObjectKind = 'posts' | 'pins' | 'pages';

/**
 * Strip codec/params and map to a canonical allowlisted MIME.
 * `video/mp4;codecs=avc1` → `video/mp4`. Returns null when unsupported.
 */
export function normalizeR2ContentType(raw: string): string | null {
  const base = raw.split(';')[0]?.trim().toLowerCase() ?? '';
  if (!base) return null;
  if (base === 'image/jpg') return 'image/jpeg';
  if (base === 'video/x-m4v' || base === 'video/m4v') return 'video/mp4';
  if ((R2_ALLOWED_CONTENT_TYPES as readonly string[]).includes(base)) return base;
  return null;
}

export function isAllowedR2ContentType(contentType: string): boolean {
  return normalizeR2ContentType(contentType) != null;
}

export function maxBytesForContentType(contentType: string): number {
  const normalized =
    normalizeR2ContentType(contentType) ??
    contentType.split(';')[0]?.trim().toLowerCase() ??
    contentType;
  return normalized.startsWith('video/')
    ? COMMUNITY_POST_VIDEO_MAX_BYTES
    : COMMUNITY_POST_PHOTO_MAX_BYTES;
}

/** Basename only — rejects path segments. */
export function sanitizeUploadFilename(filename: string): string | null {
  const base = filename.split(/[/\\]/).pop()?.trim() ?? '';
  if (!base || base === '.' || base === '..') return null;
  if (base.includes('\0')) return null;
  return base.slice(0, 180);
}

export function extensionForUpload(filename: string, contentType: string): string {
  const normalized =
    normalizeR2ContentType(contentType) ??
    contentType.split(';')[0]?.trim().toLowerCase() ??
    '';
  const fromType = EXT_BY_TYPE[normalized];
  const raw = filename.includes('.') ? (filename.split('.').pop() ?? '') : '';
  const fromName = raw.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (fromName && SAFE_EXT.has(fromName === 'jpeg' ? 'jpg' : fromName)) {
    return fromName === 'jpeg' ? 'jpg' : fromName;
  }
  return fromType ?? 'bin';
}

export function buildR2ObjectKey(opts: {
  authUserId: string;
  kind: R2ObjectKind;
  filename: string;
  contentType: string;
}): string {
  const safeName = sanitizeUploadFilename(opts.filename);
  if (!safeName) throw new Error('Invalid filename');
  const contentType = normalizeR2ContentType(opts.contentType) ?? opts.contentType;
  const ext = extensionForUpload(safeName, contentType);
  const rand = Math.random().toString(36).slice(2, 10);
  return `${opts.authUserId}/${opts.kind}/${Date.now()}-${rand}.${ext}`;
}
