import { NextResponse } from 'next/server';
import { getSessionAccount } from '@/lib/auth/getSessionAccount';
import {
  canViewerSeePost,
  isEditablePostVisibility,
  POST_VISIBILITY,
} from '@/lib/community/postVisibility';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { POST_CAPTION_MAX } from '@/features/community/postCaptionLimits';
import { buildPostPlaceBits } from '@/features/feed/postPlaceLabel';
import {
  parseComposePostBody,
  type ComposePostBody,
} from '@/lib/community/composePostPayload';
import { replacePrimaryInterest } from '@/lib/community/postInterest';

type RouteCtx = { params: Promise<{ id: string }> };

/**
 * GET /api/community/posts/[id]
 * Lightweight pin/post detail for the map pin card / feed post page.
 */
export async function GET(_req: Request, ctx: RouteCtx) {
  try {
    const { id: postId } = await ctx.params;
    if (!postId) {
      return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    }

    const session = await getSessionAccount();
    const supabase = await createSupabaseServerClient();

    const { data: post, error } = await supabase
      .schema('community')
      .from('posts')
      .select(
        'id, kind, content_shape, body, emoji, full_address, unit_id, zipcode_id, lat, lng, account_id, mention_type_id, like_count, comment_count, view_count, created_at, visibility, is_active, archived, expires_at, meta',
      )
      .eq('id', postId)
      .eq('is_active', true)
      .maybeSingle();

    if (error || !post) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const isOwner = Boolean(session?.accountId && session.accountId === post.account_id);

    // Archived pins are owner-only (Your activity → Archive). Everyone else gets 404.
    if (post.archived && !isOwner) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    let viewerFollowsAuthor = false;
    if (
      !isOwner &&
      post.visibility === POST_VISIBILITY.shared &&
      session?.accountId &&
      post.account_id
    ) {
      const { data: edge } = await supabase
        .schema('community')
        .from('connections')
        .select('from_account_id')
        .eq('from_account_id', session.accountId)
        .eq('to_account_id', post.account_id)
        .eq('relationship', 'follow')
        .eq('status', 'accepted')
        .maybeSingle();
      viewerFollowsAuthor = Boolean(edge);
    }

    if (
      !canViewerSeePost({
        visibility: post.visibility,
        accountId: post.account_id,
        viewerAccountId: session?.accountId ?? null,
        viewerFollowsAuthor,
        isActive: post.is_active,
        archived: post.archived,
        expiresAt: post.expires_at,
      })
    ) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // Mutual block → treat as not found for non-owners.
    if (!isOwner && session?.accountId && post.account_id) {
      const [{ data: outBlock }, { data: inBlock }] = await Promise.all([
        supabase
          .schema('community')
          .from('account_blocks')
          .select('blocked_account_id')
          .eq('blocker_account_id', session.accountId)
          .eq('blocked_account_id', post.account_id)
          .maybeSingle(),
        supabase
          .schema('community')
          .from('account_blocks')
          .select('blocker_account_id')
          .eq('blocker_account_id', post.account_id)
          .eq('blocked_account_id', session.accountId)
          .maybeSingle(),
      ]);
      if (outBlock || inBlock) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
      }
    }

    let account: {
      id: string;
      username: string | null;
      image_url: string | null;
      first_name: string | null;
      last_name: string | null;
    } | null = null;
    if (post.account_id) {
      const { data: acc } = await supabase
        .from('accounts')
        .select('id, username, image_url, first_name, last_name')
        .eq('id', post.account_id)
        .maybeSingle();
      account = acc ?? null;
    }

    let mention_type: { id: string; name: string; emoji: string } | null = null;
    if (post.mention_type_id) {
      const { data: mt } = await supabase
        .from('mention_types')
        .select('id, name, emoji')
        .eq('id', post.mention_type_id)
        .maybeSingle();
      if (mt?.id) {
        mention_type = {
          id: String(mt.id),
          name: mt.name ?? '',
          emoji: mt.emoji ?? '',
        };
      }
    }

    let interest: { id: string; slug: string; name: string } | null = null;
    const { data: primaryInterestRow } = await supabase
      .schema('community')
      .from('post_interests')
      .select('interest_id')
      .eq('post_id', postId)
      .eq('is_primary', true)
      .maybeSingle();
    if (primaryInterestRow?.interest_id) {
      const { data: interestRow } = await supabase
        .from('interests')
        .select('id, slug, name')
        .eq('id', primaryInterestRow.interest_id)
        .maybeSingle();
      if (interestRow?.id && interestRow.slug) {
        interest = {
          id: String(interestRow.id),
          slug: String(interestRow.slug),
          name: String(interestRow.name ?? interestRow.slug),
        };
      }
    }

    const { data: mediaRows } = await supabase
      .schema('community')
      .from('post_media')
      .select('id, post_id, url, media_type, sort_order')
      .eq('post_id', postId)
      .order('sort_order', { ascending: true });

    const localMeta = post.meta as { media_text_layers?: Record<string, unknown> } | null;
    const mediaTextLayers =
      localMeta?.media_text_layers && typeof localMeta.media_text_layers === 'object'
        ? localMeta.media_text_layers
        : {};

    const resolvedMedia = (mediaRows ?? []).map((m) => {
      const url = String(m.url);
      const layers = mediaTextLayers[url];
      return {
        id: String(m.id),
        url,
        type: (m.media_type as string) || 'image',
        alt: null as string | null,
        sort_order: typeof m.sort_order === 'number' ? m.sort_order : 0,
        textLayers: Array.isArray(layers) ? layers : null,
      };
    });

    let is_liked = false;
    let is_reported = false;
    if (session?.accountId) {
      const [{ data: reaction }, { data: report }] = await Promise.all([
        supabase
          .schema('community')
          .from('reactions')
          .select('id')
          .eq('account_id', session.accountId)
          .eq('entity_type', 'community_post')
          .eq('entity_id', postId)
          .eq('type', 'like')
          .maybeSingle(),
        supabase
          .schema('community')
          .from('content_reports')
          .select('id')
          .eq('reporter_account_id', session.accountId)
          .eq('entity_type', 'community_post')
          .eq('entity_id', postId)
          .maybeSingle(),
      ]);
      is_liked = Boolean(reaction?.id);
      is_reported = Boolean(report?.id);
    }

    const unitId = post.unit_id ? String(post.unit_id) : null;
    const zipcodeId = post.zipcode_id ? String(post.zipcode_id) : null;
    const unitIds = [unitId, zipcodeId].filter((id): id is string => Boolean(id));
    let cityName: string | null = null;
    let zipCode: string | null = null;
    if (unitIds.length > 0) {
      const { data: units } = await supabase
        .schema('territory')
        .from('units')
        .select('id, name')
        .in('id', unitIds);
      const byId = new Map(
        (units ?? []).map((u) => [
          String((u as { id: string }).id),
          String((u as { name: string | null }).name ?? '').trim(),
        ]),
      );
      cityName = unitId ? byId.get(unitId) || null : null;
      zipCode = zipcodeId ? byId.get(zipcodeId) || null : null;
    }
    const place = buildPostPlaceBits({
      unitId,
      zipcodeId,
      cityName,
      zipCode,
      fullAddress: post.full_address,
    });

    return NextResponse.json({
      post: {
        id: post.id,
        kind: post.kind,
        content_shape: post.content_shape ?? 'standard',
        body: post.body,
        emoji: post.emoji,
        full_address: post.full_address,
        unit_id: place.unitId,
        zipcode_id: place.zipcodeId,
        city_name: place.cityName,
        zip_code: place.zipCode,
        place_label: place.label,
        lat: post.lat,
        lng: post.lng,
        account_id: post.account_id,
        like_count: post.like_count ?? 0,
        comment_count: post.comment_count ?? 0,
        view_count: post.view_count ?? 0,
        created_at: post.created_at,
        visibility: post.visibility ?? POST_VISIBILITY.public,
        archived: Boolean(post.archived),
        expires_at: post.expires_at ?? null,
        mention_type,
        mention_type_id: post.mention_type_id ? String(post.mention_type_id) : null,
        interest,
        account,
        media: resolvedMedia,
        is_liked,
        is_owner: isOwner,
        is_reported,
      },
    });
  } catch (e) {
    console.error('[community/posts/id GET]', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

/**
 * PATCH /api/community/posts/[id]
 * Owner-only full compose edit, or legacy `{ body, visibility }` patch.
 */
export async function PATCH(req: Request, ctx: RouteCtx) {
  try {
    const session = await getSessionAccount();
    if (!session) {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }

    const { id: postId } = await ctx.params;
    const json = (await req.json().catch(() => ({}))) as ComposePostBody & {
      body?: string;
    };

    const isFullCompose =
      typeof json.content === 'string' ||
      json.map_data != null ||
      typeof json.mention_type_id === 'string' ||
      typeof json.category_id === 'string' ||
      Array.isArray(json.images) ||
      json.interest_id != null;

    const supabase = await createSupabaseServerClient();
    const { data: existing, error: fetchErr } = await supabase
      .schema('community')
      .from('posts')
      .select('id, account_id, archived, content_shape, meta, experience_zone_id')
      .eq('id', postId)
      .maybeSingle();

    if (fetchErr || !existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    if (existing.account_id !== session.accountId) {
      return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
    }
    if (existing.archived) {
      return NextResponse.json({ error: 'Post is archived' }, { status: 400 });
    }

    if (!isFullCompose) {
      const hasBody = typeof json.body === 'string';
      const hasVisibility = typeof json.visibility === 'string';
      if (!hasBody && !hasVisibility) {
        return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
      }

      let body: string | undefined;
      if (hasBody) {
        body = json.body!.trim();
        if (!body) {
          return NextResponse.json({ error: 'Caption is required' }, { status: 400 });
        }
        if (body.length > POST_CAPTION_MAX) {
          return NextResponse.json({ error: 'Caption is too long' }, { status: 400 });
        }
      }

      let visibility: string | undefined;
      if (hasVisibility) {
        visibility = json.visibility!.trim();
        if (!isEditablePostVisibility(visibility)) {
          return NextResponse.json({ error: 'Invalid visibility' }, { status: 400 });
        }
      }

      const update: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };
      if (body !== undefined) update.body = body;
      if (visibility !== undefined) update.visibility = visibility;

      const { error: updateErr } = await supabase
        .schema('community')
        .from('posts')
        .update(update)
        .eq('id', postId)
        .eq('account_id', session.accountId);

      if (updateErr) {
        console.error('[community/posts/id PATCH]', updateErr);
        return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        ...(body !== undefined ? { body } : {}),
        ...(visibility !== undefined ? { visibility } : {}),
      });
    }

    const lockedShape =
      existing.content_shape === 'story' ? 'story' : 'standard';
    const parsed = await parseComposePostBody(supabase, json, {
      contentShape: lockedShape,
    });
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: parsed.status });
    }
    const data = parsed.data;

    const priorMeta =
      existing.meta && typeof existing.meta === 'object'
        ? (existing.meta as Record<string, unknown>)
        : {};
    const nextMeta: Record<string, unknown> = {
      ...priorMeta,
      map_data: { lat: data.lat, lng: data.lng, address: data.address ?? undefined },
      format: data.contentShape,
      ...(Object.keys(data.mediaTextLayers).length > 0
        ? { media_text_layers: data.mediaTextLayers }
        : { media_text_layers: {} }),
    };

    const { error: updateErr } = await supabase
      .schema('community')
      .from('posts')
      .update({
        body: data.content,
        mention_type_id: data.categoryUuid,
        category_id: data.categoryUuid,
        subtype_id: null,
        emoji: data.composeCategory?.emoji ?? null,
        title: data.composeCategory?.label ?? data.mentionType.name ?? null,
        lat: data.lat,
        lng: data.lng,
        full_address: data.address,
        visibility: data.visibility,
        meta: nextMeta,
        updated_at: new Date().toISOString(),
        ...(data.experienceZoneId
          ? { experience_zone_id: data.experienceZoneId }
          : {}),
      } as never)
      .eq('id', postId)
      .eq('account_id', session.accountId);

    if (updateErr) {
      console.error('[community/posts/id PATCH]', updateErr);
      return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
    }

    try {
      await replacePrimaryInterest(supabase, postId, data.primaryInterestId);
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : 'Could not save that topic.' },
        { status: 400 },
      );
    }

    const { error: mediaDelErr } = await supabase
      .schema('community')
      .from('post_media')
      .delete()
      .eq('post_id', postId);
    if (mediaDelErr) {
      console.error('[community/posts/id PATCH] media delete:', mediaDelErr);
      return NextResponse.json({ error: 'Failed to update media' }, { status: 500 });
    }

    if (data.mediaItems.length > 0) {
      const { error: mediaErr } = await supabase.schema('community').from('post_media').insert(
        data.mediaItems.map((item, sort_order) => ({
          post_id: postId,
          account_id: session.accountId,
          url: item.url,
          media_type: item.type,
          sort_order,
          meta: item.key ? { storage: 'r2', key: item.key } : null,
        })) as never,
      );
      if (mediaErr) {
        console.error('[community/posts/id PATCH] media insert:', mediaErr);
        return NextResponse.json({ error: 'Failed to attach media' }, { status: 500 });
      }

      const keys = data.mediaItems
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
          console.warn('[community/posts/id PATCH] media_drafts link:', draftLinkErr);
        }
      }
    }

    return NextResponse.json({
      success: true,
      id: postId,
      body: data.content,
      visibility: data.visibility,
    });
  } catch (e) {
    console.error('[community/posts/id PATCH]', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/community/posts/[id]
 * Owner-only soft archive.
 * `?permanent=1` — hard-delete an already-archived post.
 */
export async function DELETE(req: Request, ctx: RouteCtx) {
  try {
    const session = await getSessionAccount();
    if (!session) {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }

    const { id: postId } = await ctx.params;
    const permanent = new URL(req.url).searchParams.get('permanent') === '1';
    const supabase = await createSupabaseServerClient();

    const { data: existing, error: fetchErr } = await supabase
      .schema('community')
      .from('posts')
      .select('id, account_id, archived, kind')
      .eq('id', postId)
      .maybeSingle();

    if (fetchErr || !existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    if (existing.account_id !== session.accountId) {
      return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
    }

    if (permanent) {
      if (!existing.archived) {
        return NextResponse.json(
          { error: 'Archive the post before permanently deleting it' },
          { status: 400 },
        );
      }

      await supabase.schema('community').from('post_media').delete().eq('post_id', postId);

      await supabase
        .schema('community')
        .from('reactions')
        .delete()
        .eq('entity_type', 'community_post')
        .eq('entity_id', postId)
        .eq('account_id', session.accountId);
      await supabase
        .schema('community')
        .from('comments')
        .delete()
        .eq('entity_type', 'community_post')
        .eq('entity_id', postId)
        .eq('author_account_id', session.accountId);

      const { error: delErr } = await supabase
        .schema('community')
        .from('posts')
        .delete()
        .eq('id', postId)
        .eq('account_id', session.accountId);

      if (delErr) {
        console.error('[community/posts/id DELETE permanent]', delErr);
        return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
      }

      return NextResponse.json({ success: true, permanent: true });
    }

    if (existing.archived) {
      return NextResponse.json({ error: 'Already archived' }, { status: 400 });
    }

    const now = new Date().toISOString();
    const { error: archiveErr } = await supabase
      .schema('community')
      .from('posts')
      .update({ archived: true, updated_at: now })
      .eq('id', postId)
      .eq('account_id', session.accountId);

    if (archiveErr) {
      console.error('[community/posts/id DELETE]', archiveErr);
      return NextResponse.json({ error: 'Failed to archive' }, { status: 500 });
    }

    return NextResponse.json({ success: true, permanent: false });
  } catch (e) {
    console.error('[community/posts/id DELETE]', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
