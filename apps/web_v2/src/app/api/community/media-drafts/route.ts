import { NextResponse } from 'next/server';
import { getSessionAccount } from '@/lib/auth/getSessionAccount';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

type CreateBody = {
  url?: string;
  key?: string;
  media_type?: string;
};

function parseLimit(raw: string | null): number {
  const n = raw ? Number.parseInt(raw, 10) : DEFAULT_LIMIT;
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_LIMIT;
  return Math.min(MAX_LIMIT, n);
}

/**
 * GET — signed-in user's R2-backed Recents / media drafts (newest first).
 * POST — record a draft after a successful R2 upload (Save Draft / Send / Post).
 */
export async function GET(req: Request) {
  try {
    const session = await getSessionAccount();
    if (!session) {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const limit = parseLimit(searchParams.get('limit'));

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .schema('community')
      .from('media_drafts')
      .select('id, url, storage_key, media_type, post_id, created_at')
      .eq('account_id', session.accountId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('[media-drafts] GET', error);
      return NextResponse.json({ error: 'Could not load media drafts' }, { status: 500 });
    }

    return NextResponse.json({
      items: (data ?? []).map((row) => ({
        id: row.id as string,
        url: row.url as string,
        key: row.storage_key as string,
        mediaType: row.media_type as 'image' | 'video',
        postId: (row.post_id as string | null) ?? null,
        createdAt: row.created_at as string,
      })),
    });
  } catch (e) {
    console.error('[media-drafts] GET', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSessionAccount();
    if (!session) {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }

    const body = (await req.json()) as CreateBody;
    const url = typeof body.url === 'string' ? body.url.trim() : '';
    const key = typeof body.key === 'string' ? body.key.trim() : '';
    const mediaType =
      body.media_type === 'video' || body.media_type === 'image'
        ? body.media_type
        : null;

    if (!url.startsWith('https://')) {
      return NextResponse.json({ error: 'Public HTTPS url is required' }, { status: 400 });
    }
    if (!key || key.includes('..') || key.length > 512) {
      return NextResponse.json({ error: 'Invalid storage key' }, { status: 400 });
    }
    if (!mediaType) {
      return NextResponse.json({ error: 'media_type must be image or video' }, { status: 400 });
    }

    const supabase = await createSupabaseServerClient();

    // Idempotent on (account_id, storage_key) — return existing rather than
    // upsert-updating, so a later Post link (`post_id`) is never clobbered.
    const { data: existing, error: existingErr } = await supabase
      .schema('community')
      .from('media_drafts')
      .select('id, url, storage_key, media_type, post_id, created_at')
      .eq('account_id', session.accountId)
      .eq('storage_key', key)
      .maybeSingle();

    if (existingErr) {
      console.error('[media-drafts] POST lookup', existingErr);
      return NextResponse.json({ error: 'Could not save media draft' }, { status: 500 });
    }

    if (existing) {
      return NextResponse.json({
        id: existing.id as string,
        url: existing.url as string,
        key: existing.storage_key as string,
        mediaType: existing.media_type as 'image' | 'video',
        postId: (existing.post_id as string | null) ?? null,
        createdAt: existing.created_at as string,
      });
    }

    const { data: inserted, error: insertErr } = await supabase
      .schema('community')
      .from('media_drafts')
      .insert({
        account_id: session.accountId,
        url,
        storage_key: key,
        media_type: mediaType,
      })
      .select('id, url, storage_key, media_type, post_id, created_at')
      .single();

    if (insertErr || !inserted) {
      console.error('[media-drafts] POST insert', insertErr);
      return NextResponse.json({ error: 'Could not save media draft' }, { status: 500 });
    }

    const row = inserted;

    return NextResponse.json({
      id: row.id as string,
      url: row.url as string,
      key: row.storage_key as string,
      mediaType: row.media_type as 'image' | 'video',
      postId: (row.post_id as string | null) ?? null,
      createdAt: row.created_at as string,
    });
  } catch (e) {
    console.error('[media-drafts] POST', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

type DeleteBody = {
  ids?: unknown;
};

/** DELETE — remove one or more of the signed-in user's media drafts by id. */
export async function DELETE(req: Request) {
  try {
    const session = await getSessionAccount();
    if (!session) {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }

    const body = (await req.json()) as DeleteBody;
    const ids = Array.isArray(body.ids)
      ? body.ids
          .filter((id): id is string => typeof id === 'string')
          .map((id) => id.trim())
          .filter(Boolean)
          .slice(0, 50)
      : [];

    if (ids.length === 0) {
      return NextResponse.json({ error: 'ids required' }, { status: 400 });
    }

    const supabase = await createSupabaseServerClient();
    const { error, count } = await supabase
      .schema('community')
      .from('media_drafts')
      .delete({ count: 'exact' })
      .eq('account_id', session.accountId)
      .in('id', ids);

    if (error) {
      console.error('[media-drafts] DELETE', error);
      return NextResponse.json({ error: 'Could not delete media drafts' }, { status: 500 });
    }

    return NextResponse.json({ deleted: count ?? ids.length });
  } catch (e) {
    console.error('[media-drafts] DELETE', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
