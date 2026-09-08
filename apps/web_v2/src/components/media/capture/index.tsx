'use client';

/**
 * Instagram-style create capture — one continuous scroll surface.
 *
 * STATE 1 (first viewport): fixed-size camera card + mode rail
 * STATE 2 (on scroll / recent thumb): library snaps in; camera pushes up
 * PREVIEW: scroll locked, library hidden, share rail (location + send)
 */

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import CameraCard, {
  type CameraCapturePreview,
} from '@/components/media/capture/CameraCard';
import DiscardMediaModal from '@/components/media/capture/DiscardMediaModal';
import ModeSelector, {
  type MediaCaptureMode,
} from '@/components/media/capture/ModeSelector';
import {
  PostLocationOverlay,
  resolvePostLocationSeed,
  type PostLocationValue,
} from '@/components/media/capture/PostLocationPanel';

export { resolvePostLocationSeed };
import PreviewShareRail from '@/components/media/capture/PreviewShareRail';
import RecentsGrid from '@/components/media/capture/RecentsGrid';
import ShareConfirmModal, {
  type PostVisibility,
} from '@/components/media/capture/ShareConfirmModal';
import { flattenTextOntoImage } from '@/components/media/capture/TextOverlay/flattenTextOntoImage';
import TextInputModal from '@/components/media/capture/TextOverlay/TextInputModal';
import {
  createTextLayerDraft,
  type TextLayerData,
} from '@/components/media/capture/TextOverlay/types';
import MediaPicker from '@/components/media/picker/MediaPicker';
import { useAuthSafe } from '@/features/auth';
import { POST_CAPTION_MAX } from '@/features/community/postCaptionLimits';
import { useRecents } from '@/components/media/useRecents';
import {
  recentThumbnailUrl,
  saveToPhotoLibrary,
  uploadAndCommitToRecents,
  type RecentMediaEntry,
} from '@/lib/despia/media';
import { mediaKindOfFile } from '@/lib/community/composeMediaLimits';
import { haptic } from '@/lib/despia/haptics';
import { safePadBottom, safePadTop } from '@/lib/despia/safeArea';
import { Z_LAYER_CLASS } from '@/lib/map/zLayers';

export type { PostLocationValue };
export type { PostVisibility };

const GRID_GAP = 4;
const GRID_PAD_X = 8;
const EXPANDED_INSET_X = 10;

export type MediaCaptureResult = {
  /** Video-only overlay layers — photos are flattened before this fires. */
  textLayers?: TextLayerData[];
  /** Already-uploaded public URL (skip re-upload when present and file unchanged). */
  remoteUrl?: string;
  /** R2 object key paired with `remoteUrl`. */
  storageKey?: string;
  mediaId?: string;
  /** Caption drafted on the capture preview — applied to Create Post body. */
  caption?: string;
  /** Audience visibility set in the camera preview — passed back to compose. */
  visibility?: 'public' | 'only_me';
};

export type MediaCaptureProps = {
  open: boolean;
  onClose: () => void;
  /**
   * When true, Send confirms + creates the community post here (no Create Post sheet).
   * Attach callbacks are optional in this mode.
   */
  publishMode?: boolean;
  /** Note (or other) category id — required for publishMode submit. */
  mentionTypeId?: string | null;
  /** Fired after a successful publishMode create. */
  onPosted?: (postId: string) => void;
  /** Committed capture — parent attaches to compose (legacy attach mode). */
  onCapture?: (file: File, result?: MediaCaptureResult) => void;
  /** Native PHPicker files (Browse Library) — attach mode. */
  onPickFiles?: (files: FileList | null) => void;
  /** Multi-select Add → compose (attach mode). */
  onSelectRecent?: (entry: RecentMediaEntry) => void;
  allowVideo?: boolean;
  /** Seed pin from Create Post (map entry). */
  initialLocation?: PostLocationValue | null;
  /** Compose location updates — post-only, does not move the main map. */
  onLocationChange?: (next: PostLocationValue) => void;
  /** Footer POST tab — leave camera and open the white Create Post sheet. */
  onRequestPostCompose?: () => void;
  /** Footer STORY tab — stay on / focus camera as story publish. */
  onRequestStoryMode?: () => void;
  /** When false, skip live getUserMedia until the user is on the camera viewport. */
  cameraActive?: boolean;
  /**
   * Render inline (no portal) inside a parent snap section.
   * Parent owns the outer full-screen frame.
   */
  embedded?: boolean;
  /** Written on publishMode create — `story` vs regular `standard` post. */
  contentShape?: 'standard' | 'story';
  /**
   * Pre-fill the caption textarea with text the user already typed in the
   * parent compose pane (so they don't have to duplicate work).
   */
  initialCaption?: string;
  /**
   * Label for the send/attach button in media preview.
   * When provided, a pill with the label replaces the bare arrow icon so the
   * action is unambiguous (e.g. "Add to Post" instead of a generic send arrow).
   */
  sendLabel?: string;
  /**
   * Maximum caption length forwarded to CameraCard.
   * Defaults to `POST_CAPTION_MAX` (200). Pass `DOCK_POST_CAPTION_MAX` (240)
   * when launching from the dock composer.
   */
  captionMaxLength?: number;
};

export default function MediaCapture({
  open,
  onClose,
  publishMode = false,
  mentionTypeId = null,
  onPosted,
  onCapture,
  onPickFiles,
  onSelectRecent,
  allowVideo = true,
  initialLocation = null,
  onLocationChange,
  onRequestPostCompose,
  onRequestStoryMode,
  embedded = false,
  cameraActive = true,
  contentShape = 'standard',
  initialCaption = '',
  sendLabel,
  captionMaxLength = POST_CAPTION_MAX,
}: MediaCaptureProps) {
  const { user } = useAuthSafe();
  const { mostRecent, mostRecentThumbnailUrl, deleteRecents } = useRecents();
  const scrollRef = useRef<HTMLDivElement>(null);
  const librarySectionRef = useRef<HTMLElement>(null);
  const locationPanelRef = useRef<HTMLDivElement>(null);
  const libraryInputRef = useRef<HTMLInputElement>(null);
  const [mounted, setMounted] = useState(false);
  const [scrollTop, setScrollTop] = useState(0);
  const [mode, setMode] = useState<MediaCaptureMode>(() =>
    contentShape === 'story' || publishMode ? 'story' : 'post',
  );

  useEffect(() => {
    setMode(contentShape === 'story' || publishMode ? 'story' : 'post');
  }, [contentShape, publishMode]);
  const [viewport, setViewport] = useState({ w: 390, h: 844 });
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [preview, setPreview] = useState<CameraCapturePreview | null>(null);
  const [caption, setCaption] = useState('');
  const [visibility, setVisibility] = useState<PostVisibility>('public');
  const [discardOpen, setDiscardOpen] = useState(false);
  const [shareConfirmOpen, setShareConfirmOpen] = useState(false);
  const [postLocation, setPostLocation] = useState<PostLocationValue>(() =>
    resolvePostLocationSeed(initialLocation),
  );
  const [locationOverlayOpen, setLocationOverlayOpen] = useState(false);
  const [textLayers, setTextLayers] = useState<TextLayerData[]>([]);
  const [textDraft, setTextDraft] = useState<TextLayerData | null>(null);
  const [sending, setSending] = useState(false);
  const [saveRemoteUrl, setSaveRemoteUrl] = useState<string | null>(null);
  const [saveStorageKey, setSaveStorageKey] = useState<string | null>(null);
  const [saveMediaId, setSaveMediaId] = useState<string | null>(null);
  const [saveUploading, setSaveUploading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  const updatePostLocation = useCallback(
    (next: PostLocationValue) => {
      setPostLocation(next);
      onLocationChange?.(next);
    },
    [onLocationChange],
  );

  const clearPreview = useCallback(() => {
    setPreview((prev) => {
      if (prev?.url.startsWith('blob:')) URL.revokeObjectURL(prev.url);
      return null;
    });
    setCaption('');
    setVisibility('public');
    setDiscardOpen(false);
    setShareConfirmOpen(false);
    setLocationOverlayOpen(false);
    setTextLayers([]);
    setTextDraft(null);
    setSending(false);
    setSaveRemoteUrl(null);
    setSaveStorageKey(null);
    setSaveMediaId(null);
    setSaveUploading(false);
    setSaveStatus(null);
  }, []);

  useEffect(() => {
    setMounted(true);
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    const measure = () => {
      setViewport({
        w: window.innerWidth,
        h: window.innerHeight,
      });
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [open]);

  // Reset capture chrome only when `open` becomes true (not when parent
  // mirrors location updates back via initialLocation).
  const wasOpenRef = useRef(false);
  useEffect(() => {
    if (!open) {
      wasOpenRef.current = false;
      return;
    }
    if (wasOpenRef.current) return;
    wasOpenRef.current = true;
    setPostLocation(resolvePostLocationSeed(initialLocation));
    setCaption(initialCaption ?? '');
    setScrollTop(0);
    setSelectMode(false);
    setSelectedIds(new Set());
    setLocationOverlayOpen(false);
    clearPreview();
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: 0 });
    });
  }, [open, clearPreview, initialLocation, initialCaption]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (textDraft) {
        setTextDraft(null);
        return;
      }
      if (shareConfirmOpen) {
        setShareConfirmOpen(false);
        return;
      }
      if (locationOverlayOpen) {
        setLocationOverlayOpen(false);
        return;
      }
      if (discardOpen) {
        setDiscardOpen(false);
        return;
      }
      if (preview) {
        setDiscardOpen(true);
        return;
      }
      onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [
    open,
    onClose,
    preview,
    discardOpen,
    textDraft,
    locationOverlayOpen,
    shareConfirmOpen,
  ]);

  const previewing = preview != null;
  const libraryVisible = !previewing && scrollTop > 8;

  const openLocationEditor = useCallback(() => {
    haptic.toggle();
    if (previewing) {
      setLocationOverlayOpen(true);
      return;
    }
    const target = locationPanelRef.current ?? librarySectionRef.current;
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    scrollRef.current?.scrollTo({
      top: viewport.h,
      behavior: 'smooth',
    });
  }, [previewing, viewport.h]);

  const cellSize = Math.floor(
    (viewport.w - GRID_PAD_X * 2 - GRID_GAP * 2) / 3,
  );

  const expandToCamera = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const openRecents = useCallback(() => {
    if (previewing) return;
    const library = librarySectionRef.current;
    if (library) {
      library.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    scrollRef.current?.scrollTo({
      top: viewport.h,
      behavior: 'smooth',
    });
  }, [viewport.h, previewing]);

  const handleCaptured = useCallback((next: CameraCapturePreview) => {
    // LOCAL ONLY — no R2 / Recents until Save Draft or Send.
    setPreview((prev) => {
      if (prev?.url.startsWith('blob:')) URL.revokeObjectURL(prev.url);
      return next;
    });
    setCaption('');
    setVisibility('public');
    setShareConfirmOpen(false);
    setTextLayers([]);
    setTextDraft(null);
    setDiscardOpen(false);
    setSaveRemoteUrl(null);
    setSaveStorageKey(null);
    setSaveMediaId(null);
    setSaveUploading(false);
    setSaveStatus(null);
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: 0 });
    });
  }, []);

  /**
   * Resolve the file to commit. Photos with text are flattened into a new JPEG
   * so Recents / Photos get pixels with type baked in (not CSS overlays).
   * Returns `baked: true` when a new asset must be uploaded even if an older
   * remoteUrl exists.
   */
  const resolveCommitFile = useCallback(async () => {
    if (!preview) return null;
    const layers = textLayers.filter((l) => l.content.trim());
    if (preview.kind === 'image' && layers.length > 0) {
      const file = await flattenTextOntoImage(preview.url, layers);
      return { file, baked: true as const, layers };
    }
    return { file: preview.file, baked: false as const, layers };
  }, [preview, textLayers]);

  const handleSaveToDevice = useCallback(async () => {
    if (!preview || saveUploading) return;
    const authUserId = user?.id;
    if (!authUserId) {
      setSaveStatus('Sign in to save media');
      return;
    }

    setSaveStatus(null);
    setSaveUploading(true);
    try {
      const resolved = await resolveCommitFile();
      if (!resolved) return;

      let publicUrl = saveRemoteUrl;
      // Text on a photo → new R2 + Recents row, then download that URL.
      if (resolved.baked || !publicUrl) {
        if (preview.kind === 'video' && resolved.layers.length > 0) {
          // Video text is CSS-only until ffmpeg burn-in — download is the base clip.
          setSaveStatus('Video text isn’t baked in yet — saving clip only');
        }
        const committed = await uploadAndCommitToRecents({
          file: resolved.file,
          authUserId,
          // New id when text was baked so we don’t overwrite the plain original.
          id: resolved.baked ? undefined : saveMediaId ?? undefined,
          onQueueStatus: (status) => {
            if (status.phase === 'waiting_network') {
              setSaveStatus('Waiting for a better connection…');
            } else if (status.phase === 'queued') {
              setSaveStatus('Queued…');
            } else if (status.phase === 'uploading') {
              setSaveStatus(
                typeof status.progress === 'number'
                  ? `Uploading ${Math.round(status.progress * 100)}%`
                  : 'Uploading…',
              );
            }
          },
        });
        publicUrl = committed.remoteUrl;
        setSaveRemoteUrl(committed.remoteUrl);
        setSaveStorageKey(committed.storageKey);
        setSaveMediaId(committed.id);
        if (resolved.baked) {
          // Preview now matches the baked asset; overlays are in the pixels.
          const url = URL.createObjectURL(resolved.file);
          setPreview((prev) => {
            if (prev?.url.startsWith('blob:')) URL.revokeObjectURL(prev.url);
            return { file: resolved.file, url, kind: 'image' };
          });
          setTextLayers([]);
        }
      }

      if (!publicUrl) {
        setSaveStatus('Upload failed — save unavailable');
        return;
      }

      const result = await saveToPhotoLibrary(publicUrl, preview.kind);
      if (result.ok) {
        haptic.findMe.success();
        setSaveStatus(
          result.method === 'photos'
            ? resolved.baked
              ? 'Saved to Photos (with text)'
              : 'Saved to your Photos'
            : 'Share sheet opened — choose Save Video',
        );
      } else {
        haptic.toggle();
        setSaveStatus(result.message);
      }
    } catch (e) {
      haptic.toggle();
      setSaveStatus(e instanceof Error ? e.message : 'Could not save media');
    } finally {
      setSaveUploading(false);
    }
  }, [
    preview,
    saveUploading,
    saveRemoteUrl,
    saveMediaId,
    user?.id,
    resolveCommitFile,
  ]);

  // Auto-clear save confirmation so it reads as a toast, not permanent chrome.
  useEffect(() => {
    if (!saveStatus) return;
    const ms = /video text/i.test(saveStatus) ? 4500 : 2800;
    const t = window.setTimeout(() => setSaveStatus(null), ms);
    return () => window.clearTimeout(t);
  }, [saveStatus]);

  /** Commit capture to R2 + Recents only — stays in camera, does not compose. */
  const saveDraftToRecents = useCallback(async () => {
    if (!preview || sending || saveUploading) return;
    const authUserId = user?.id;
    if (!authUserId) {
      setSaveStatus('Sign in to save media');
      return;
    }

    setSaveUploading(true);
    setSaveStatus(null);
    setDiscardOpen(false);
    const previewUrl = preview.url;
    try {
      const resolved = await resolveCommitFile();
      if (!resolved) return;

      const videoTextDropped =
        preview.kind === 'video' && resolved.layers.length > 0;

      // Always re-upload when text was baked onto a photo (new Recents item).
      if (resolved.baked || !saveRemoteUrl || !saveStorageKey) {
        await uploadAndCommitToRecents({
          file: resolved.file,
          authUserId,
          id: resolved.baked ? undefined : saveMediaId ?? undefined,
        });
      }

      haptic.findMe.success();
      if (previewUrl.startsWith('blob:')) URL.revokeObjectURL(previewUrl);
      setPreview(null);
      setTextLayers([]);
      setTextDraft(null);
      setSaveRemoteUrl(null);
      setSaveStorageKey(null);
      setSaveMediaId(null);
      setSaveUploading(false);
      setSaveStatus(
        videoTextDropped
          ? 'Saved to Recents — video text was not included'
          : resolved.baked
            ? 'Saved to Recents (with text)'
            : 'Saved to Recents',
      );
      // Reveal the library grid under the camera.
      requestAnimationFrame(() => {
        const library = librarySectionRef.current;
        if (library) {
          library.scrollIntoView({ behavior: 'smooth', block: 'start' });
          return;
        }
        scrollRef.current?.scrollTo({
          top: viewport.h,
          behavior: 'smooth',
        });
      });
    } catch (e) {
      setSaveUploading(false);
      setSaveStatus(
        e instanceof Error ? e.message : 'Could not save media',
      );
    }
  }, [
    preview,
    sending,
    saveUploading,
    saveRemoteUrl,
    saveStorageKey,
    saveMediaId,
    user?.id,
    viewport.h,
    resolveCommitFile,
  ]);

  /** Legacy: commit media into Create Post compose. */
  const attachPreviewToCompose = useCallback(async () => {
    if (!preview || sending || saveUploading) return;
    const authUserId = user?.id;
    if (!authUserId) {
      setSaveStatus('Sign in to save media');
      return;
    }
    if (!onCapture) {
      setSaveStatus('Compose is unavailable');
      return;
    }

    setSending(true);
    setSaveUploading(true);
    setSaveStatus(null);
    const layers = textLayers.filter((l) => l.content.trim());
    const previewUrl = preview.url;
    try {
      let file = preview.file;
      let remoteUrl = saveRemoteUrl;
      let storageKey = saveStorageKey;
      let mediaId = saveMediaId;

      if (preview.kind === 'image' && layers.length > 0) {
        file = await flattenTextOntoImage(previewUrl, layers);
        remoteUrl = null;
        storageKey = null;
        mediaId = null;
      }

      if (!remoteUrl || !storageKey) {
        const committed = await uploadAndCommitToRecents({
          file,
          authUserId,
          id: mediaId ?? undefined,
        });
        remoteUrl = committed.remoteUrl;
        storageKey = committed.storageKey;
        mediaId = committed.id;
      }

      const trimmedCaption = caption.trim().slice(0, captionMaxLength);
      const result: MediaCaptureResult = {
        remoteUrl,
        storageKey,
        mediaId: mediaId ?? undefined,
        ...(trimmedCaption ? { caption: trimmedCaption } : {}),
        ...(preview.kind === 'video' && layers.length > 0
          ? { textLayers: layers }
          : {}),
        visibility,
      };

      setPreview(null);
      setCaption('');
      setTextLayers([]);
      setTextDraft(null);
      setDiscardOpen(false);
      setSaveRemoteUrl(null);
      setSaveStorageKey(null);
      setSaveMediaId(null);
      setSaveUploading(false);
      onCapture(file, result);
      if (previewUrl.startsWith('blob:')) URL.revokeObjectURL(previewUrl);
      // Embedded composer owns navigation back to the white Post viewport.
      if (embedded) onRequestPostCompose?.();
      else onClose();
    } catch (e) {
      setSending(false);
      setSaveUploading(false);
      setSaveStatus(
        e instanceof Error ? e.message : 'Could not save media',
      );
    }
  }, [
    preview,
    caption,
    sending,
    saveUploading,
    textLayers,
    saveRemoteUrl,
    saveStorageKey,
    saveMediaId,
    user?.id,
    onCapture,
    onClose,
    embedded,
    onRequestPostCompose,
    captionMaxLength,
    visibility,
  ]);

  /** Publish mode: open confirm. Attach mode: upload + hand off to compose. */
  const requestSend = useCallback(() => {
    if (!preview || sending || saveUploading) return;
    if (!user?.id) {
      setSaveStatus('Sign in to share');
      return;
    }
    if (publishMode) {
      if (
        !Number.isFinite(postLocation.lat) ||
        !Number.isFinite(postLocation.lng)
      ) {
        setSaveStatus('Set a location before sharing');
        return;
      }
      if (!mentionTypeId) {
        setSaveStatus('Could not prepare post');
        return;
      }
      setShareConfirmOpen(true);
      return;
    }
    void attachPreviewToCompose();
  }, [
    preview,
    sending,
    saveUploading,
    user?.id,
    publishMode,
    postLocation.lat,
    postLocation.lng,
    mentionTypeId,
    attachPreviewToCompose,
  ]);

  /** Confirm modal → upload + create community post, then close. */
  const publishPost = useCallback(async () => {
    if (!preview || sending || saveUploading) return;
    const authUserId = user?.id;
    if (!authUserId || !mentionTypeId) {
      setSaveStatus('Could not prepare post');
      setShareConfirmOpen(false);
      return;
    }
    if (
      !Number.isFinite(postLocation.lat) ||
      !Number.isFinite(postLocation.lng)
    ) {
      setSaveStatus('Set a location before sharing');
      setShareConfirmOpen(false);
      return;
    }

    setSending(true);
    setSaveUploading(true);
    setSaveStatus(null);
    const layers = textLayers.filter((l) => l.content.trim());
    const previewUrl = preview.url;
    try {
      let file = preview.file;
      let remoteUrl = saveRemoteUrl;
      let storageKey = saveStorageKey;
      let mediaId = saveMediaId;

      if (preview.kind === 'image' && layers.length > 0) {
        file = await flattenTextOntoImage(previewUrl, layers);
        remoteUrl = null;
        storageKey = null;
        mediaId = null;
      }

      if (!remoteUrl || !storageKey) {
        if (file.size < 1) {
          throw new Error('Media is still loading — try again');
        }
        const committed = await uploadAndCommitToRecents({
          file,
          authUserId,
          id: mediaId ?? undefined,
        });
        remoteUrl = committed.remoteUrl;
        storageKey = committed.storageKey;
        mediaId = committed.id;
      }

      const trimmedCaption = caption.trim().slice(0, POST_CAPTION_MAX);
      const res = await fetch('/api/community/posts', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: trimmedCaption,
          mention_type_id: mentionTypeId,
          visibility,
          content_shape: contentShape === 'story' ? 'story' : 'standard',
          map_data: {
            lat: postLocation.lat,
            lng: postLocation.lng,
            address: postLocation.address ?? undefined,
          },
          images: [
            {
              url: remoteUrl,
              type: preview.kind,
              key: storageKey ?? undefined,
              text_layers:
                preview.kind === 'video' && layers.length > 0
                  ? layers
                  : undefined,
            },
          ],
        }),
      });
      const json = (await res.json()) as { id?: string; error?: string };
      if (!res.ok) throw new Error(json.error ?? 'Could not create post');

      const { refreshCommunityPins } = await import('@/features/map/community');
      void refreshCommunityPins();

      setShareConfirmOpen(false);
      setPreview(null);
      setCaption('');
      setVisibility('public');
      setTextLayers([]);
      setTextDraft(null);
      setDiscardOpen(false);
      setSaveRemoteUrl(null);
      setSaveStorageKey(null);
      setSaveMediaId(null);
      setSaveUploading(false);
      setSending(false);
      if (previewUrl.startsWith('blob:')) URL.revokeObjectURL(previewUrl);
      onPosted?.(json.id ?? '');
      onClose();
    } catch (e) {
      setSending(false);
      setSaveUploading(false);
      setShareConfirmOpen(false);
      setSaveStatus(
        e instanceof Error ? e.message : 'Could not share post',
      );
    }
  }, [
    preview,
    sending,
    saveUploading,
    user?.id,
    mentionTypeId,
    postLocation.lat,
    postLocation.lng,
    postLocation.address,
    textLayers,
    saveRemoteUrl,
    saveStorageKey,
    saveMediaId,
    caption,
    visibility,
    contentShape,
    onPosted,
    onClose,
  ]);

  const openTextTool = useCallback(() => {
    setTextDraft(createTextLayerDraft());
  }, []);

  const commitTextLayer = useCallback((layer: TextLayerData) => {
    setTextLayers((prev) => {
      const idx = prev.findIndex((l) => l.id === layer.id);
      if (idx < 0) return [...prev, layer];
      const next = prev.slice();
      next[idx] = layer;
      return next;
    });
    setTextDraft(null);
  }, []);

  /**
   * Select off: tap one recent → load it into the camera preview (edit / Send /
   * download). Does not attach to compose. Select-on multi-add still uses
   * handleConfirmSelection → compose.
   */
  const handleSelectRecent = useCallback(async (entry: RecentMediaEntry) => {
    const displayUrl = recentThumbnailUrl(entry) ?? entry.remoteUrl;
    if (!displayUrl || !entry.remoteUrl.startsWith('https://')) {
      setSaveStatus('Could not open recent');
      return;
    }

    const baseName =
      entry.filename.split('/').pop()?.trim() ||
      (entry.kind === 'video' ? 'recent.mp4' : 'recent.jpg');
    const fallbackMime = entry.kind === 'video' ? 'video/mp4' : 'image/jpeg';

    setSaveStatus(null);
    setCaption('');
    setTextLayers([]);
    setTextDraft(null);
    setDiscardOpen(false);
    // Already committed — download + Send reuse this without re-upload.
    setSaveRemoteUrl(entry.remoteUrl);
    setSaveStorageKey(entry.storageKey ?? null);
    setSaveMediaId(entry.id);
    setSaveUploading(false);
    haptic.toggle();

    // Show immediately in the camera webview (R2 / Local CDN URL — no blob wait).
    setPreview((prev) => {
      if (prev?.url.startsWith('blob:')) URL.revokeObjectURL(prev.url);
      return {
        file: new File([], baseName, { type: fallbackMime }),
        url: displayUrl,
        kind: entry.kind,
      };
    });
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    });

    // Best-effort hydrate real bytes for a later Send → compose handoff.
    try {
      const res = await fetch(entry.remoteUrl);
      if (!res.ok) return;
      const blob = await res.blob();
      if (blob.size < 1) return;
      const mime = blob.type || fallbackMime;
      const file = new File([blob], baseName, { type: mime });
      const blobUrl = URL.createObjectURL(file);
      setPreview((prev) => {
        if (!prev || prev.url !== displayUrl) {
          URL.revokeObjectURL(blobUrl);
          return prev;
        }
        return { file, url: blobUrl, kind: entry.kind };
      });
    } catch {
      // Preview already shows via HTTPS; Send still works via saveRemoteUrl.
    }
  }, []);

  const handleConfirmSelection = useCallback(
    (entries: RecentMediaEntry[]) => {
      if (entries.length === 0) return;
      if (publishMode) {
        // Publish flow: open the first selected recent in preview.
        setSelectMode(false);
        setSelectedIds(new Set());
        void handleSelectRecent(entries[0]!);
        return;
      }
      for (const entry of entries) onSelectRecent?.(entry);
      if (embedded) onRequestPostCompose?.();
      else onClose();
    },
    [
      publishMode,
      handleSelectRecent,
      onSelectRecent,
      onClose,
      embedded,
      onRequestPostCompose,
    ],
  );

  const loadPickedFileIntoPreview = useCallback((file: File) => {
    const kind = mediaKindOfFile(file);
    if (kind !== 'image' && kind !== 'video') {
      setSaveStatus('Unsupported media type');
      return;
    }
    if (!allowVideo && kind === 'video') {
      setSaveStatus('Video is not available here');
      return;
    }
    const url = URL.createObjectURL(file);
    setCaption('');
    setVisibility('public');
    setShareConfirmOpen(false);
    setTextLayers([]);
    setTextDraft(null);
    setDiscardOpen(false);
    setSaveRemoteUrl(null);
    setSaveStorageKey(null);
    setSaveMediaId(null);
    setSaveUploading(false);
    setSaveStatus(null);
    setPreview((prev) => {
      if (prev?.url.startsWith('blob:')) URL.revokeObjectURL(prev.url);
      return { file, url, kind };
    });
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }, [allowVideo]);

  const handleDeleteSelection = useCallback(
    async (entries: RecentMediaEntry[]) => {
      if (entries.length === 0) return;
      await deleteRecents(entries.map((e) => e.id));
      setSelectedIds(new Set());
      setSelectMode(false);
      haptic.toggle();
    },
    [deleteRecents],
  );

  if (!open || !mounted || typeof document === 'undefined') return null;

  const frameClass = embedded
    ? 'relative h-full w-full bg-black text-white'
    : `fixed inset-0 ${Z_LAYER_CLASS.CRITICAL_DIALOG} bg-black text-white`;

  const tree = (
    <div
      role={embedded ? 'region' : 'dialog'}
      aria-modal={embedded ? undefined : true}
      aria-label={embedded ? 'Camera' : 'Create story'}
      className={frameClass}
    >
      <div
        ref={scrollRef}
        className={`h-full overscroll-y-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${
          previewing
            ? 'overflow-hidden'
            : 'overflow-y-auto snap-y snap-mandatory'
        }`}
        onScroll={(e) => {
          if (previewing) return;
          setScrollTop(e.currentTarget.scrollTop);
        }}
      >
        {/* STATE 1 — camera / preview + bottom rail. */}
        <section
          className="box-border flex h-full w-full shrink-0 snap-start snap-always flex-col"
          style={{
            minHeight: '100%',
            paddingTop: safePadTop('0.5rem'),
            paddingBottom: safePadBottom('0.85rem'),
          }}
        >
          <div
            className="relative mx-auto min-h-0 w-full flex-1"
            style={{
              paddingLeft: EXPANDED_INSET_X,
              paddingRight: EXPANDED_INSET_X,
              paddingBottom: 16,
            }}
          >
            <CameraCard
              allowVideo={allowVideo}
              active={cameraActive && open}
              onClose={onClose}
              onCaptured={handleCaptured}
              preview={preview}
              onDiscardRequest={() => setDiscardOpen(true)}
              textLayers={textLayers}
              editingLayerId={textDraft?.id ?? null}
              onOpenTextTool={openTextTool}
              onTextLayerChange={(layer) => {
                setTextLayers((prev) =>
                  prev.map((l) => (l.id === layer.id ? layer : l)),
                );
              }}
              onTextLayerEdit={(layer) => setTextDraft({ ...layer })}
              saveRemoteUrl={saveRemoteUrl}
              saveUploading={saveUploading}
              onSaveToDevice={() => {
                void handleSaveToDevice();
              }}
              caption={caption}
              onCaptionChange={setCaption}
              captionMaxLength={captionMaxLength}
              visibility={visibility}
              onVisibilityChange={setVisibility}
            />
            {saveStatus ? (
              <p className="pointer-events-none absolute inset-x-4 bottom-3 z-40 rounded-full bg-black/70 px-3 py-2 text-center text-[12px] font-medium text-white backdrop-blur-md">
                {saveStatus}
              </p>
            ) : null}
          </div>

          <div className="relative z-10 shrink-0 bg-black">
            {previewing ? (
              <PreviewShareRail
                locationLabel={postLocation.address}
                sendDisabled={sending || saveUploading}
                onAddLocation={openLocationEditor}
                onSend={requestSend}
                sendLabel={sendLabel}
              />
            ) : (
              <ModeSelector
                value={mode}
                onChange={(next) => {
                  if (next === 'post') {
                    onRequestPostCompose?.();
                    return;
                  }
                  setMode('story');
                  onRequestStoryMode?.();
                }}
                recentThumbUrl={mostRecentThumbnailUrl}
                recentThumbKind={mostRecent?.kind ?? 'image'}
                onOpenRecents={openRecents}
              />
            )}
          </div>
        </section>

        {/* STATE 2 — hidden while reviewing a capture. */}
        {!previewing ? (
          <section
            ref={librarySectionRef}
            className="relative z-10 snap-start bg-black transition-opacity duration-200"
            style={{
              paddingBottom: safePadBottom('1rem'),
              opacity: libraryVisible ? 1 : 0,
              minHeight: viewport.h * 0.9,
            }}
            aria-hidden={!libraryVisible}
          >
            <div ref={locationPanelRef} className="pt-2" />

            <RecentsGrid
              cellSize={cellSize}
              gap={GRID_GAP}
              padX={GRID_PAD_X}
              selectMode={selectMode}
              selectedIds={selectedIds}
              location={postLocation}
              onLocationChange={updatePostLocation}
              onToggleSelectMode={() => {
                setSelectMode((v) => {
                  if (v) setSelectedIds(new Set());
                  return !v;
                });
              }}
              onToggleSelected={(id) => {
                setSelectedIds((prev) => {
                  const next = new Set(prev);
                  if (next.has(id)) next.delete(id);
                  else next.add(id);
                  return next;
                });
              }}
              onSelectRecent={handleSelectRecent}
              onBrowseLibrary={() => libraryInputRef.current?.click()}
              onConfirmSelection={handleConfirmSelection}
              onDeleteSelection={(entries) => {
                void handleDeleteSelection(entries);
              }}
              onOpenCamera={expandToCamera}
            />
          </section>
        ) : null}
      </div>

      <PostLocationOverlay
        open={locationOverlayOpen && previewing}
        value={postLocation}
        onChange={updatePostLocation}
        onClose={() => setLocationOverlayOpen(false)}
      />

      <MediaPicker
        inputRef={libraryInputRef}
        multiple={!publishMode}
        onFiles={(files) => {
          if (!files?.length) return;
          if (publishMode) {
            loadPickedFileIntoPreview(files[0]!);
            return;
          }
          onPickFiles?.(files);
          if (embedded) onRequestPostCompose?.();
          else onClose();
        }}
      />

      <DiscardMediaModal
        open={discardOpen && !textDraft && !shareConfirmOpen}
        videoTextNotSaved={
          preview?.kind === 'video' &&
          textLayers.some((l) => l.content.trim().length > 0)
        }
        onKeepEditing={() => setDiscardOpen(false)}
        onDiscard={() => {
          clearPreview();
        }}
        onSaveDraft={() => {
          void saveDraftToRecents();
        }}
      />

      <ShareConfirmModal
        open={shareConfirmOpen && previewing}
        visibility={visibility}
        locationLabel={postLocation.address}
        submitting={sending}
        onCancel={() => setShareConfirmOpen(false)}
        onConfirm={() => {
          void publishPost();
        }}
      />

      <TextInputModal
        open={textDraft != null}
        initial={textDraft}
        onCancel={() => setTextDraft(null)}
        onCommit={commitTextLayer}
      />
    </div>
  );

  if (embedded) return tree;
  return createPortal(tree, document.body);
}
