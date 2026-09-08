import { NextResponse } from 'next/server';
import { getSessionAccount } from '@/lib/auth/getSessionAccount';
import {
  COMMUNITY_POST_MAX_PHOTOS,
  COMMUNITY_POST_MAX_VIDEOS,
} from '@/lib/community/composeMediaLimits';
import {
  assertCatalogInterest,
  insertPrimaryInterest,
} from '@/lib/community/postInterest';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { isWithinMinnesota } from '@/map/location/device/minnesotaBounds';
import { POST_CAPTION_MAX } from '@/features/community/postCaptionLimits';
import {
  composeCategoryBySlug,
  isComposeKind,
  resolveMentionTypeId,
} from '@/features/community/contributionTypes';
import { storyExpiresAt } from '@/lib/community/storyExpiry';

type TextLayerPayload = {
  id?: string;
  content?: string;
  x?: number;
  y?: number;
  scale?: number;
  color?: string;
  background?: 'none' | 'solid' | 'glass';
  bold?: boolean;
};

type CreateBody = {
  content?: string;
  mention_type_id?: string;
  category_id?: string;
  interest_id?: string | null;
  source?: 'map_dock' | 'feed' | string | null;
  /** `draft` is accepted as an alias for `only_me`. */
  visibility?: 'public' | 'only_me' | 'draft' | 'shared';
  /** Regular map post vs ephemeral-style story. */
  content_shape?: 'standard' | 'story';
  map_data?: {
    lat?: number;
    lng?: number;
    address?: string;
    place_name?: string;
  } | null;
  /** Experience zone the user was exploring when they contributed. */
  experience_zone_id?: string | null;
  /** Kind-specific structured fields (event / marketplace / promotion). */
  kind_meta?: Record<string, unknown> | null;
  event_starts_at?: string | null;
  event_ends_at?: string | null;
  images?: Array<{
    url?: string;
    type?: string;
    alt?: string;
    /** R2 object key — stored on `post_media.meta.key`. */
    key?: string;
    /** Video CSS overlays — not burned into frames (ffmpeg TODO). */
    text_layers?: TextLayerPayload[] | null;
  }> | null;
};

function sanitizeTextLayers(
  raw: TextLayerPayload[] | null | undefined,
): TextLayerPayload[] | undefined {
  if (!Array.isArray(raw) || raw.length === 0) return undefined;
  const out: TextLayerPayload[] = [];
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

/**
 * Create a single community post (feed + map when lat/lng set).
 * Compose kinds write category_id + optional interest.
 * Stories keep the Story mention type without requiring an interest.
 */
export async function POST(req: Request) {
  try {
    const session = await getSessionAccount();
    if (!session) {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }

    const body = (await req.json()) as CreateBody;
    const content = typeof body.content === 'string' ? body.content.trim() : '';
    const contentShape = body.content_shape === 'story' ? 'story' : 'standard';
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
    const mediaItems = rawImages.map((img) => {
      const url = typeof img?.url === 'string' ? img.url.trim() : '';
      const key =
        typeof img?.key === 'string' && img.key.trim() && !img.key.includes('..')
          ? img.key.trim().slice(0, 512)
          : null;
      const explicit = img?.type === 'video' || img?.type === 'image' ? img.type : null;
      const inferred =
        explicit ??
        (/\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(url) ? 'video' : 'image');
      const type = inferred as 'image' | 'video';
      const textLayers =
        type === 'video' ? sanitizeTextLayers(img?.text_layers) : undefined;
      return { url, type, textLayers, key };
    });

    const mediaTextLayers: Record<string, TextLayerPayload[]> = {};
    for (const item of mediaItems) {
      if (item.textLayers?.length) mediaTextLayers[item.url] = item.textLayers;
    }

    if (mediaItems.some((m) => !m.url)) {
      return NextResponse.json({ error: 'Media URL is required' }, { status: 400 });
    }

    const photoCount = mediaItems.filter((m) => m.type === 'image').length;
    const videoCount = mediaItems.filter((m) => m.type === 'video').length;
    if (photoCount > COMMUNITY_POST_MAX_PHOTOS) {
      return NextResponse.json(
        { error: `Up to ${COMMUNITY_POST_MAX_PHOTOS} photos can be attached` },
        { status: 400 },
      );
    }
    if (videoCount > COMMUNITY_POST_MAX_VIDEOS) {
      return NextResponse.json(
        { error: 'Only one video can be attached' },
        { status: 400 },
      );
    }

    if (!categoryIdRaw) {
      return NextResponse.json({ error: 'Category is required' }, { status: 400 });
    }
    if (!content && mediaItems.length === 0) {
      return NextResponse.json(
        { error: 'Add a caption or media to post' },
        { status: 400 },
      );
    }
    if (content.length > POST_CAPTION_MAX) {
      return NextResponse.json({ error: 'Caption is too long' }, { status: 400 });
    }
    if (
      typeof lat !== 'number' ||
      typeof lng !== 'number' ||
      !Number.isFinite(lat) ||
      !Number.isFinite(lng)
    ) {
      return NextResponse.json({ error: 'Location is required' }, { status: 400 });
    }
    if (!isWithinMinnesota({ lat, lng })) {
      return NextResponse.json({ error: 'Location must be within Minnesota' }, { status: 400 });
    }

    const supabase = await createSupabaseServerClient();

    const { data: mentionType } = await supabase
      .from('mention_types')
      .select('id, name')
      .eq('id', categoryIdRaw)
      .eq('is_active', true)
      .maybeSingle();
    if (!mentionType) {
      return NextResponse.json({ error: 'Invalid category' }, { status: 400 });
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
        return NextResponse.json(
          { error: err instanceof Error ? err.message : 'Pick a public topic.' },
          { status: 400 },
        );
      }
    }

    const visibility =
      body.visibility === 'draft' || body.visibility === 'only_me'
        ? 'only_me'
        : body.visibility === 'shared'
          ? 'shared'
          : 'public';

    const expiresAt = contentShape === 'story' ? storyExpiresAt() : null;

    const { data: post, error: postErr } = await supabase
      .schema('community')
      .from('posts')
      .insert({
        account_id: session.accountId,
        created_by_account_id: session.accountId,
        actor_account_id: session.accountId,
        kind: 'post',
        content_shape: contentShape,
        body: content,
        mention_type_id: categoryUuid,
        category_id: categoryUuid,
        subtype_id: null,
        emoji: composeCategory?.emoji ?? null,
        title: composeCategory?.label ?? mentionType.name ?? null,
        lat,
        lng,
        full_address: address,
        visibility,
        expires_at: expiresAt,
        tagged_account_ids: [],
        ...(experienceZoneId ? { experience_zone_id: experienceZoneId } : {}),
        meta: {
          map_data: { lat, lng, address: address ?? undefined },
          source: 'ios-2',
          format: contentShape,
          ...(expiresAt ? { expires_at: expiresAt } : {}),
          ...(experienceZoneId ? { experience_zone_id: experienceZoneId } : {}),
          ...(Object.keys(mediaTextLayers).length > 0
            ? { media_text_layers: mediaTextLayers }
            : {}),
          ...(body.kind_meta && typeof body.kind_meta === 'object'
            ? body.kind_meta
            : {}),
        },
        published_as: 'person',
      } as never)
      .select('id')
      .single();

    if (postErr || !post?.id) {
      console.error('[community/posts] insert:', postErr);
      return NextResponse.json({ error: 'Failed to create post' }, { status: 500 });
    }

    const postId = post.id as string;

    if (primaryInterestId) {
      try {
        await insertPrimaryInterest(supabase, postId, primaryInterestId);
      } catch (err) {
        await supabase.schema('community').from('posts').delete().eq('id', postId);
        return NextResponse.json(
          { error: err instanceof Error ? err.message : 'Could not save that topic.' },
          { status: 400 },
        );
      }
    }

    if (mediaItems.length > 0) {
      const { error: mediaErr } = await supabase.schema('community').from('post_media').insert(
        mediaItems.map((item, sort_order) => ({
          post_id: postId,
          account_id: session.accountId,
          url: item.url,
          media_type: item.type,
          sort_order,
          meta: item.key ? { storage: 'r2', key: item.key } : null,
        })) as never,
      );
      if (mediaErr) {
        console.error('[community/posts] post_media insert:', mediaErr);
        await supabase.schema('community').from('posts').delete().eq('id', postId);
        return NextResponse.json({ error: 'Failed to attach media' }, { status: 500 });
      }

      // Link matching drafts so uploads aren't orphaned after publish.
      const keys = mediaItems
        .map((m) => m.key)
        .filter((k): k is string => Boolean(k));
      if (keys.length > 0) {
        const { error: draftLinkErr } = await supabase
          .schema('community')
          .from('media_drafts')
          .update({ post_id: postId } as never)
          .eq('account_id', session.accountId)
          .in('storage_key', keys)
          .is('post_id', null);
        if (draftLinkErr) {
          console.warn('[community/posts] media_drafts link:', draftLinkErr);
        }
      }
    }

    if (composeCategory && contentShape === 'standard') {
      const { error: fanoutError } = await supabase.rpc('fanout_place_post_alert', {
        p_post_id: postId,
        p_author_account_id: session.accountId,
        p_lat: lat,
        p_lng: lng,
        p_category: composeCategory.id,
        p_body: content,
        p_interest_id: primaryInterestId,
      });
      if (fanoutError) {
        console.error('[community/posts] fanout:', fanoutError);
      }
    }

    return NextResponse.json({ id: postId }, { status: 201 });
  } catch (e) {
    console.error('[community/posts]', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
