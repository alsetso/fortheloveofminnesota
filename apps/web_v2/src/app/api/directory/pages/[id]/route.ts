import { NextResponse } from 'next/server';
import type { DirectoryPageDetail } from '@/lib/directory/directoryPageTypes';
import { getSessionAccount } from '@/lib/auth/getSessionAccount';
import {
  asClaimStatus,
  asPageStatus,
  asVisibility,
  canViewPrivatePage,
  pageViewerAccess,
} from '@/lib/directory/pageAudience';
import {
  isLaunchPageType,
  isPageLogoHttpUrl,
  isUserGeneratedPageType,
  pageTypeName,
} from '@/lib/directory/pageTypes';
import { isPageCategoryParent } from '@/lib/directory/pageCategoryParents';
import { isUuid } from '@/lib/ai/subjectTypes';
import { createPageServiceClient } from '@/lib/supabase/pageDb';
import { createServiceRoleClient } from '@/lib/supabase/server';
import {
  clearPagePrimaryLocation,
  syncPagePrimaryLocation,
} from '@/lib/directory/syncPagePrimaryLocation';
import { isWithinMinnesota } from '@/map/location/device/minnesotaGate';

export const dynamic = 'force-dynamic';

type PageRow = {
  id: string;
  slug: string;
  title: string | null;
  icon: string | null;
  cover_url: string | null;
  page_type: string | null;
  description: string | null;
  address_line: string | null;
  website: string | null;
  phone: string | null;
  email: string | null;
  facebook_url: string | null;
  instagram_url: string | null;
  linkedin_url: string | null;
  youtube_url: string | null;
  main_stream_channel_url: string | null;
  hours: unknown;
  show_hours: boolean | null;
  category_id: string | null;
  city_id: string | null;
  county_id: string | null;
  unit_id: string | null;
  visibility: string | null;
  status: string | null;
  lat: number | null;
  lng: number | null;
  entity_id: string | null;
  is_verified: boolean | null;
  executive_pass: boolean | null;
  owner_id: string | null;
  claimed_by: string | null;
  claim_status: string | null;
  home_based: boolean | null;
};

type MediaRow = {
  page_id: string;
  url: string | null;
  role: string;
};

type RouteContext = { params: Promise<{ id: string }> };

function asHours(value: unknown): Record<string, string> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (typeof v === 'string' && v.trim()) out[k] = v.trim();
  }
  return Object.keys(out).length > 0 ? out : null;
}

/**
 * GET /api/directory/pages/[id]
 * `id` may be a page UUID or a public slug.
 * Public pages are visible to anyone. Drafts / unlisted only to creator or claimed owner.
 */
export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id: raw } = await context.params;
    const key = decodeURIComponent(raw ?? '').trim();
    if (!key) {
      return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    }

    const session = await getSessionAccount();
    const pagesDb = createPageServiceClient();
    const byId = isUuid(key);
    const { data, error } = await pagesDb
      .from('pages')
      .select(
        [
          'id',
          'slug',
          'title',
          'icon',
          'cover_url',
          'page_type',
          'description',
          'address_line',
          'website',
          'phone',
          'email',
          'facebook_url',
          'instagram_url',
          'linkedin_url',
          'youtube_url',
          'main_stream_channel_url',
          'hours',
          'show_hours',
          'category_id',
          'city_id',
          'county_id',
          'unit_id',
          'visibility',
          'status',
          'lat',
          'lng',
          'entity_id',
          'is_verified',
          'executive_pass',
          'owner_id',
          'claimed_by',
          'claim_status',
          'home_based',
        ].join(', '),
      )
      .eq(byId ? 'id' : 'slug', key)
      .maybeSingle();

    if (error) {
      console.error('[directory/pages/id]', error);
      return NextResponse.json({ error: 'Failed to load page' }, { status: 500 });
    }

    const row = data as PageRow | null;
    if (!row) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const viewer = pageViewerAccess(session?.accountId, row.owner_id, row.claimed_by);
    const visibility = asVisibility(row.visibility);
    const status = asPageStatus(row.status);
    const isPublicLive = visibility === 'public' && status === 'active';
    if (
      !isUserGeneratedPageType(row.page_type) ||
      row.entity_id != null ||
      (!isPublicLive && !canViewPrivatePage(viewer))
    ) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const placeDb = createServiceRoleClient('territory');
    const [mediaRes, categoryRes, cityRes, countyRes] = await Promise.all([
      pagesDb
        .from('page_media')
        .select('page_id, url, role')
        .eq('page_id', row.id)
        .in('role', ['logo', 'cover'])
        .not('url', 'is', null)
        .order('sort_order', { ascending: true }),
      row.category_id
        ? pagesDb.from('categories').select('name').eq('id', row.category_id).maybeSingle()
        : Promise.resolve({ data: null }),
      row.city_id ?? row.unit_id
        ? Promise.resolve(
            placeDb
              .from('cities_and_towns')
              .select('feature_name')
              .eq('id', row.city_id ?? row.unit_id)
              .maybeSingle()
          ).catch(() => ({ data: null }))
        : Promise.resolve({ data: null }),
      row.county_id
        ? Promise.resolve(
            placeDb
              .from('counties')
              .select('county_name')
              .eq('id', row.county_id)
              .maybeSingle()
          ).catch(() => ({ data: null }))
        : Promise.resolve({ data: null }),
    ]);

    let logoUrl: string | null = null;
    let coverUrl: string | null = null;
    for (const m of (mediaRes.data ?? []) as MediaRow[]) {
      const url = m.url?.trim();
      if (!url || !isPageLogoHttpUrl(url)) continue;
      if (m.role === 'logo' && !logoUrl) logoUrl = url;
      if (m.role === 'cover' && !coverUrl) coverUrl = url;
    }

    const icon = row.icon?.trim() || null;
    const iconHttp = isPageLogoHttpUrl(icon) ? icon : null;
    const coverDirect =
      typeof row.cover_url === 'string' && isPageLogoHttpUrl(row.cover_url)
        ? row.cover_url.trim()
        : null;

    const categoryName =
      typeof (categoryRes.data as { name?: string } | null)?.name === 'string'
        ? (categoryRes.data as { name: string }).name.trim() || null
        : null;
    const cityName =
      typeof (cityRes.data as { feature_name?: string } | null)?.feature_name === 'string'
        ? (cityRes.data as { feature_name: string }).feature_name.trim() || null
        : null;
    const countyName =
      typeof (countyRes.data as { county_name?: string } | null)?.county_name === 'string'
        ? (countyRes.data as { county_name: string }).county_name.trim() || null
        : null;

    const lat = Number.isFinite(row.lat) ? (row.lat as number) : null;
    const lng = Number.isFinite(row.lng) ? (row.lng as number) : null;

    const page: DirectoryPageDetail = {
      id: row.id,
      slug: row.slug,
      title: (row.title ?? '').trim() || 'Untitled',
      pageType: row.page_type,
      pageTypeLabel: pageTypeName(row.page_type),
      description: row.description?.trim() || null,
      addressLine: row.address_line?.trim() || null,
      logoUrl: logoUrl ?? iconHttp,
      icon,
      coverUrl: coverUrl ?? coverDirect,
      website: row.website?.trim() || null,
      phone: row.phone?.trim() || null,
      email: row.email?.trim() || null,
      lat,
      lng,
      categoryId: row.category_id,
      categoryName,
      cityName,
      countyName,
      facebookUrl: row.facebook_url?.trim() || null,
      instagramUrl: row.instagram_url?.trim() || null,
      linkedinUrl: row.linkedin_url?.trim() || null,
      youtubeUrl: row.youtube_url?.trim() || null,
      mainStreamUrl: row.main_stream_channel_url?.trim() || null,
      hours: asHours(row.hours),
      showHours: row.show_hours !== false,
      isVerified: row.is_verified === true,
      executivePass: row.executive_pass === true,
      claimStatus: asClaimStatus(row.claim_status),
      visibility,
      status,
      homeBased: row.home_based === true,
      viewer,
    };

    return NextResponse.json(
      { page },
      {
        headers: {
          'Cache-Control': 'private, no-store',
        },
      },
    );
  } catch (e) {
    console.error('[directory/pages/id]', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}


type PagePatchBody = {
  title?: string;
  description?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  instagramUrl?: string | null;
  facebookUrl?: string | null;
  addressLine?: string | null;
  lat?: number | null;
  lng?: number | null;
  homeBased?: boolean;
  clearLocation?: boolean;
  pageType?: string;
  categoryId?: string | null;
  status?: 'draft' | 'active';
  visibility?: 'public' | 'unlisted';
};

function optionalText(value: unknown, max: number): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

/**
 * PATCH /api/directory/pages/[id]
 * Primary listing fields — creator or claimed owner only.
 * `id` may be UUID or slug.
 */
export async function PATCH(request: Request, context: RouteContext) {
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

    const body = (await request.json()) as PagePatchBody;
    const pagesDb = createPageServiceClient();
    const byId = isUuid(key);

    const { data: existing, error: loadErr } = await pagesDb
      .from('pages')
      .select('id, owner_id, claimed_by, entity_id, page_type, status, visibility')
      .eq(byId ? 'id' : 'slug', key)
      .maybeSingle();

    if (loadErr) {
      console.error('[directory/pages/id PATCH load]', loadErr);
      return NextResponse.json({ error: 'Failed to load page' }, { status: 500 });
    }
    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const row = existing as {
      id: string;
      owner_id: string | null;
      claimed_by: string | null;
      entity_id: string | null;
      page_type: string | null;
      status: string | null;
      visibility: string | null;
    };

    if (row.entity_id != null || !isUserGeneratedPageType(row.page_type)) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const viewer = pageViewerAccess(session.accountId, row.owner_id, row.claimed_by);
    if (!canViewPrivatePage(viewer)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const patch: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (typeof body.title === 'string') {
      const title = body.title.trim().slice(0, 160);
      if (!title) {
        return NextResponse.json({ error: 'Title is required' }, { status: 400 });
      }
      patch.title = title;
    }

    const description = optionalText(body.description, 2000);
    if (description !== undefined) patch.description = description;
    const phone = optionalText(body.phone, 40);
    if (phone !== undefined) patch.phone = phone;
    const email = optionalText(body.email, 200);
    if (email !== undefined) patch.email = email;
    const website = optionalText(body.website, 500);
    if (website !== undefined) patch.website = website;
    const instagram = optionalText(body.instagramUrl, 300);
    if (instagram !== undefined) patch.instagram_url = instagram;
    const facebook = optionalText(body.facebookUrl, 300);
    if (facebook !== undefined) patch.facebook_url = facebook;

    let nextPageType = row.page_type;
    if (typeof body.pageType === 'string') {
      const next = body.pageType.trim();
      if (!isLaunchPageType(next) || !isUserGeneratedPageType(next)) {
        return NextResponse.json({ error: 'Invalid page type' }, { status: 400 });
      }
      nextPageType = next;
      patch.page_type = next;
      // Changing type clears subtype unless a new categoryId is provided.
      if (body.categoryId === undefined) {
        patch.category_id = null;
      }
    }

    if (body.categoryId !== undefined) {
      if (body.categoryId === null || body.categoryId === '') {
        patch.category_id = null;
      } else if (typeof body.categoryId === 'string' && isUuid(body.categoryId)) {
        if (!nextPageType || !isPageCategoryParent(nextPageType)) {
          return NextResponse.json(
            { error: 'This page type does not support subtypes' },
            { status: 400 },
          );
        }
        const { data: parent } = await pagesDb
          .from('categories')
          .select('id')
          .eq('slug', nextPageType)
          .maybeSingle();
        if (!parent) {
          return NextResponse.json({ error: 'Category parent missing' }, { status: 400 });
        }
        const { data: child } = await pagesDb
          .from('categories')
          .select('id')
          .eq('id', body.categoryId)
          .eq('parent_id', (parent as { id: string }).id)
          .maybeSingle();
        if (!child) {
          return NextResponse.json(
            { error: 'Category does not match page type' },
            { status: 400 },
          );
        }
        patch.category_id = body.categoryId;
      } else {
        return NextResponse.json({ error: 'Invalid category' }, { status: 400 });
      }
    }

    let nextStatus = asPageStatus(row.status);
    if (body.status === 'draft' || body.status === 'active') {
      nextStatus = body.status;
      patch.status = body.status;
    }
    if (body.visibility === 'public' || body.visibility === 'unlisted') {
      patch.visibility = body.visibility;
    }
    // Drafts stay off the public directory.
    if (nextStatus === 'draft') {
      patch.visibility = 'unlisted';
    } else if (body.status === 'active' && body.visibility === undefined) {
      // Publishing without an explicit visibility → public.
      if (asPageStatus(row.status) === 'draft') {
        patch.visibility = 'public';
      }
    }

    const wantsClearLocation = body.clearLocation === true;
    const hasLat = typeof body.lat === 'number' && Number.isFinite(body.lat);
    const hasLng = typeof body.lng === 'number' && Number.isFinite(body.lng);
    const wantsSetLocation = hasLat && hasLng;

    if (wantsClearLocation && wantsSetLocation) {
      return NextResponse.json(
        { error: 'Cannot set and clear location in one request' },
        { status: 400 },
      );
    }

    if (wantsSetLocation) {
      const lat = body.lat as number;
      const lng = body.lng as number;
      if (!isWithinMinnesota({ lat, lng })) {
        return NextResponse.json(
          { error: 'Location must be in Minnesota' },
          { status: 400 },
        );
      }
    }

    const keys = Object.keys(patch).filter((k) => k !== 'updated_at');
    if (keys.length === 0 && !wantsClearLocation && !wantsSetLocation) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    if (keys.length > 0) {
      const { error: updateErr } = await pagesDb
        .from('pages')
        .update(patch)
        .eq('id', row.id);

      if (updateErr) {
        console.error('[directory/pages/id PATCH]', updateErr);
        return NextResponse.json(
          { error: updateErr.message ?? 'Failed to update' },
          { status: 500 },
        );
      }
    }

    if (wantsClearLocation) {
      try {
        await clearPagePrimaryLocation(row.id);
      } catch (e) {
        console.error('[directory/pages/id PATCH clearLocation]', e);
        return NextResponse.json(
          { error: e instanceof Error ? e.message : 'Failed to clear location' },
          { status: 500 },
        );
      }
    } else if (wantsSetLocation) {
      try {
        await syncPagePrimaryLocation(row.id, {
          lat: body.lat as number,
          lng: body.lng as number,
          addressLine: optionalText(body.addressLine, 300) ?? null,
          homeBased: body.homeBased === true,
        });
      } catch (e) {
        console.error('[directory/pages/id PATCH location]', e);
        return NextResponse.json(
          { error: e instanceof Error ? e.message : 'Failed to save location' },
          { status: 500 },
        );
      }
    }

    const { data: updated, error: slugErr } = await pagesDb
      .from('pages')
      .select('id, slug')
      .eq('id', row.id)
      .maybeSingle();

    if (slugErr || !updated) {
      console.error('[directory/pages/id PATCH reload]', slugErr);
      return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
    }

    const out = updated as { id: string; slug: string };
    return NextResponse.json(
      { ok: true, id: out.id, slug: out.slug },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (e) {
    console.error('[directory/pages/id PATCH]', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/directory/pages/[id]
 * Soft-hard delete: removes the page row (cascades locations / media / members).
 * Body: { confirmTitle: string } must match the page title (trimmed).
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

    const body = (await request.json().catch(() => null)) as {
      confirmTitle?: unknown;
    } | null;
    const confirmTitle =
      typeof body?.confirmTitle === 'string' ? body.confirmTitle.trim() : '';
    if (!confirmTitle) {
      return NextResponse.json(
        { error: 'Type the page name to confirm delete' },
        { status: 400 },
      );
    }

    const pagesDb = createPageServiceClient();
    const byId = isUuid(key);
    const { data: existing, error: loadErr } = await pagesDb
      .from('pages')
      .select('id, title, owner_id, claimed_by, entity_id, page_type')
      .eq(byId ? 'id' : 'slug', key)
      .maybeSingle();

    if (loadErr) {
      console.error('[directory/pages/id DELETE load]', loadErr);
      return NextResponse.json({ error: 'Failed to load page' }, { status: 500 });
    }
    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const row = existing as {
      id: string;
      title: string | null;
      owner_id: string | null;
      claimed_by: string | null;
      entity_id: string | null;
      page_type: string | null;
    };

    if (row.entity_id != null || !isUserGeneratedPageType(row.page_type)) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const viewer = pageViewerAccess(session.accountId, row.owner_id, row.claimed_by);
    if (!canViewPrivatePage(viewer)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const title = (row.title ?? '').trim();
    if (!title || confirmTitle !== title) {
      return NextResponse.json(
        { error: 'Name does not match — type the exact page title to delete' },
        { status: 400 },
      );
    }

    const { error: delErr } = await pagesDb.from('pages').delete().eq('id', row.id);
    if (delErr) {
      console.error('[directory/pages/id DELETE]', delErr);
      return NextResponse.json(
        { error: delErr.message ?? 'Failed to delete' },
        { status: 500 },
      );
    }

    return NextResponse.json(
      { ok: true },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (e) {
    console.error('[directory/pages/id DELETE]', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
