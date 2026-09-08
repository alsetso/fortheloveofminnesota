'use client';

/**
 * Unified Create modal — one scroll surface:
 *   viewport 1: white Post compose
 *   viewport 2: camera (Story publish / Post media attach)
 *
 * Map camera rail opens snapped to camera as Story.
 * Post compose Media control scrolls the camera into view.
 */

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import MediaCapture, {
  type MediaCaptureResult,
  type PostLocationValue,
} from '@/components/media/capture';
import { resolvePostLocationSeed } from '@/components/media/capture/PostLocationPanel';
import type { TextLayerData } from '@/components/media/capture/TextOverlay/types';
import VideoTextOverlays from '@/components/media/capture/TextOverlay/VideoTextOverlays';
import MediaPicker from '@/components/media/picker/MediaPicker';
import { useAuthSafe } from '@/features/auth';
import { ComposePlaceSheet } from '@/features/community/compose/ComposePlaceSheet';
import { ComposeWriteStep } from '@/features/community/compose/ComposeWriteStep';
import {
  seedComposePlace,
  type ComposePlaceValue,
} from '@/features/community/compose/composePlace';
import {
  COMPOSE_CATEGORIES,
  composeCategoryBySlug,
  resolveMentionTypeId,
  type ComposeKindId,
  type ContributionCategory,
} from '@/features/community/contributionTypes';
import { buildKindMeta, type MarketplaceIntent } from '@/lib/community/composeKindMeta';
import { PinMediaLightbox } from '@/features/community/PinMediaLightbox';
import { POST_CAPTION_MAX } from '@/features/community/postCaptionLimits';
import type { PinPostMedia } from '@/features/community/pinPostApi';
import { fetchPinPostDetail } from '@/features/community/pinPostApi';
import type { CreatePostSheetState } from '@/features/map/dockCore/shell/MapDockContext';
import { IconArrowLeft, IconChevronDown, IconPhoto, IconSpinner, IconX } from '@/features/map/dockCore/core/icons';
import {
  assertImageFile,
  assertVideoFile,
  COMMUNITY_POST_MAX_PHOTOS,
  COMMUNITY_POST_MAX_VIDEOS,
  COMMUNITY_POST_VIDEO_MAX_SECONDS,
  mediaKindOfFile,
  readVideoDurationSeconds,
  type ComposeMedia,
} from '@/lib/community/composeMediaLimits';
import {
  POST_VISIBILITY,
  POST_VISIBILITY_OPTIONS,
  normalizeEditableVisibility,
  type EditablePostVisibility,
} from '@/lib/community/postVisibility';
import {
  recentThumbnailUrl,
  uploadAndCommitToRecents,
  type RecentMediaEntry,
} from '@/lib/despia/media';
import { haptic } from '@/lib/despia/haptics';
import { safePadBottom, safePadTop } from '@/lib/despia/safeArea';
import { fetchTerritoryAtPoint } from '@/lib/territory/fetchTerritoryAtPoint';
import { Z_LAYER_CLASS } from '@/lib/map/zLayers';

export type CreateComposerMode = 'post' | 'story';

type ComposeVisibility = EditablePostVisibility;

function newMediaId() {
  return `m-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export default function CreatePostSheet({
  state,
  onClose,
  onCreated,
  onSaved,
}: {
  state: CreatePostSheetState;
  onClose: () => void;
  /** Fires after a successful create, before `onClose`. */
  onCreated?: () => void;
  /** Fires after a successful edit, before `onClose`. */
  onSaved?: () => void;
}) {
  const { user } = useAuthSafe();
  const editPostId = state.editPostId?.trim() || null;
  const isEdit = Boolean(editPostId);
  const [cameraActive, setCameraActive] = useState(
    () => Boolean(state.openCamera) && !editPostId,
  );
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRef = useRef<ComposeMedia[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const composeRef = useRef<HTMLElement>(null);
  const cameraRef = useRef<HTMLElement>(null);
  const addInputId = useId();

  const seededCategory = composeCategoryBySlug(state.categorySlug);
  const defaultCategory =
    composeCategoryBySlug('note') ??
    (COMPOSE_CATEGORIES[0] as ContributionCategory & { id: ComposeKindId });
  const [mounted, setMounted] = useState(false);
  const [content, setContent] = useState('');
  const [media, setMedia] = useState<ComposeMedia[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editLoading, setEditLoading] = useState(isEdit);
  const [editLoadError, setEditLoadError] = useState<string | null>(null);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [mode, setMode] = useState<CreateComposerMode>(() =>
    state.openCamera ? 'story' : 'post',
  );
  const [category, setCategory] = useState<
    ContributionCategory & { id: ComposeKindId }
  >(() => seededCategory ?? defaultCategory);
  const [eventTitle, setEventTitle] = useState('');
  const [eventStartsAt, setEventStartsAt] = useState(defaultLocalStart);
  const [eventEndsAt, setEventEndsAt] = useState('');
  const [marketplaceIntent, setMarketplaceIntent] =
    useState<MarketplaceIntent>('selling');
  const [marketplacePrice, setMarketplacePrice] = useState('');
  const [promotionEndsAt, setPromotionEndsAt] = useState('');
  const [placeOpen, setPlaceOpen] = useState(false);
  const [visibility, setVisibility] = useState<ComposeVisibility>(
    POST_VISIBILITY.public,
  );
  const [visibilityOpen, setVisibilityOpen] = useState(false);
  const [kindMenuOpen, setKindMenuOpen] = useState(false);
  const [pendingKind, setPendingKind] = useState<
    (ContributionCategory & { id: ComposeKindId }) | null
  >(null);
  const [place, setPlace] = useState<ComposePlaceValue>(() =>
    seedComposePlace(
      resolvePostLocationSeed({
        lat: state.lat,
        lng: state.lng,
        address: state.address,
      }),
    ),
  );
  const mentionTypeId = resolveMentionTypeId(
    category.id,
    mode === 'story' ? 'story' : 'note',
  );
  const postLocation: PostLocationValue = place;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const ac = new AbortController();
    void fetchTerritoryAtPoint(place.lat, place.lng, ac.signal)
      .then((at) => {
        if (ac.signal.aborted || !at) return;
        const ctu = at.jurisdictions.find((row) => row.kind === 'ctu');
        if (!ctu) return;
        setPlace((prev) => ({
          ...prev,
          unitId: ctu.id,
          cityName: ctu.name,
          address:
            prev.precision === 'city'
              ? ctu.name
              : prev.address?.trim() || ctu.name,
        }));
      })
      .catch(() => {
        /* keep seeded place */
      });
    return () => ac.abort();
    // Resolve city once from the entry seed — later edits go through the place sheet.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    mediaRef.current = media;
  }, [media]);

  useEffect(() => {
    if (!editPostId) return;
    const ac = new AbortController();
    setEditLoading(true);
    setEditLoadError(null);
    void fetchPinPostDetail(editPostId, ac.signal)
      .then((post) => {
        if (ac.signal.aborted) return;
        const isStory = post.content_shape === 'story';
        setMode(isStory ? 'story' : 'post');
        setContent(post.body ?? '');
        setVisibility(normalizeEditableVisibility(post.visibility));
        if (
          typeof post.lat === 'number' &&
          typeof post.lng === 'number' &&
          Number.isFinite(post.lat) &&
          Number.isFinite(post.lng)
        ) {
          setPlace({
            lat: post.lat,
            lng: post.lng,
            address: post.full_address ?? post.place_label ?? null,
            unitId: post.unit_id ?? null,
            cityName: post.city_name ?? null,
            precision: post.full_address?.trim() ? 'exact' : 'city',
          });
        }
        const slug = post.mention_type?.name?.trim().toLowerCase();
        const cat = composeCategoryBySlug(slug);
        if (cat && !isStory) setCategory(cat);
        setMedia(
          post.media.map((m) => ({
            id: m.id,
            kind: m.type === 'video' ? 'video' : 'image',
            previewUrl: m.url,
            remoteUrl: m.url,
            storageKey: null,
            fileName: m.url.split('/').pop()?.split('?')[0] ?? 'media',
            uploading: false,
            textLayers: m.textLayers ?? undefined,
          })),
        );
        setEditLoading(false);
      })
      .catch((e: unknown) => {
        if (ac.signal.aborted) return;
        setEditLoadError(
          e instanceof Error ? e.message : 'Could not load post for editing',
        );
        setEditLoading(false);
      });
    return () => ac.abort();
  }, [editPostId]);

  const scrollToCompose = useCallback(() => {
    setCameraActive(false);
    composeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const scrollToCamera = useCallback(() => {
    setCameraActive(true);
    cameraRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  useEffect(() => {
    const root = scrollRef.current;
    const cameraEl = cameraRef.current;
    if (!root || !cameraEl) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.target !== cameraEl) continue;
          if (entry.isIntersecting && entry.intersectionRatio >= 0.55) {
            setCameraActive(true);
          } else if (!entry.isIntersecting || entry.intersectionRatio < 0.2) {
            setCameraActive(false);
          }
        }
      },
      { root, threshold: [0, 0.2, 0.55, 1] },
    );

    observer.observe(cameraEl);
    return () => observer.disconnect();
  }, []);

  // Entry: Story → camera; Post → white compose.
  useLayoutEffect(() => {
    const id = window.requestAnimationFrame(() => {
      if (mode === 'story' && !isEdit) {
        setCameraActive(true);
        cameraRef.current?.scrollIntoView({ behavior: 'auto', block: 'start' });
      } else {
        setCameraActive(false);
        composeRef.current?.scrollIntoView({ behavior: 'auto', block: 'start' });
      }
    });
    return () => window.cancelAnimationFrame(id);
    // Only on open / initial mode.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return () => {
      for (const p of mediaRef.current) {
        if (p.previewUrl.startsWith('blob:')) URL.revokeObjectURL(p.previewUrl);
      }
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (previewIndex != null) {
        setPreviewIndex(null);
        return;
      }
      onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, previewIndex]);

  const removeMedia = useCallback((id: string) => {
    setMedia((prev) => {
      const idx = prev.findIndex((p) => p.id === id);
      const target = idx >= 0 ? prev[idx] : undefined;
      if (target?.previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(target.previewUrl);
      }
      const next = prev.filter((p) => p.id !== id);
      setPreviewIndex((open) => {
        if (open == null || idx < 0) return open;
        if (next.length === 0) return null;
        if (open > idx) return open - 1;
        if (open >= next.length) return next.length - 1;
        return open;
      });
      return next;
    });
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  const roomFor = useCallback((kind: 'image' | 'video') => {
    if (kind === 'image') {
      return (
        COMMUNITY_POST_MAX_PHOTOS -
        mediaRef.current.filter((m) => m.kind === 'image').length
      );
    }
    return (
      COMMUNITY_POST_MAX_VIDEOS -
      mediaRef.current.filter((m) => m.kind === 'video').length
    );
  }, []);

  const addRecentEntry = useCallback(
    (entry: RecentMediaEntry) => {
      if (roomFor(entry.kind) <= 0) {
        setError(
          entry.kind === 'video'
            ? 'Only one video can be attached'
            : `Up to ${COMMUNITY_POST_MAX_PHOTOS} photos`,
        );
        return;
      }
      if (
        mediaRef.current.some(
          (m) => m.id === entry.id || m.remoteUrl === entry.remoteUrl,
        )
      ) {
        return;
      }
      const preview = recentThumbnailUrl(entry) ?? entry.remoteUrl;
      setError(null);
      setMedia((prev) => [
        ...prev,
        {
          id: entry.id,
          kind: entry.kind,
          previewUrl: preview,
          remoteUrl: entry.remoteUrl,
          storageKey: entry.storageKey ?? null,
          fileName: entry.filename.split('/').pop() ?? entry.filename,
          uploading: false,
        },
      ]);
      scrollToCompose();
    },
    [roomFor, scrollToCompose],
  );

  const addMediaFiles = useCallback(
    async (
      fileList: File[] | FileList | null,
      captureResult?: MediaCaptureResult,
    ) => {
      if (!fileList?.length) return;
      if (!user?.id) {
        setError('Sign in to add media');
        return;
      }

      let photoRoom = roomFor('image');
      let videoRoom = roomFor('video');
      const captureLayers =
        Array.isArray(fileList) && fileList.length === 1
          ? captureResult?.textLayers
          : undefined;

      const captureRemoteUrl = captureResult?.remoteUrl?.trim() || null;
      const captureStorageKey = captureResult?.storageKey?.trim() || null;
      const captureMediaId = captureResult?.mediaId?.trim() || null;
      if (
        captureResult?.visibility === POST_VISIBILITY.public ||
        captureResult?.visibility === POST_VISIBILITY.onlyMe
      ) {
        setVisibility(captureResult.visibility);
      }

      const accepted: {
        id: string;
        file: File;
        previewUrl: string;
        kind: 'image' | 'video';
        textLayers?: TextLayerData[];
        remoteUrl?: string | null;
        storageKey?: string | null;
      }[] = [];
      let lastErr: string | null = null;

      for (const file of Array.from(fileList)) {
        const kind = mediaKindOfFile(file);
        if (!kind) {
          lastErr = 'Only photos and one short video are allowed.';
          continue;
        }
        if (kind === 'image') {
          if (photoRoom <= 0) {
            lastErr = `Up to ${COMMUNITY_POST_MAX_PHOTOS} photos`;
            continue;
          }
          const bad = assertImageFile(file);
          if (bad) {
            lastErr = bad;
            continue;
          }
          const id = captureMediaId || newMediaId();
          const previewUrl = captureRemoteUrl || URL.createObjectURL(file);
          accepted.push({
            id,
            file,
            previewUrl,
            kind,
            remoteUrl: captureRemoteUrl,
            storageKey: captureStorageKey,
          });
          photoRoom -= 1;
          continue;
        }

        if (videoRoom <= 0) {
          lastErr = 'Only one video can be attached';
          continue;
        }
        const bad = assertVideoFile(file);
        if (bad) {
          lastErr = bad;
          continue;
        }
        if (!captureRemoteUrl) {
          try {
            const seconds = await readVideoDurationSeconds(file);
            if (seconds > COMMUNITY_POST_VIDEO_MAX_SECONDS + 0.35) {
              lastErr = `Videos must be ${COMMUNITY_POST_VIDEO_MAX_SECONDS}s or shorter`;
              continue;
            }
          } catch {
            lastErr = 'Could not read video';
            continue;
          }
        }
        const id = captureMediaId || newMediaId();
        const previewUrl = captureRemoteUrl || URL.createObjectURL(file);
        accepted.push({
          id,
          file,
          previewUrl,
          kind,
          textLayers:
            kind === 'video' && captureLayers?.length
              ? captureLayers
              : undefined,
          remoteUrl: captureRemoteUrl,
          storageKey: captureStorageKey,
        });
        videoRoom -= 1;
      }

      if (accepted.length === 0) {
        setError(lastErr ?? 'Could not add media');
        return;
      }
      setError(lastErr);
      setMedia((prev) => [
        ...prev,
        ...accepted.map(
          ({
            id,
            file,
            previewUrl,
            kind,
            textLayers,
            remoteUrl,
            storageKey,
          }): ComposeMedia => ({
            id,
            kind,
            previewUrl,
            remoteUrl: remoteUrl ?? null,
            storageKey: storageKey ?? null,
            fileName: file.name,
            uploading: !remoteUrl,
            uploadProgress: remoteUrl ? undefined : 0,
            textLayers,
          }),
        ),
      ]);
      scrollToCompose();

      const incomingCaption = captureResult?.caption?.trim();
      if (incomingCaption) {
        setContent((prev) =>
          prev.trim() ? prev : incomingCaption.slice(0, POST_CAPTION_MAX),
        );
      }

      await Promise.all(
        accepted.map(async ({ id, file, previewUrl, remoteUrl, storageKey }) => {
          if (remoteUrl) {
            if (previewUrl.startsWith('blob:')) URL.revokeObjectURL(previewUrl);
            setMedia((prev) =>
              prev.map((p) =>
                p.id === id
                  ? {
                      ...p,
                      remoteUrl,
                      storageKey: storageKey ?? p.storageKey,
                      uploading: false,
                      uploadProgress: undefined,
                      previewUrl: remoteUrl,
                    }
                  : p,
              ),
            );
            return;
          }
          try {
            const result = await uploadAndCommitToRecents({
              file,
              authUserId: user.id,
              id,
              onProgress: (ratio: number) => {
                setMedia((prev) =>
                  prev.map((p) =>
                    p.id === id
                      ? { ...p, uploadProgress: ratio, uploading: true }
                      : p,
                  ),
                );
              },
            });
            setMedia((prev) =>
              prev.map((p) =>
                p.id === id
                  ? {
                      ...p,
                      remoteUrl: result.remoteUrl,
                      storageKey: result.storageKey,
                      uploading: false,
                      uploadProgress: undefined,
                      previewUrl: result.remoteUrl || p.previewUrl,
                    }
                  : p,
              ),
            );
            if (previewUrl.startsWith('blob:')) {
              URL.revokeObjectURL(previewUrl);
            }
          } catch (e) {
            if (previewUrl.startsWith('blob:')) URL.revokeObjectURL(previewUrl);
            setMedia((prev) => prev.filter((p) => p.id !== id));
            setError(e instanceof Error ? e.message : 'Could not upload media');
          }
        }),
      );
    },
    [roomFor, user?.id, scrollToCompose],
  );

  const hasInput = content.trim().length > 0;
  const hasContent = hasInput || media.length > 0;
  const mediaReady =
    media.length === 0 ||
    media.every((p) => Boolean(p.remoteUrl) && !p.uploading);
  const photoCount = media.filter((m) => m.kind === 'image').length;
  const videoCount = media.filter((m) => m.kind === 'video').length;
  const canAddPhoto = photoCount < COMMUNITY_POST_MAX_PHOTOS;
  const canAddVideo = videoCount < COMMUNITY_POST_MAX_VIDEOS;
  const showAdd = canAddPhoto || canAddVideo;

  const canSubmit =
    hasContent &&
    mediaReady &&
    !submitting &&
    !editLoading &&
    Number.isFinite(place.lat) &&
    Number.isFinite(place.lng) &&
    (mode === 'story' ||
      ((category.id !== 'event' || Boolean(eventStartsAt)) &&
        (category.id !== 'marketplace' || Boolean(marketplaceIntent))));

  const headerTitle = isEdit
    ? mode === 'story'
      ? 'Edit Story'
      : 'Edit Post'
    : mode === 'story'
      ? 'Create Story'
      : category.label;

  const canSwitchKind = mode === 'post' && !editLoading;

  const kindDetailsDirty = (kind: ComposeKindId | undefined): boolean => {
    if (!kind || kind === 'note') return false;
    if (kind === 'event') {
      return Boolean(eventTitle.trim() || eventEndsAt);
    }
    if (kind === 'marketplace') {
      return Boolean(
        marketplacePrice.trim() || marketplaceIntent !== 'selling',
      );
    }
    if (kind === 'promotion') {
      return Boolean(promotionEndsAt);
    }
    return false;
  };

  const resetKindFields = useCallback(() => {
    setEventTitle('');
    setEventStartsAt(defaultLocalStart());
    setEventEndsAt('');
    setMarketplaceIntent('selling');
    setMarketplacePrice('');
    setPromotionEndsAt('');
  }, []);

  const applyKindSwitch = useCallback(
    (next: ContributionCategory & { id: ComposeKindId }) => {
      setCategory(next);
      resetKindFields();
      setKindMenuOpen(false);
      setPendingKind(null);
      setVisibilityOpen(false);
      setError(null);
    },
    [resetKindFields],
  );

  const requestKindSwitch = (
    next: ContributionCategory & { id: ComposeKindId },
  ) => {
    if (next.id === category.id) {
      setKindMenuOpen(false);
      return;
    }
    setKindMenuOpen(false);
    if (kindDetailsDirty(category.id)) {
      setPendingKind(next);
      return;
    }
    applyKindSwitch(next);
  };

  const onHeaderBack = () => {
    haptic.toggle();
    setVisibilityOpen(false);
    setKindMenuOpen(false);
    setPendingKind(null);
    onClose();
  };

  const submit = useCallback(async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      if (mode === 'post' && category.id === 'event') {
        const start = new Date(eventStartsAt);
        if (!Number.isFinite(start.getTime())) {
          throw new Error('Add a start time.');
        }
        if (eventEndsAt) {
          const end = new Date(eventEndsAt);
          if (!Number.isFinite(end.getTime())) {
            throw new Error('End time looks off.');
          }
          if (end.getTime() <= start.getTime()) {
            throw new Error('End has to be after start.');
          }
        }
      }

      const images =
        media.length > 0
          ? media
              .filter((p) => p.remoteUrl)
              .map((p) => ({
                url: p.remoteUrl as string,
                type: p.kind,
                key: p.storageKey ?? undefined,
                text_layers:
                  p.kind === 'video' && p.textLayers?.length
                    ? p.textLayers
                    : undefined,
              }))
          : undefined;

      const kindMeta =
        mode === 'post'
          ? buildKindMeta(category.id, {
              eventTitle: eventTitle.trim() || null,
              eventStartsAt:
                category.id === 'event'
                  ? new Date(eventStartsAt).toISOString()
                  : null,
              eventEndsAt:
                category.id === 'event' && eventEndsAt
                  ? new Date(eventEndsAt).toISOString()
                  : null,
              marketplaceIntent:
                category.id === 'marketplace' ? marketplaceIntent : null,
              marketplacePrice:
                category.id === 'marketplace' && marketplaceIntent !== 'free'
                  ? marketplacePrice.trim() || null
                  : null,
              promotionEndsAt:
                category.id === 'promotion' && promotionEndsAt
                  ? new Date(promotionEndsAt).toISOString()
                  : null,
            })
          : {};

      const payload = {
        content: content.trim().slice(0, POST_CAPTION_MAX),
        mention_type_id: mentionTypeId,
        category_id: mentionTypeId,
        visibility,
        content_shape: mode === 'story' ? 'story' : 'standard',
        map_data: {
          lat: place.lat,
          lng: place.lng,
          address: place.address ?? place.cityName ?? undefined,
        },
        experience_zone_id: state.experienceZoneId ?? undefined,
        images,
        kind_meta: kindMeta,
        event_starts_at:
          category.id === 'event' ? new Date(eventStartsAt).toISOString() : null,
        event_ends_at:
          category.id === 'event' && eventEndsAt
            ? new Date(eventEndsAt).toISOString()
            : null,
      };

      const res = await fetch(
        isEdit && editPostId
          ? `/api/community/posts/${encodeURIComponent(editPostId)}`
          : '/api/community/posts',
        {
          method: isEdit ? 'PATCH' : 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
      );
      const json = (await res.json()) as { id?: string; error?: string };
      if (!res.ok) throw new Error(json.error ?? 'Could not save post');
      if (isEdit) {
        const { refreshCommunityPins } = await import('@/features/map/community');
        void refreshCommunityPins();
        onSaved?.();
      } else {
        onCreated?.();
      }
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save post');
    } finally {
      setSubmitting(false);
    }
  }, [
    canSubmit,
    category,
    content,
    editPostId,
    eventEndsAt,
    eventStartsAt,
    eventTitle,
    isEdit,
    marketplaceIntent,
    marketplacePrice,
    media,
    mentionTypeId,
    mode,
    onClose,
    onCreated,
    onSaved,
    place.address,
    place.cityName,
    place.lat,
    place.lng,
    promotionEndsAt,
    state.experienceZoneId,
    visibility,
  ]);

  const thumbClass =
    'relative h-[4.5rem] w-[4.5rem] shrink-0 overflow-hidden rounded-[10px] bg-[#F7F5F1]';

  const lightboxItems: PinPostMedia[] = media
    .filter((p) => p.kind === 'image')
    .map((p, i) => ({
      id: p.id,
      url: p.previewUrl,
      type: 'image',
      alt: null,
      sort_order: i,
    }));

  const openPreview = (item: ComposeMedia, index: number) => {
    if (item.kind === 'video') return;
    const imageIndex =
      media.slice(0, index + 1).filter((m) => m.kind === 'image').length - 1;
    if (imageIndex >= 0) setPreviewIndex(imageIndex);
  };

  const openCameraForPostMedia = () => {
    haptic.toggle();
    setMode('post');
    scrollToCamera();
  };

  if (!mounted || typeof document === 'undefined') return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={
        isEdit
          ? mode === 'story'
            ? 'Edit story'
            : 'Edit post'
          : mode === 'story'
            ? 'Create story'
            : 'Create post'
      }
      className={`fixed inset-0 ${Z_LAYER_CLASS.CRITICAL_DIALOG} bg-black`}
    >
      <div
        ref={scrollRef}
        className="h-full overflow-y-auto overscroll-y-contain snap-y snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {/* Viewport 1 — white Post compose */}
        <section
          ref={composeRef}
          className="box-border flex h-full w-full shrink-0 snap-start snap-always flex-col bg-[#F7F5F1] text-[#1C1C1E]"
          style={{
            paddingBottom: safePadBottom('1rem'),
          }}
        >
          <div
            className="relative flex shrink-0 items-center border-b border-black/[0.06] bg-white/80 px-1.5 pb-2 backdrop-blur-xl"
            style={{ paddingTop: safePadTop('0.5rem') }}
          >
            <button
              type="button"
              onClick={onHeaderBack}
              aria-label="Back"
              className="relative z-[1] inline-flex h-9 min-w-[2.75rem] shrink-0 items-center justify-center px-2 text-lake-blue transition active:opacity-50"
            >
              <IconArrowLeft className="h-5 w-5" />
            </button>
            {canSwitchKind ? (
              <div className="pointer-events-auto absolute inset-x-16 z-[2] flex justify-center">
                <div className="relative max-w-full">
                  <button
                    type="button"
                    aria-haspopup="listbox"
                    aria-expanded={kindMenuOpen}
                    aria-label={`Post type: ${category.label}. Change type`}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      haptic.toggle();
                      setVisibilityOpen(false);
                      setKindMenuOpen((open) => !open);
                    }}
                    className="inline-flex max-w-full items-center gap-0.5 truncate rounded-full px-2 py-1 text-[17px] font-semibold tracking-tight text-[#1C1C1E] transition active:opacity-60"
                  >
                    <span className="truncate">
                      {category.emoji} {category.label}
                    </span>
                    <IconChevronDown
                      className={`h-3.5 w-3.5 shrink-0 text-[#8E8E93] transition ${
                        kindMenuOpen ? 'rotate-180' : ''
                      }`}
                    />
                  </button>
                  {kindMenuOpen ? (
                    <>
                      <button
                        type="button"
                        aria-label="Close post type menu"
                        className="fixed inset-0 z-[3] cursor-default"
                        onClick={() => setKindMenuOpen(false)}
                      />
                      <div
                        role="listbox"
                        aria-label="Post type"
                        className="absolute left-1/2 top-[calc(100%+6px)] z-[4] w-[min(16rem,calc(100vw-2rem))] -translate-x-1/2 overflow-hidden rounded-[12px] bg-white py-1 shadow-[0_8px_28px_rgba(0,0,0,0.18)] ring-1 ring-black/[0.08]"
                      >
                        {COMPOSE_CATEGORIES.map((row) => {
                          const selected = category.id === row.id;
                          return (
                            <button
                              key={row.id}
                              type="button"
                              role="option"
                              aria-selected={selected}
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => {
                                haptic.toggle();
                                requestKindSwitch(
                                  row as ContributionCategory & {
                                    id: ComposeKindId;
                                  },
                                );
                              }}
                              className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left transition active:bg-black/[0.04]"
                            >
                              <span className="text-[18px] leading-none">
                                {row.emoji}
                              </span>
                              <span className="min-w-0 flex-1 truncate text-[15px] text-[#1C1C1E]">
                                {row.label}
                              </span>
                              {selected ? (
                                <span className="text-[15px] font-semibold text-lake-blue">
                                  ✓
                                </span>
                              ) : null}
                            </button>
                          );
                        })}
                      </div>
                    </>
                  ) : null}
                </div>
              </div>
            ) : (
              <h1 className="pointer-events-none absolute inset-x-16 truncate text-center text-[17px] font-semibold tracking-tight text-[#1C1C1E]">
                {headerTitle}
              </h1>
            )}
            <div className="relative z-[2] ml-auto flex shrink-0 items-center gap-0.5">
              <div className="relative">
                <button
                  type="button"
                  aria-haspopup="listbox"
                  aria-expanded={visibilityOpen}
                  aria-label={`Visibility: ${
                    POST_VISIBILITY_OPTIONS.find((o) => o.id === visibility)?.label ??
                    'Public'
                  }`}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    haptic.toggle();
                    setKindMenuOpen(false);
                    setVisibilityOpen((open) => !open);
                  }}
                  className="inline-flex h-9 max-w-[7.5rem] items-center gap-0.5 rounded-full px-2 text-[15px] font-medium text-lake-blue transition active:opacity-50"
                >
                  <span className="truncate">
                    {POST_VISIBILITY_OPTIONS.find((o) => o.id === visibility)?.label ??
                      'Public'}
                  </span>
                  <IconChevronDown
                    className={`h-3.5 w-3.5 shrink-0 transition ${
                      visibilityOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>
                {visibilityOpen ? (
                  <>
                    <button
                      type="button"
                      aria-label="Close visibility menu"
                      className="fixed inset-0 z-[3] cursor-default"
                      onClick={() => setVisibilityOpen(false)}
                    />
                    <div
                      role="listbox"
                      aria-label="Visibility"
                      className="absolute right-0 top-[calc(100%+4px)] z-[4] min-w-[10.5rem] overflow-hidden rounded-[12px] bg-white py-1 shadow-[0_8px_28px_rgba(0,0,0,0.18)] ring-1 ring-black/[0.08]"
                    >
                      {POST_VISIBILITY_OPTIONS.map((opt) => {
                        const selected = visibility === opt.id;
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            role="option"
                            aria-selected={selected}
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => {
                              haptic.toggle();
                              setVisibility(opt.id);
                              setVisibilityOpen(false);
                            }}
                            className="flex w-full items-center justify-between gap-3 px-3.5 py-2.5 text-left text-[15px] text-[#1C1C1E] transition active:bg-black/[0.04]"
                          >
                            <span>{opt.label}</span>
                            {selected ? (
                              <span className="text-[15px] font-semibold text-lake-blue">
                                ✓
                              </span>
                            ) : (
                              <span className="w-3" aria-hidden />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </>
                ) : null}
              </div>
              <button
                type="button"
                disabled={!canSubmit}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  setVisibilityOpen(false);
                  void submit();
                }}
                className="inline-flex h-9 min-w-[3.25rem] items-center justify-center gap-1 px-2.5 text-[17px] font-semibold text-lake-blue transition active:opacity-50 disabled:text-[#C7C7CC]"
              >
                {submitting ? (
                  <IconSpinner className="h-4 w-4 animate-spin text-lake-blue" />
                ) : null}
                {submitting ? null : isEdit ? 'Save' : 'Post'}
              </button>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto pb-4">
            {editLoading ? (
              <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-[#8E8E93]">
                <IconSpinner className="h-8 w-8 animate-spin text-lake-blue" />
                <p className="text-[15px]">Loading post…</p>
              </div>
            ) : editLoadError ? (
              <div className="px-6 py-16 text-center">
                <p className="text-[15px] text-red-600">{editLoadError}</p>
                <button
                  type="button"
                  onClick={onClose}
                  className="mt-4 rounded-full bg-black/[0.05] px-4 py-2 text-[14px] font-semibold"
                >
                  Close
                </button>
              </div>
            ) : null}

            {!editLoading && !editLoadError ? (
              <ComposeWriteStep
                category={category}
                content={content}
                onContentChange={setContent}
                contentMax={POST_CAPTION_MAX}
                composePlaceholder={state.composePlaceholder}
                place={place}
                onPlacePress={() => {
                  haptic.toggle();
                  setPlaceOpen(true);
                }}
                eventTitle={eventTitle}
                onEventTitle={setEventTitle}
                eventStartsAt={eventStartsAt}
                onEventStartsAt={setEventStartsAt}
                eventEndsAt={eventEndsAt}
                onEventEndsAt={setEventEndsAt}
                marketplaceIntent={marketplaceIntent}
                onMarketplaceIntent={setMarketplaceIntent}
                marketplacePrice={marketplacePrice}
                onMarketplacePrice={setMarketplacePrice}
                promotionEndsAt={promotionEndsAt}
                onPromotionEndsAt={setPromotionEndsAt}
                error={error}
                mediaSection={
                  <>
                    <MediaPicker
                      id={addInputId}
                      inputRef={fileInputRef}
                      onFiles={(files) => {
                        void addMediaFiles(files);
                      }}
                    />
                    <div
                      className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                      role="list"
                      aria-label="Post media"
                    >
                      {showAdd ? (
                        <div
                          role="listitem"
                          className={`${thumbClass} border border-dashed border-black/[0.12]`}
                        >
                          <button
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={openCameraForPostMedia}
                            aria-label="Add media"
                            className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-[#8E8E93] transition active:scale-[0.97]"
                          >
                            <IconPhoto className="h-6 w-6" />
                            <span className="text-[10px] font-semibold leading-none tracking-tight">
                              Add
                            </span>
                          </button>
                        </div>
                      ) : null}

                      {media.map((p, i) => (
                        <div key={p.id} role="listitem" className={thumbClass}>
                          {p.kind === 'video' ? (
                            <>
                              <video
                                src={p.previewUrl}
                                muted
                                playsInline
                                preload="metadata"
                                className="absolute inset-0 h-full w-full object-cover"
                              />
                              <VideoTextOverlays layers={p.textLayers} />
                            </>
                          ) : (
                            <button
                              type="button"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => openPreview(p, i)}
                              aria-label="View photo"
                              className="absolute inset-0"
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={p.previewUrl}
                                alt=""
                                className="h-full w-full object-cover"
                              />
                            </button>
                          )}
                          {p.kind === 'video' ? (
                            <span className="pointer-events-none absolute bottom-1 left-1 rounded bg-black/55 px-1 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">
                              Video
                            </span>
                          ) : null}
                          {p.uploading ? (
                            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/35">
                              <IconSpinner className="h-5 w-5 animate-spin text-white" />
                              {typeof p.uploadProgress === 'number' ? (
                                <span className="text-[10px] font-semibold tabular-nums text-white">
                                  {Math.round(p.uploadProgress * 100)}%
                                </span>
                              ) : null}
                            </div>
                          ) : null}
                          <button
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={(e) => {
                              e.stopPropagation();
                              removeMedia(p.id);
                            }}
                            aria-label="Remove media"
                            className="absolute right-1 top-1 z-[1] inline-flex h-6 w-6 items-center justify-center rounded-full bg-black/55 text-white transition active:scale-95"
                          >
                            <IconX className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </>
                }
              />
            ) : null}
          </div>
        </section>

        {/* Viewport 2 — camera (Story publish / Post attach) */}
        <section
          ref={cameraRef}
          className="box-border h-full w-full shrink-0 snap-start snap-always"
        >
          <MediaCapture
            embedded
            open
            cameraActive={cameraActive}
            publishMode={mode === 'story'}
            contentShape={mode === 'story' ? 'story' : 'standard'}
            mentionTypeId={mentionTypeId}
            initialLocation={postLocation}
            onLocationChange={(next) => {
              setPlace((prev) => ({
                ...prev,
                ...next,
                precision: 'exact',
              }));
            }}
            allowVideo={mode === 'story' || canAddVideo}
            onRequestPostCompose={() => {
              setMode('post');
              scrollToCompose();
            }}
            onRequestStoryMode={() => {
              setMode('story');
              scrollToCamera();
            }}
            onPosted={() => {
              onCreated?.();
              onClose();
            }}
            onClose={() => {
              if (mode === 'post') {
                scrollToCompose();
                return;
              }
              onClose();
            }}
            onCapture={(file, result) => {
              void addMediaFiles([file], result);
            }}
            onPickFiles={(files) => {
              void addMediaFiles(files);
            }}
            onSelectRecent={(entry) => {
              addRecentEntry(entry);
            }}
          />
        </section>
      </div>

      <ComposePlaceSheet
        open={placeOpen}
        value={place}
        onChange={setPlace}
        onClose={() => setPlaceOpen(false)}
      />

      {pendingKind ? (
        <div
          className={`fixed inset-0 ${Z_LAYER_CLASS.CRITICAL_DIALOG} flex items-center justify-center bg-black/55 px-4`}
          role="presentation"
          onClick={() => setPendingKind(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="switch-kind-title"
            className="w-full max-w-sm overflow-hidden rounded-2xl bg-[#1c1c1e] text-center shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-white/10 px-5 py-4">
              <h2
                id="switch-kind-title"
                className="text-[17px] font-semibold tracking-tight text-white"
              >
                Switch to {pendingKind.label}?
              </h2>
              <p className="mt-1 text-[13px] leading-snug text-white/55">
                Your {category.label} details will be cleared. Caption and media
                stay.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                haptic.toggle();
                applyKindSwitch(pendingKind);
              }}
              className="w-full border-b border-white/10 py-3.5 text-[16px] font-semibold text-[#FF453A] transition active:bg-white/5"
            >
              Switch & clear details
            </button>
            <button
              type="button"
              onClick={() => {
                haptic.toggle();
                setPendingKind(null);
              }}
              className="w-full py-3.5 text-[16px] font-semibold text-white transition active:bg-white/5"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {previewIndex != null && lightboxItems.length > 0 ? (
        <PinMediaLightbox
          items={lightboxItems}
          index={previewIndex}
          onClose={() => setPreviewIndex(null)}
          onIndexChange={setPreviewIndex}
        />
      ) : null}
    </div>,
    document.body,
  );
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function toLocalInput(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function nextHalfHour(): Date {
  const date = new Date();
  date.setSeconds(0, 0);
  const minutes = date.getMinutes();
  if (minutes === 0) return date;
  if (minutes <= 30) {
    date.setMinutes(30);
    return date;
  }
  date.setHours(date.getHours() + 1, 0, 0, 0);
  return date;
}

function defaultLocalStart(): string {
  return toLocalInput(nextHalfHour());
}
