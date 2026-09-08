import { NextResponse } from 'next/server';
import { getSessionAccount } from '@/lib/auth/getSessionAccount';
import {
  canViewPrivatePage,
  pageViewerAccess,
} from '@/lib/directory/pageAudience';
import {
  isPageMediaPrimaryRole,
  type PageMediaPrimaryRole,
} from '@/lib/directory/pageMediaRoles';
import { isPageLogoHttpUrl, isUserGeneratedPageType } from '@/lib/directory/pageTypes';
import { isUuid } from '@/lib/ai/subjectTypes';
import { createPageServiceClient } from '@/lib/supabase/pageDb';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

function normalizeHttpUrl(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const t = raw.trim();
  if (!t || !isPageLogoHttpUrl(t)) return null;
  try {
    const u = new URL(t);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    return u.toString();
  } catch {
    return null;
  }
}

async function loadOwnedPage(key: string, accountId: string): Promise<
  | {
      ok: true;
      row: {
        id: string;
        owner_id: string | null;
        claimed_by: string | null;
        entity_id: string | null;
        page_type: string | null;
        icon: string | null;
        cover_url: string | null;
      };
      pagesDb: ReturnType<typeof createPageServiceClient>;
    }
  | { ok: false; error: string; status: number }
> {
  const pagesDb = createPageServiceClient();
  const byId = isUuid(key);
  const { data, error } = await pagesDb
    .from('pages')
    .select('id, owner_id, claimed_by, entity_id, page_type, icon, cover_url')
    .eq(byId ? 'id' : 'slug', key)
    .maybeSingle();

  if (error) {
    console.error('[directory/pages/media load]', error);
    return { ok: false, error: 'Failed to load page', status: 500 };
  }
  if (!data) {
    return { ok: false, error: 'Not found', status: 404 };
  }

  const row = data as {
    id: string;
    owner_id: string | null;
    claimed_by: string | null;
    entity_id: string | null;
    page_type: string | null;
    icon: string | null;
    cover_url: string | null;
  };

  if (row.entity_id != null || !isUserGeneratedPageType(row.page_type)) {
    return { ok: false, error: 'Not found', status: 404 };
  }

  const viewer = pageViewerAccess(accountId, row.owner_id, row.claimed_by);
  if (!canViewPrivatePage(viewer)) {
    return { ok: false, error: 'Forbidden', status: 403 };
  }

  return { ok: true, row, pagesDb };
}

/**
 * Replace logo or cover on a user-generated page.
 * Deletes prior page_media rows for that role, inserts the new URL,
 * and mirrors onto pages.icon / pages.cover_url for legacy readers.
 *
 * POST /api/directory/pages/[id]/media
 * Body: { role: 'logo' | 'cover', url: string }
 */
export async function POST(request: Request, context: RouteContext) {
  try {
    const session = await getSessionAccount();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: raw } = await context.params;
    const key = decodeURIComponent(raw ?? '').trim();
    if (!key) {
      return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    }

    const body = (await request.json()) as { role?: unknown; url?: unknown };
    if (!isPageMediaPrimaryRole(body.role)) {
      return NextResponse.json(
        { error: "role must be 'logo' or 'cover'" },
        { status: 400 },
      );
    }
    const role: PageMediaPrimaryRole = body.role;
    const url = normalizeHttpUrl(body.url);
    if (!url) {
      return NextResponse.json({ error: 'Valid image URL required' }, { status: 400 });
    }

    const loaded = await loadOwnedPage(key, session.accountId);
    if (!loaded.ok) {
      return NextResponse.json({ error: loaded.error }, { status: loaded.status });
    }
    const { row, pagesDb } = loaded;

    const { error: delErr } = await pagesDb
      .from('page_media')
      .delete()
      .eq('page_id', row.id)
      .eq('role', role);

    if (delErr) {
      console.error('[directory/pages/media delete prior]', delErr);
      return NextResponse.json({ error: 'Failed to replace media' }, { status: 500 });
    }

    const { data: inserted, error: insErr } = await pagesDb
      .from('page_media')
      .insert({
        page_id: row.id,
        url,
        role,
        sort_order: 0,
      })
      .select('id, page_id, url, role, sort_order')
      .maybeSingle();

    if (insErr || !inserted) {
      console.error('[directory/pages/media insert]', insErr);
      return NextResponse.json(
        { error: insErr?.message ?? 'Failed to save media' },
        { status: 500 },
      );
    }

    const pagePatch: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (role === 'logo') {
      pagePatch.icon = url;
    } else {
      pagePatch.cover_url = url;
    }

    const { error: pageErr } = await pagesDb
      .from('pages')
      .update(pagePatch)
      .eq('id', row.id);

    if (pageErr) {
      console.error('[directory/pages/media page mirror]', pageErr);
      // Media row is saved — mirror is best-effort.
    }

    return NextResponse.json(
      {
        ok: true,
        role,
        url,
        media: inserted,
      },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (e) {
    console.error('[directory/pages/media POST]', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * Clear logo or cover.
 * DELETE /api/directory/pages/[id]/media?role=logo|cover
 */
export async function DELETE(request: Request, context: RouteContext) {
  try {
    const session = await getSessionAccount();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: raw } = await context.params;
    const key = decodeURIComponent(raw ?? '').trim();
    if (!key) {
      return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    }

    const roleRaw = new URL(request.url).searchParams.get('role');
    if (!isPageMediaPrimaryRole(roleRaw)) {
      return NextResponse.json(
        { error: "role must be 'logo' or 'cover'" },
        { status: 400 },
      );
    }
    const role: PageMediaPrimaryRole = roleRaw;

    const loaded = await loadOwnedPage(key, session.accountId);
    if (!loaded.ok) {
      return NextResponse.json({ error: loaded.error }, { status: loaded.status });
    }
    const { row, pagesDb } = loaded;

    const { error: delErr } = await pagesDb
      .from('page_media')
      .delete()
      .eq('page_id', row.id)
      .eq('role', role);

    if (delErr) {
      console.error('[directory/pages/media DELETE]', delErr);
      return NextResponse.json({ error: 'Failed to clear media' }, { status: 500 });
    }

    const pagePatch: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (role === 'logo') {
      // Only clear icon when it was an image URL (keep emoji marks).
      if (isPageLogoHttpUrl(row.icon)) {
        pagePatch.icon = null;
      }
    } else {
      pagePatch.cover_url = null;
    }

    const { error: pageErr } = await pagesDb
      .from('pages')
      .update(pagePatch)
      .eq('id', row.id);

    if (pageErr) {
      console.error('[directory/pages/media DELETE mirror]', pageErr);
    }

    return NextResponse.json(
      { ok: true, role, url: null },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (e) {
    console.error('[directory/pages/media DELETE]', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
