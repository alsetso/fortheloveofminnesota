'use client';

/**
 * Inline half-dock post composer.
 *
 * Opens when the user taps "Post" on a selected map point. Keeps the composer
 * embedded in the dock (half snap) rather than launching the full-screen
 * CreatePostSheet — lower friction, map stays visible.
 *
 * Camera opens the full MediaCapture component (full-screen portal):
 *   - Tap photo / hold video with CameraCard (flash, flip)
 *   - Recents thumbnail chip bottom-left → scroll up to reveal RecentsGrid
 *   - Browse Library via native PHPicker
 *   - "Add to Post" button returns with media + caption + visibility
 *
 * Header slot (MapDockPill right side):
 *   The Post button and visibility toggle live in the dock pill header via
 *   `composeHeaderStore` — they're hidden/replaced when this pane unmounts.
 *
 * Pin lifecycle:
 *   open          → blue  (post-composing)
 *   cancel        → red   (default)
 *   post submit   → blue  (posted — permanent for this session)
 */

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { DockPaneShell } from '@/features/map/dockCore/panes/DockPaneShell';
import { useMapDock } from '@/features/map/dockCore/shell/MapDockContext';
import { IconCamera, IconX } from '@/features/map/dockCore/core/icons';
import { MAP_DOCK_GLASS_CHIP_CLASS } from '@/features/map/dockCore/core/mapDockTokens';
import {
  resetSelectedPinMode,
  setSelectedPinMode,
} from '@/map/points/selectedPinModeStore';
import {
  clearComposeHeader,
  registerComposeActions,
  updateComposeHeader,
  type ComposeVisibility,
} from '@/features/map/dockCore/store/composeHeaderStore';
import MediaCapture, {
  type MediaCaptureResult,
  type PostLocationValue,
} from '@/components/media/capture';
import { DOCK_POST_CAPTION_MAX } from '@/features/community/postCaptionLimits';
import { resolveMentionTypeId } from '@/features/community/contributionTypes';
import { useAuthSafe } from '@/features/auth';
import { haptic } from '@/lib/despia/haptics';
import { recentThumbnailUrl, type RecentMediaEntry } from '@/lib/despia/media';

// ─── Media thumbnail ──────────────────────────────────────────────────────────

function MediaThumb({
  url,
  onRemove,
}: {
  url: string;
  onRemove: () => void;
}) {
  return (
    <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt="" className="h-full w-full object-cover" />
      <button
        type="button"
        onClick={onRemove}
        aria-label="Remove photo"
        className="absolute right-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white"
      >
        <IconX className="h-3 w-3" />
      </button>
    </div>
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────

type AttachedMedia = {
  previewUrl: string;
  file?: File;
  remoteUrl?: string;
  storageKey?: string;
};

// ─── Pane ─────────────────────────────────────────────────────────────────────

export default function DockPostComposePane({
  lat,
  lng,
  address,
}: {
  lat: number;
  lng: number;
  address: string | null;
}) {
  const { popPane, openSelectedPoint } = useMapDock();
  const { account } = useAuthSafe();

  const [content, setContent] = useState('');
  const [media, setMedia] = useState<AttachedMedia | null>(null);
  const [visibility, setVisibility] = useState<ComposeVisibility>('public');
  const [cameraOpen, setCameraOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mentionTypeId = resolveMentionTypeId(null, 'note');

  // Keep a ref so the registered callbacks always close over the latest state.
  const submitRef = useRef<() => void>(() => undefined);
  const toggleVisRef = useRef<() => void>(() => undefined);

  const initialLocation: PostLocationValue = { lat, lng, address };

  // ── Pin state ─────────────────────────────────────────────────────────────

  useEffect(() => {
    setSelectedPinMode('post-composing');
    updateComposeHeader({ active: true });
    return () => {
      clearComposeHeader();
    };
  }, []);

  // ── Blob revocation ───────────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      if (media?.previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(media.previewUrl);
      }
    };
  }, [media]);

  // ── Derived ───────────────────────────────────────────────────────────────

  const canSubmit =
    (content.trim().length > 0 || media !== null) &&
    !submitting;

  // ── Submit (stable ref so header callbacks never go stale) ────────────────

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    haptic.findMe.success();

    try {
      let images: { url: string; type: string; key?: string }[] | undefined;

      if (media) {
        let remoteUrl = media.remoteUrl;
        let storageKey = media.storageKey;

        if ((!remoteUrl || !storageKey) && media.file && account?.id) {
          const { uploadAndCommitToRecents } = await import('@/lib/despia/media');
          const result = await uploadAndCommitToRecents({
            file: media.file,
            authUserId: account.id,
          });
          remoteUrl = result.remoteUrl;
          storageKey = result.storageKey;
          setMedia((prev) =>
            prev
              ? {
                  ...prev,
                  remoteUrl: result.remoteUrl,
                  storageKey: result.storageKey,
                  file: undefined,
                }
              : prev,
          );
        }

        // Never create a "photo post" without a public URL — that shows on
        // profile/feed with no image and orphans the R2 upload in media_drafts.
        if (!remoteUrl) {
          throw new Error('Photo is still uploading — try again in a moment');
        }
        images = [{ url: remoteUrl, type: 'image', key: storageKey }];
      }

      if (!content.trim() && (!images || images.length === 0)) {
        throw new Error('Add a caption or photo to post');
      }

      const res = await fetch('/api/community/posts', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: content.trim().slice(0, DOCK_POST_CAPTION_MAX),
          mention_type_id: mentionTypeId,
          visibility,
          content_shape: 'standard',
          source: 'map_dock',
          map_data: { lat, lng, address: address ?? undefined },
          images,
        }),
      });

      const json = (await res.json()) as { id?: string; error?: string };
      if (!res.ok) throw new Error(json.error ?? 'Could not create post');

      setSelectedPinMode('posted');
      const { refreshCommunityPins } = await import('@/features/map/community');
      void refreshCommunityPins();
      popPane();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create post');
    } finally {
      setSubmitting(false);
    }
  }, [canSubmit, content, lat, lng, address, media, mentionTypeId, account?.id, popPane, visibility]);

  // Keep refs current so store callbacks always call the latest version.
  useEffect(() => {
    submitRef.current = () => { void handleSubmit(); };
  }, [handleSubmit]);

  const handleToggleVisibility = useCallback(() => {
    setVisibility((v) => (v === 'public' ? 'only_me' : 'public'));
    haptic.toggle();
  }, []);

  useEffect(() => {
    toggleVisRef.current = handleToggleVisibility;
  }, [handleToggleVisibility]);

  // Register stable callbacks once on mount.
  useEffect(() => {
    registerComposeActions(
      () => submitRef.current(),
      () => toggleVisRef.current(),
    );
  }, []);

  // Push live state into the store whenever it changes.
  useEffect(() => {
    updateComposeHeader({ canPost: canSubmit, posting: submitting, visibility });
  }, [canSubmit, submitting, visibility]);

  // ── Camera / library callbacks ────────────────────────────────────────────

  const handleCapture = useCallback((_file: File, result?: MediaCaptureResult) => {
    const previewUrl = _file.size > 0 ? URL.createObjectURL(_file) : (result?.remoteUrl ?? '');
    setMedia((prev) => {
      if (prev?.previewUrl.startsWith('blob:')) URL.revokeObjectURL(prev.previewUrl);
      return {
        previewUrl,
        file: result?.remoteUrl ? undefined : _file,
        remoteUrl: result?.remoteUrl,
        storageKey: result?.storageKey,
      };
    });
    const cameraCaption = result?.caption?.trim() ?? '';
    if (cameraCaption) {
      setContent((prev) => prev.trim() ? prev : cameraCaption);
    }
    if (result?.visibility) {
      setVisibility(result.visibility);
    }
    setCameraOpen(false);
  }, []);

  const handlePickFiles = useCallback((files: FileList | null) => {
    if (!files?.length) { setCameraOpen(false); return; }
    const file = files[0]!;
    const previewUrl = URL.createObjectURL(file);
    setMedia((prev) => {
      if (prev?.previewUrl.startsWith('blob:')) URL.revokeObjectURL(prev.previewUrl);
      return { previewUrl, file };
    });
    setCameraOpen(false);
  }, []);

  const handleSelectRecent = useCallback((entry: RecentMediaEntry) => {
    const previewUrl = recentThumbnailUrl(entry) ?? entry.remoteUrl;
    setMedia((prev) => {
      if (prev?.previewUrl.startsWith('blob:')) URL.revokeObjectURL(prev.previewUrl);
      return {
        previewUrl,
        remoteUrl: entry.remoteUrl,
        storageKey: entry.storageKey ?? undefined,
      };
    });
    setCameraOpen(false);
  }, []);

  const handleRemoveMedia = useCallback(() => {
    setMedia((prev) => {
      if (prev?.previewUrl.startsWith('blob:')) URL.revokeObjectURL(prev.previewUrl);
      return null;
    });
  }, []);

  // Cancel — reset pin, go back to selected-point pane.
  const handleCancel = useCallback(() => {
    resetSelectedPinMode();
    openSelectedPoint();
  }, [openSelectedPoint]);
  void handleCancel; // consumed by MapDockContext back handler

  const charCount = content.length;
  const nearLimit = charCount > DOCK_POST_CAPTION_MAX * 0.85;

  return (
    <>
      <DockPaneShell>
        <div className="flex flex-col gap-3 pb-2">

          {/* Inline textarea — no card background */}
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="What's happening here?"
            maxLength={DOCK_POST_CAPTION_MAX}
            rows={3}
            disabled={submitting}
            className="w-full resize-none border-0 bg-transparent text-[17px] leading-snug text-foreground placeholder:text-foreground/30 outline-none disabled:opacity-50"
          />

          {/* Media preview strip */}
          {media && (
            <div className="flex gap-2">
              <MediaThumb url={media.previewUrl} onRemove={handleRemoveMedia} />
            </div>
          )}

          {error && (
            <p
              role="alert"
              className="rounded-xl bg-red-500/10 px-3 py-2 text-center text-[12px] font-medium text-red-600"
            >
              {error}
            </p>
          )}

          {/* Bottom bar: camera · address · char count */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={submitting || Boolean(media)}
              onClick={() => setCameraOpen(true)}
              aria-label="Add photo"
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${MAP_DOCK_GLASS_CHIP_CLASS} text-lake-blue transition active:scale-90 disabled:opacity-35`}
            >
              <IconCamera className="h-5 w-5" />
            </button>

            <div className="flex min-w-0 flex-1 flex-col justify-center">
              <span className="truncate text-[12px] font-medium text-foreground/45">
                {address ?? 'Selected location'}
              </span>
              {nearLimit && (
                <span className="text-[11px] font-semibold tabular-nums text-red-500">
                  {DOCK_POST_CAPTION_MAX - charCount} left
                </span>
              )}
            </div>
          </div>

        </div>
      </DockPaneShell>

      <MediaCapture
        open={cameraOpen}
        onClose={() => setCameraOpen(false)}
        onCapture={handleCapture}
        onPickFiles={handlePickFiles}
        onSelectRecent={handleSelectRecent}
        allowVideo={false}
        initialLocation={initialLocation}
        initialCaption={content}
        captionMaxLength={DOCK_POST_CAPTION_MAX}
        sendLabel="Add to Post"
      />
    </>
  );
}
