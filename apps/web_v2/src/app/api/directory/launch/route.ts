import { NextRequest, NextResponse } from 'next/server';
import { getSessionAccount } from '@/lib/auth/getSessionAccount';
import { isLaunchPageType, type LaunchPageTypeSlug } from '@/lib/directory/pageTypes';
import { createPageServiceClient } from '@/lib/supabase/pageDb';
import { createServiceRoleClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type LaunchBody = {
  title?: unknown;
  description?: unknown;
  phone?: unknown;
  email?: unknown;
  website?: unknown;
  instagram?: unknown;
  page_type?: unknown;
  category_id?: unknown;
  home_based?: unknown;
  status?: unknown;
  self_claim?: unknown;
  location_mode?: unknown;
  address?: unknown;
  lat?: unknown;
  lng?: unknown;
};

function trimOrNull(value: unknown, max = 500): string | null {
  if (typeof value !== 'string') return null;
  const next = value.trim().slice(0, max);
  return next.length > 0 ? next : null;
}

function parseCoord(value: unknown): number | null {
  if (value == null || value === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function toSlug(title: string): string {
  return (
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 100) || 'page'
  );
}

async function uniqueSlug(
  pagesDb: ReturnType<typeof createPageServiceClient>,
  base: string,
): Promise<string> {
  const { data: existing } = await pagesDb
    .from('pages')
    .select('id')
    .eq('slug', base)
    .maybeSingle();
  if (!existing) return base;

  for (let i = 2; i <= 50; i += 1) {
    const candidate = `${base.slice(0, 90)}-${i}`;
    const { data: row } = await pagesDb
      .from('pages')
      .select('id')
      .eq('slug', candidate)
      .maybeSingle();
    if (!row) return candidate;
  }
  return `${base.slice(0, 80)}-${Date.now()}`;
}

/**
 * POST /api/directory/launch
 *
 * Create a user-generated directory page from the map dock.
 *
 * Always sets `owner_id` to the signed-in account (creator).
 * `self_claim: true` also sets `claimed_by` + `claim_status = approved`
 * and inserts an approved `page_members` owner row.
 * Unchecked → `claim_status = unclaimed` (publish without claiming).
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSessionAccount();
    if (!session) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = (await request.json().catch(() => null)) as LaunchBody | null;
    if (!body) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const title = trimOrNull(body.title, 200);
    if (!title) {
      return NextResponse.json({ error: 'Page name is required' }, { status: 400 });
    }

    const pageTypeRaw = typeof body.page_type === 'string' ? body.page_type.trim() : '';
    if (!isLaunchPageType(pageTypeRaw)) {
      return NextResponse.json({ error: 'Choose a page type' }, { status: 400 });
    }
    const pageType: LaunchPageTypeSlug = pageTypeRaw;

    const categoryId =
      typeof body.category_id === 'string' && UUID_RE.test(body.category_id.trim())
        ? body.category_id.trim()
        : null;
    if (!categoryId) {
      return NextResponse.json({ error: 'Choose a category' }, { status: 400 });
    }

    const locationMode =
      body.location_mode === 'building' ||
      body.location_mode === 'city' ||
      body.location_mode === 'skip'
        ? body.location_mode
        : null;
    if (!locationMode) {
      return NextResponse.json({ error: 'Choose a location' }, { status: 400 });
    }

    const lat = parseCoord(body.lat);
    const lng = parseCoord(body.lng);
    if (locationMode === 'building' && (lat == null || lng == null)) {
      return NextResponse.json(
        { error: 'Drop a pin on the map before publishing.' },
        { status: 400 },
      );
    }

    const isDraft = body.status === 'draft';
    const selfClaim = body.self_claim === true;
    const homeBased = pageType === 'local-business' && body.home_based === true;
    const address = locationMode === 'building' ? trimOrNull(body.address, 300) : null;

    const pagesDb = createPageServiceClient();
    const slug = await uniqueSlug(pagesDb, toSlug(title));
    const pinLat = locationMode === 'building' ? lat : null;
    const pinLng = locationMode === 'building' ? lng : null;
    const home = pinLat != null && pinLng != null
      ? await resolveHomeTerritory(pinLng, pinLat)
      : { unitId: null, cityId: null, countyId: null };

    const insert = {
      title,
      description: trimOrNull(body.description, 2000),
      slug,
      visibility: isDraft ? 'unlisted' : 'public',
      status: isDraft ? 'draft' : 'active',
      page_type: pageType,
      category_id: categoryId,
      owner_id: session.accountId,
      claimed_by: selfClaim ? session.accountId : null,
      claim_status: selfClaim ? 'approved' : 'unclaimed',
      home_based: homeBased,
      address_line: address,
      lat: pinLat,
      lng: pinLng,
      unit_id: home.unitId,
      city_id: home.cityId,
      county_id: home.countyId,
      phone: trimOrNull(body.phone, 40),
      email: trimOrNull(body.email, 200),
      website: trimOrNull(body.website, 500),
      instagram_url: trimOrNull(body.instagram, 300),
    };

    const { data: newPage, error: pageErr } = await pagesDb
      .from('pages')
      .insert(insert)
      .select('id, slug')
      .single();

    if (pageErr || !newPage) {
      console.error('[directory/launch]', pageErr);
      return NextResponse.json(
        { error: pageErr?.message ?? 'Failed to create page' },
        { status: 500 },
      );
    }

    if (pinLat != null && pinLng != null) {
      const { error: locErr } = await pagesDb.from('locations').insert({
        page_id: newPage.id,
        address_line: address,
        lat: pinLat,
        lng: pinLng,
        home_based: homeBased,
        is_primary: true,
        sort_order: 0,
        city_id: home.cityId,
        county_id: home.countyId,
        unit_id: home.unitId,
      });
      if (locErr) {
        console.error('[directory/launch] locations', locErr);
      }
    }

    if (selfClaim) {
      const { error: memberErr } = await pagesDb.from('page_members').insert({
        page_id: newPage.id,
        account_id: session.accountId,
        role: 'owner',
        status: 'approved',
      });
      if (memberErr) {
        console.error('[directory/launch] page_members', memberErr);
      }
    }

    const publicDb = createServiceRoleClient();
    const { error: ownsErr } = await publicDb
      .from('accounts')
      .update({ owns_business: true })
      .eq('id', session.accountId);
    if (ownsErr && process.env.NODE_ENV === 'development') {
      console.warn('[directory/launch] owns_business', ownsErr);
    }

    return NextResponse.json(
      {
        id: newPage.id,
        slug: newPage.slug,
        claimed: selfClaim,
        status: isDraft ? 'draft' : 'active',
      },
      { status: 201 },
    );
  } catch (e) {
    console.error('[directory/launch]', e);
    return NextResponse.json({ error: 'Failed to create page' }, { status: 500 });
  }
}

type HomeTerritory = {
  unitId: string | null;
  cityId: string | null;
  countyId: string | null;
};

function asUuid(value: unknown): string | null {
  if (typeof value !== 'string' || !UUID_RE.test(value)) return null;
  return value;
}

function boundaryId(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null;
  return asUuid((value as { id?: unknown }).id);
}

async function resolveHomeTerritory(lng: number, lat: number): Promise<HomeTerritory> {
  try {
    const { data, error } = await createServiceRoleClient().rpc('get_boundaries_for_point', {
      point_lng: lng,
      point_lat: lat,
    });
    if (error || !data || typeof data !== 'object') {
      return { unitId: null, cityId: null, countyId: null };
    }
    const cityId = boundaryId((data as { ctu?: unknown }).ctu);
    const countyId = boundaryId((data as { county?: unknown }).county);
    return { unitId: cityId ?? countyId, cityId, countyId };
  } catch {
    return { unitId: null, cityId: null, countyId: null };
  }
}
