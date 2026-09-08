/**
 * Despia Local CDN + R2-backed media drafts (Recents).
 *
 * - Capture stays local until explicit commit (Save Draft / Send / Post).
 * - Commit → R2 upload → `community.media_drafts` row → Local CDN mirror.
 * - LocalStorage manifest remains a short-lived cache until Recents UI
 *   reads GET /api/community/media-drafts exclusively.
 *
 * @see https://setup.despia.com/local-cdn/introduction.md
 * @see https://setup.despia.com/local-cdn/reference.md
 */

import { despiaCall, getDespia, isDespia } from '@/lib/despia/despia';
import { mediaKindOfFile } from '@/lib/community/composeMediaLimits';
import { makeMediaThumbFromFile } from '@/lib/community/mediaThumbnails';
import { uploadCommunityPostMedia } from '@/lib/community/uploadCommunityPostPhoto';
import { enqueueMediaUpload, type UploadQueueStatus } from '@/lib/community/uploadQueue';

export const RECENTS_MANIFEST_STORAGE_KEY = 'ftlomn_media_recents_v1';
export const RECENTS_MANIFEST_MAX = 50;

export type MediaKind = 'image' | 'video';

/** Local CDN item from `contentServerChange` / `localcdn://read|query`. */
export type LocalCdnItem = {
  index: string;
  index_full?: string;
  extension?: string;
  local_path?: string;
  /** localhost playback URL — use as `<img>` / `<video>` src. */
  local_cdn?: string;
  /** Original remote URL that was cached. */
  cdn?: string;
  size?: string;
  status?: string;
  created_at?: string;
};

export type RecentMediaEntry = {
  id: string;
  kind: MediaKind;
  /** Public remote URL after upload (R2). */
  remoteUrl: string;
  /** R2 object key — same value stored on `media_drafts.storage_key`. */
  storageKey?: string | null;
  /** Local CDN playback URL once native cache completes; null until then. */
  localCdnUrl: string | null;
  /**
   * Lightweight JPEG data-URL poster for grid tiles.
   * Prefer this over loading a full `<video>` in Recents.
   */
  thumbUrl?: string | null;
  /** Video duration in seconds when known (from poster capture). */
  durationSec?: number | null;
  /** Relative path under Local CDN, e.g. `media/<id>.jpg`. */
  filename: string;
  /** Epoch ms — newest first in the manifest. */
  createdAt: number;
};

export type UploadAndCommitResult = {
  id: string;
  kind: MediaKind;
  remoteUrl: string;
  /** R2 object key — persist on `post_media.meta.key` / compose `storageKey`. */
  storageKey: string;
  filename: string;
  /** Present immediately only outside Despia (no Local CDN). */
  localCdnUrl: string | null;
  entry: RecentMediaEntry;
};

type RecentsListener = () => void;
type LocalCdnListener = (item: LocalCdnItem) => void;

const recentsListeners = new Set<RecentsListener>();
const localCdnListeners = new Set<LocalCdnListener>();

let bridgeReady = false;
let previousContentServerChange: ((item: LocalCdnItem) => void) | undefined;
/** Stable snapshot for useSyncExternalStore — replaced only on write. */
let recentsSnapshot: RecentMediaEntry[] = [];
let recentsHydrated = false;

declare global {
  interface Window {
    contentServerChange?: (item: LocalCdnItem) => void;
    deletedCdnItems?: LocalCdnItem[];
  }
}

function emitRecents() {
  for (const listener of recentsListeners) listener();
}

function newMediaId(): string {
  return `m-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function extensionFor(file: File, kind: MediaKind): string {
  const fromName = file.name.includes('.')
    ? (file.name.split('.').pop() ?? '').toLowerCase()
    : '';
  if (fromName && /^[a-z0-9]{2,5}$/.test(fromName)) return fromName;
  if (kind === 'video') return 'mp4';
  if (file.type === 'image/png') return 'png';
  if (file.type === 'image/webp') return 'webp';
  if (file.type === 'image/heic' || file.type === 'image/heif') return 'heic';
  return 'jpg';
}

function parseManifest(raw: string | null): RecentMediaEntry[] {
  if (!raw) return [];
  try {
    const data = JSON.parse(raw) as unknown;
    if (!Array.isArray(data)) return [];
    const out: RecentMediaEntry[] = [];
    for (const row of data) {
      if (!row || typeof row !== 'object') continue;
      const r = row as Partial<RecentMediaEntry>;
      if (typeof r.id !== 'string' || !r.id) continue;
      if (r.kind !== 'image' && r.kind !== 'video') continue;
      if (typeof r.remoteUrl !== 'string' || !r.remoteUrl) continue;
      if (typeof r.filename !== 'string' || !r.filename) continue;
      if (typeof r.createdAt !== 'number' || !Number.isFinite(r.createdAt)) continue;
      out.push({
        id: r.id,
        kind: r.kind,
        remoteUrl: r.remoteUrl,
        storageKey: typeof r.storageKey === 'string' ? r.storageKey : null,
        localCdnUrl: typeof r.localCdnUrl === 'string' ? r.localCdnUrl : null,
        thumbUrl: typeof r.thumbUrl === 'string' ? r.thumbUrl : null,
        durationSec:
          typeof r.durationSec === 'number' && Number.isFinite(r.durationSec)
            ? r.durationSec
            : null,
        filename: r.filename,
        createdAt: r.createdAt,
      });
    }
    return out;
  } catch {
    return [];
  }
}

function hydrateRecentsIfNeeded(): void {
  if (recentsHydrated || typeof window === 'undefined') return;
  recentsHydrated = true;
  try {
    recentsSnapshot = parseManifest(
      localStorage.getItem(RECENTS_MANIFEST_STORAGE_KEY),
    );
  } catch {
    recentsSnapshot = [];
  }
}

function readManifestRaw(): RecentMediaEntry[] {
  hydrateRecentsIfNeeded();
  return recentsSnapshot;
}

function writeManifestRaw(entries: RecentMediaEntry[]): void {
  if (typeof window === 'undefined') return;
  const capped = entries
    .slice()
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, RECENTS_MANIFEST_MAX);
  recentsHydrated = true;
  recentsSnapshot = capped;
  try {
    localStorage.setItem(RECENTS_MANIFEST_STORAGE_KEY, JSON.stringify(capped));
  } catch {
    /* quota / private mode — ignore; Local CDN still holds the file */
  }
  emitRecents();
}

/**
 * True when Local CDN reported a native local playback URL (not a remote/R2 URL).
 * `contentServerChange` is async — never treat a missing/pending cache as ready.
 */
export function isReadyLocalCdnUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  // Despia Local CDN playback URLs are loopback / localcdn — not the R2 public URL.
  return (
    url.startsWith('localcdn:') ||
    /^(https?:\/\/)?(127\.0\.0\.1|localhost)(:|\/|$)/i.test(url)
  );
}

/**
 * Display URL for Recents / grid tiles.
 * Prefer lightweight `thumbUrl` (poster) → ready Local CDN → remote.
 * Never require a `<video>` element for tiles when `thumbUrl` exists.
 */
export function recentThumbnailUrl(entry: RecentMediaEntry | null | undefined): string | null {
  if (!entry) return null;
  if (typeof entry.thumbUrl === 'string' && entry.thumbUrl) return entry.thumbUrl;
  if (isReadyLocalCdnUrl(entry.localCdnUrl)) return entry.localCdnUrl;
  // Videos without a poster: callers should lazy-generate — do not use <video> for grids.
  if (entry.kind === 'video') return null;
  return entry.remoteUrl || null;
}

export function getRecentsManifest(): RecentMediaEntry[] {
  return readManifestRaw();
}

export function subscribeRecentsManifest(listener: RecentsListener): () => void {
  recentsListeners.add(listener);
  return () => {
    recentsListeners.delete(listener);
  };
}

/**
 * Upsert a recents row (newest-first, capped). Metadata only — no blobs.
 */
export function upsertRecentMediaEntry(
  entry: RecentMediaEntry,
): RecentMediaEntry[] {
  const prev = readManifestRaw().filter((e) => e.id !== entry.id);
  const next = [entry, ...prev];
  writeManifestRaw(next);
  return getRecentsManifest();
}

export function removeRecentMediaEntry(id: string): RecentMediaEntry[] {
  writeManifestRaw(readManifestRaw().filter((e) => e.id !== id));
  return getRecentsManifest();
}

export function patchRecentMediaEntry(
  id: string,
  patch: Partial<
    Pick<
      RecentMediaEntry,
      'localCdnUrl' | 'remoteUrl' | 'filename' | 'thumbUrl' | 'durationSec' | 'storageKey'
    >
  >,
): RecentMediaEntry | null {
  const prev = readManifestRaw();
  const idx = prev.findIndex((e) => e.id === id);
  if (idx < 0) return null;
  const nextEntry = { ...prev[idx]!, ...patch };
  const next = prev.slice();
  next[idx] = nextEntry;
  writeManifestRaw(next);
  return nextEntry;
}

/**
 * Register `window.contentServerChange` once. Completions fan out to listeners
 * and patch the recents manifest when `item.index` matches a recent id.
 */
export function ensureLocalCdnBridge(): void {
  if (typeof window === 'undefined' || bridgeReady) return;
  bridgeReady = true;

  previousContentServerChange = window.contentServerChange;

  window.contentServerChange = (item) => {
    previousContentServerChange?.(item);

    if (item?.index) {
      const local = typeof item.local_cdn === 'string' ? item.local_cdn : null;
      // Only patch when native cache is actually ready — never store remote here.
      if (isReadyLocalCdnUrl(local)) {
        patchRecentMediaEntry(item.index, { localCdnUrl: local });
      }
    }

    for (const listener of localCdnListeners) listener(item);
  };
}

export function subscribeLocalCdn(listener: LocalCdnListener): () => void {
  ensureLocalCdnBridge();
  localCdnListeners.add(listener);
  return () => {
    localCdnListeners.delete(listener);
  };
}

/**
 * Fire-and-forget native cache write. Never await — large files can exceed the
 * bridge timeout while the download continues in the background.
 */
export function writeLocalCdn(opts: {
  remoteUrl: string;
  filename: string;
  index: string;
}): void {
  if (!isDespia()) return;
  ensureLocalCdnBridge();

  const url = encodeURIComponent(opts.remoteUrl);
  const filename = encodeURIComponent(opts.filename);
  const index = encodeURIComponent(opts.index);
  const command = `localcdn://write?url=${url}&filename=${filename}&index=${index}`;

  void getDespia().then((despia) => {
    if (!despia) return;
    // No await / no keys — completion arrives via contentServerChange.
    void despia(command);
  });
}

/** Awaitable read for one or more index ids. */
export async function readLocalCdn(
  indexes: string[],
): Promise<LocalCdnItem[]> {
  if (!isDespia() || indexes.length === 0) return [];
  ensureLocalCdnBridge();

  const data = (await despiaCall(
    `localcdn://read?index=${encodeURIComponent(JSON.stringify(indexes))}`,
    ['cdnItems'],
  )) as { cdnItems?: LocalCdnItem[] } | null;

  return Array.isArray(data?.cdnItems) ? data.cdnItems : [];
}

/** Awaitable query of all Local CDN items (when supported by the runtime). */
export async function queryLocalCdn(): Promise<LocalCdnItem[]> {
  if (!isDespia()) return [];
  ensureLocalCdnBridge();

  const data = (await despiaCall('localcdn://query', ['cdnItems'])) as {
    cdnItems?: LocalCdnItem[];
  } | null;

  return Array.isArray(data?.cdnItems) ? data.cdnItems : [];
}

/**
 * Delete from native disk. Fire-and-forget on the bridge; also drops the
 * matching recents manifest row (manual delete only — no TTL).
 */
export function deleteLocalCdn(indexes: string[]): void {
  if (indexes.length === 0) return;

  for (const id of indexes) removeRecentMediaEntry(id);

  if (!isDespia()) return;
  ensureLocalCdnBridge();

  const command = `localcdn://delete?index=${encodeURIComponent(JSON.stringify(indexes))}`;
  void getDespia().then((despia) => {
    if (!despia) return;
    void despia(command);
  });
}

/**
 * Delete Recents items: `community.media_drafts` (when ids are draft UUIDs) +
 * local manifest / Local CDN. Always clears local state even if the API fails
 * (orphan local rows after a prior partial sync).
 */
export async function deleteMediaDrafts(ids: string[]): Promise<void> {
  const cleaned = [
    ...new Set(ids.map((id) => id.trim()).filter(Boolean)),
  ].slice(0, 50);
  if (cleaned.length === 0) return;

  try {
    const res = await fetch('/api/community/media-drafts', {
      method: 'DELETE',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: cleaned }),
    });
    if (!res.ok) {
      const json = (await res.json().catch(() => null)) as { error?: string } | null;
      console.warn('[media-drafts] delete failed', json?.error ?? res.status);
    }
  } catch (e) {
    console.warn('[media-drafts] delete network error', e);
  }

  deleteLocalCdn(cleaned);
}

type MediaDraftApiRow = {
  id?: string;
  url?: string;
  key?: string;
  mediaType?: string;
  error?: string;
};

/**
 * Explicit commit path — call from Save Draft, Send, or Post only.
 *
 * 1. Upload bytes to R2 (presign + PUT; MIME already normalized at File creation)
 * 2. Insert/upsert `community.media_drafts` via POST /api/community/media-drafts
 * 3. Mirror into Local CDN (Despia) + local cache manifest (until Recents UI is API-backed)
 *
 * Never call this from the capture shutter / preview land path.
 */
export async function uploadAndCommitToRecents(opts: {
  file: File;
  authUserId: string;
  id?: string;
  onProgress?: (ratio: number) => void;
  onQueueStatus?: (status: UploadQueueStatus) => void;
}): Promise<UploadAndCommitResult> {
  const kind = mediaKindOfFile(opts.file);
  if (!kind) throw new Error('Only photos and short videos are allowed.');

  const localId = opts.id?.trim() || newMediaId();
  const ext = extensionFor(opts.file, kind);
  const filename = `media/${localId}.${ext}`;

  // Poster before network — Recents tiles never need a full video element.
  const thumb = await makeMediaThumbFromFile(opts.file);

  const uploaded = await enqueueMediaUpload({
    id: localId,
    bytes: opts.file.size,
    onStatus: (status) => {
      opts.onQueueStatus?.(status);
      if (status.phase === 'uploading' && typeof status.progress === 'number') {
        opts.onProgress?.(status.progress);
      }
    },
    run: (onProgress) =>
      uploadCommunityPostMedia(opts.file, opts.authUserId, { onProgress }),
  });
  const remoteUrl = uploaded.publicUrl;
  const storageKey = uploaded.key;

  const res = await fetch('/api/community/media-drafts', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url: remoteUrl,
      key: storageKey,
      media_type: kind,
    }),
  });
  const json = (await res.json()) as MediaDraftApiRow;
  if (!res.ok) {
    throw new Error(json.error ?? 'Could not save media draft');
  }

  const draftId =
    typeof json.id === 'string' && json.id ? json.id : localId;

  const entry: RecentMediaEntry = {
    id: draftId,
    kind,
    remoteUrl,
    storageKey,
    localCdnUrl: null,
    thumbUrl: thumb.thumbUrl,
    durationSec: thumb.durationSec,
    filename,
    createdAt: Date.now(),
  };
  upsertRecentMediaEntry(entry);

  if (isDespia()) {
    writeLocalCdn({ remoteUrl, filename, index: draftId });
  } else {
    patchRecentMediaEntry(draftId, { localCdnUrl: remoteUrl });
  }

  return {
    id: draftId,
    kind,
    remoteUrl,
    storageKey,
    filename,
    localCdnUrl: isDespia() ? null : remoteUrl,
    entry: getRecentsManifest().find((e) => e.id === draftId) ?? entry,
  };
}

export type SaveToPhotoLibraryResult =
  | { ok: true; method: 'photos' | 'share' }
  | {
      ok: false;
      reason: 'not_despia' | 'invalid_url' | 'failed' | 'permission';
      message: string;
    };

/**
 * Explicit "Save to device" — NOT Local CDN / app recents.
 *
 * Requires public HTTPS (R2). Never pass Local CDN / blob URLs.
 *
 * Images → `savethisimage://` (Camera Roll).
 * Videos → try `savethisimage://` first (TestFlight: confirm if Despia accepts video);
 *          on failure, open native share sheet so the user can pick "Save Video".
 *
 * @see https://setup.despia.com/native-features/camera-roll
 * @see https://setup.despia.com/native-features/file-sharing.md
 */
export async function saveToPhotoLibrary(
  publicUrl: string,
  mediaType: MediaKind,
): Promise<SaveToPhotoLibraryResult> {
  const url = publicUrl.trim();
  if (!url.startsWith('https://')) {
    return {
      ok: false,
      reason: 'invalid_url',
      message: 'Save needs a public HTTPS URL (not Local CDN or blob).',
    };
  }

  if (!isDespia()) {
    // Browser / non-Despia: open the asset so the user can save manually.
    try {
      window.open(url, '_blank', 'noopener,noreferrer');
      return { ok: true, method: mediaType === 'image' ? 'photos' : 'share' };
    } catch {
      return {
        ok: false,
        reason: 'not_despia',
        message: 'Saving to Photos is only available in the app.',
      };
    }
  }

  // Photos path — also probe for video; if Despia rejects, fall through to share.
  try {
    await despiaCall(`savethisimage://?url=${encodeURIComponent(url)}`);
    return { ok: true, method: 'photos' };
  } catch {
    if (mediaType === 'image') {
      return {
        ok: false,
        reason: 'permission',
        message: 'Could not save photo. Check Photos access in Settings.',
      };
    }
  }

  // Video fallback: native share sheet (HTTPS URL) — user chooses "Save Video".
  try {
    await despiaCall(url);
    return { ok: true, method: 'share' };
  } catch {
    return {
      ok: false,
      reason: 'failed',
      message: 'Could not open the share sheet for this video.',
    };
  }
}
