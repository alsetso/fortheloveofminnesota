import { createPageServiceClient } from '@/lib/supabase/pageDb';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { isUuid } from '@/lib/ai/subjectTypes';

export type PrimaryLocationInput = {
  lat: number;
  lng: number;
  addressLine: string | null;
  homeBased?: boolean;
};

type HomeTerritory = {
  unitId: string | null;
  cityId: string | null;
  countyId: string | null;
};

function boundaryId(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null;
  const id = (value as { id?: unknown }).id;
  return typeof id === 'string' && isUuid(id) ? id : null;
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

/**
 * Write the default pin onto `pages.*` and upsert `page.locations` (is_primary).
 */
export async function syncPagePrimaryLocation(
  pageId: string,
  input: PrimaryLocationInput,
): Promise<void> {
  const pagesDb = createPageServiceClient();
  const home = await resolveHomeTerritory(input.lng, input.lat);
  const homeBased = input.homeBased === true;
  const now = new Date().toISOString();

  const { error: pageErr } = await pagesDb
    .from('pages')
    .update({
      lat: input.lat,
      lng: input.lng,
      address_line: input.addressLine,
      home_based: homeBased,
      city_id: home.cityId,
      county_id: home.countyId,
      unit_id: home.unitId,
      updated_at: now,
    })
    .eq('id', pageId);

  if (pageErr) {
    throw new Error(pageErr.message || 'Failed to update page location');
  }

  const { data: existing, error: findErr } = await pagesDb
    .from('locations')
    .select('id')
    .eq('page_id', pageId)
    .eq('is_primary', true)
    .maybeSingle();

  if (findErr) {
    throw new Error(findErr.message || 'Failed to load primary location');
  }

  const locRow = {
    page_id: pageId,
    address_line: input.addressLine,
    lat: input.lat,
    lng: input.lng,
    home_based: homeBased,
    is_primary: true,
    sort_order: 0,
    city_id: home.cityId,
    county_id: home.countyId,
    unit_id: home.unitId,
    updated_at: now,
  };

  if (existing?.id) {
    const { error } = await pagesDb
      .from('locations')
      .update(locRow)
      .eq('id', existing.id);
    if (error) throw new Error(error.message || 'Failed to update primary location');
  } else {
    const { error } = await pagesDb.from('locations').insert(locRow);
    if (error) throw new Error(error.message || 'Failed to create primary location');
  }
}

/** Clear pages pin fields and delete the primary locations row. */
export async function clearPagePrimaryLocation(pageId: string): Promise<void> {
  const pagesDb = createPageServiceClient();
  const now = new Date().toISOString();

  const { error: pageErr } = await pagesDb
    .from('pages')
    .update({
      lat: null,
      lng: null,
      address_line: null,
      city_id: null,
      county_id: null,
      unit_id: null,
      updated_at: now,
    })
    .eq('id', pageId);

  if (pageErr) {
    throw new Error(pageErr.message || 'Failed to clear page location');
  }

  const { error: delErr } = await pagesDb
    .from('locations')
    .delete()
    .eq('page_id', pageId)
    .eq('is_primary', true);

  if (delErr) {
    throw new Error(delErr.message || 'Failed to clear primary location');
  }
}
