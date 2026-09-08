import type { SupabaseClient } from '@supabase/supabase-js';
import {
  COMMUNITY_POST_MAX_PHOTOS,
  COMMUNITY_POST_MAX_VIDEOS,
} from '@/lib/community/composeMediaLimits';
import { assertCatalogInterest } from '@/lib/community/postInterest';
import { POST_CAPTION_MAX } from '@/features/community/postCaptionLimits';
import {
  composeCategoryBySlug,
  isComposeKind,
  resolveMentionTypeId,
  type ContributionCategory,
  type ComposeKindId,
} from '@/features/community/contributionTypes';
import { isWithinMinnesota } from '@/map/location/device/minnesotaBounds';

export type ComposePostTextLayer = {
  id?: string;
  content?: string;
  x?: number;
  y?: number;
  scale?: number;
  color?: string;
  background?: 'none' | 'solid' | 'glass';
  bold?: boolean;
};

export type ComposePostBody = {
  content?: string;
  mention_type_id?: string;
  category_id?: string;
  interest_id?: string | null;
  source?: 'map_dock' | 'feed' | string | null;
  visibility?: 'public' | 'only_me' | 'draft' | 'shared';
  content_shape?: 'standard' | 'story';
  map_data?: {
    lat?: number;
    lng?: number;
    address?: string;
    place_name?: string;
  } | null;
  experience_zone_id?: string | null;
  images?: Array<{
    url?: string;
    type?: string;
    alt?: string;
    key?: string;
    text_layers?: ComposePostTextLayer[] | null;
  }> | null;
};

export type ParsedComposeMediaItem = {
  url: string;
  type: 'image' | 'video';
  textLayers?: ComposePostTextLayer[];
  key: string | null;
};

export type ParsedComposePost = {
  content: string;
  lat: number;
  lng: number;
  address: string | null;
  visibility: 'public' | 'shared' | 'only_me';
  contentShape: 'standard' | 'story';
  categoryUuid: string;
  composeCategory: (ContributionCategory & { id: ComposeKindId }) | null;
  mentionType: { id: string; name: string | null };
  primaryInterestId: string | null;
  mediaItems: ParsedComposeMediaItem[];
  mediaTextLayers: Record<string, ComposePostTextLayer[]>;
  experienceZoneId: string | null;
};

function sanitizeTextLayers(
  raw: ComposePostTextLayer[] | null | undefined,
): ComposePostTextLayer[] | undefined {
  if (!Array.isArray(raw) || raw.length === 0) return undefined;
  const out: ComposePostTextLayer[] = [];
  for (const layer of raw.slice(0, 12)) {
    const content = typeof layer?.content === 'string' ? layer.content.trim() : '';
    if (!content) continue;
    out.push({
      id: typeof layer.id === 'string' ? layer.id : `tl-${out.length}`,
      content: content.slice(0, 500),
      x: typeof layer.x === 'number' && Number.isFinite(layer.x) ? layer.x : 0.5,
      y: typeof layer.y === 'number' && Number.isFinite(layer.y) ? layer.y : 0.5,
      scale:
        typeof layer.scale === 'number' && Number.isFinite(layer.scale)
          ? layer.scale
          : 1,
      color: typeof layer.color === 'string' ? layer.color : '#FFFFFF',
      background:
        layer.background === 'solid' || layer.background === 'glass'
          ? layer.background
          : 'none',
      bold: Boolean(layer.bold),
    });
  }
  return out.length > 0 ? out : undefined;
}

export type ParseComposePostResult =
  | { ok: true; data: ParsedComposePost }
  | { ok: false; error: string; status: number };

/**
 * Validate compose/create/edit payload shared by POST and PATCH.
 */
export async function parseComposePostBody(
  supabase: SupabaseClient,
  body: ComposePostBody,
  opts?: {
    /** Lock shape on edit — stories stay stories. */
    contentShape?: 'standard' | 'story';
    /** When false, skip interest requirement (map dock quick post). */
    requireInterest?: boolean;
  },
): Promise<ParseComposePostResult> {
  const content = typeof body.content === 'string' ? body.content.trim() : '';
  const contentShape =
    opts?.contentShape ?? (body.content_shape === 'story' ? 'story' : 'standard');
  const categoryIdRaw =
    typeof body.category_id === 'string' && body.category_id.trim()
      ? body.category_id.trim()
      : typeof body.mention_type_id === 'string'
        ? body.mention_type_id.trim()
        : '';
  const lat = body.map_data?.lat;
  const lng = body.map_data?.lng;
  const address =
    body.map_data?.address?.trim() || body.map_data?.place_name?.trim() || null;

  const experienceZoneId =
    typeof body.experience_zone_id === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      body.experience_zone_id,
    )
      ? body.experience_zone_id
      : null;

  const rawImages = Array.isArray(body.images) ? body.images : [];
  const mediaItems: ParsedComposeMediaItem[] = rawImages.map((img) => {
    const url = typeof img?.url === 'string' ? img.url.trim() : '';
    const key =
      typeof img?.key === 'string' && img.key.trim() && !img.key.includes('..')
        ? img.key.trim().slice(0, 512)
        : null;
    const explicit = img?.type === 'video' || img?.type === 'image' ? img.type : null;
    const inferred =
      explicit ?? (/\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(url) ? 'video' : 'image');
    const type = inferred as 'image' | 'video';
    const textLayers =
      type === 'video' ? sanitizeTextLayers(img?.text_layers) : undefined;
    return { url, type, textLayers, key };
  });

  const mediaTextLayers: Record<string, ComposePostTextLayer[]> = {};
  for (const item of mediaItems) {
    if (item.textLayers?.length) mediaTextLayers[item.url] = item.textLayers;
  }

  if (mediaItems.some((m) => !m.url)) {
    return { ok: false, error: 'Media URL is required', status: 400 };
  }

  const photoCount = mediaItems.filter((m) => m.type === 'image').length;
  const videoCount = mediaItems.filter((m) => m.type === 'video').length;
  if (photoCount > COMMUNITY_POST_MAX_PHOTOS) {
    return {
      ok: false,
      error: `Up to ${COMMUNITY_POST_MAX_PHOTOS} photos can be attached`,
      status: 400,
    };
  }
  if (videoCount > COMMUNITY_POST_MAX_VIDEOS) {
    return { ok: false, error: 'Only one video can be attached', status: 400 };
  }

  if (!categoryIdRaw) {
    return { ok: false, error: 'Category is required', status: 400 };
  }
  if (!content && mediaItems.length === 0) {
    return { ok: false, error: 'Add a caption or media to post', status: 400 };
  }
  if (content.length > POST_CAPTION_MAX) {
    return { ok: false, error: 'Caption is too long', status: 400 };
  }
  if (
    typeof lat !== 'number' ||
    typeof lng !== 'number' ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lng)
  ) {
    return { ok: false, error: 'Location is required', status: 400 };
  }
  if (!isWithinMinnesota({ lat, lng })) {
    return { ok: false, error: 'Location must be within Minnesota', status: 400 };
  }

  const { data: mentionType } = await supabase
    .from('mention_types')
    .select('id, name')
    .eq('id', categoryIdRaw)
    .eq('is_active', true)
    .maybeSingle();
  if (!mentionType) {
    return { ok: false, error: 'Invalid category', status: 400 };
  }

  const categorySlug = String(mentionType.name ?? '')
    .trim()
    .toLowerCase();
  const composeCategory = isComposeKind(categorySlug)
    ? composeCategoryBySlug(categorySlug)
    : null;
  const categoryUuid = composeCategory
    ? resolveMentionTypeId(composeCategory.id)
    : categoryIdRaw;

  const interestRaw =
    typeof body.interest_id === 'string' ? body.interest_id.trim() : '';
  let primaryInterestId: string | null = null;
  if (interestRaw) {
    try {
      const topic = await assertCatalogInterest(supabase, interestRaw);
      primaryInterestId = topic.id;
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : 'Pick a public topic.',
        status: 400,
      };
    }
  } else if (
    opts?.requireInterest === true &&
    contentShape === 'standard' &&
    composeCategory &&
    body.source !== 'map_dock'
  ) {
    return { ok: false, error: 'Pick what this is about.', status: 400 };
  }

  const visibility =
    body.visibility === 'draft' || body.visibility === 'only_me'
      ? 'only_me'
      : body.visibility === 'shared'
        ? 'shared'
        : 'public';

  return {
    ok: true,
    data: {
      content,
      lat,
      lng,
      address,
      visibility,
      contentShape,
      categoryUuid,
      composeCategory,
      mentionType: { id: String(mentionType.id), name: mentionType.name },
      primaryInterestId,
      mediaItems,
      mediaTextLayers,
      experienceZoneId,
    },
  };
}
