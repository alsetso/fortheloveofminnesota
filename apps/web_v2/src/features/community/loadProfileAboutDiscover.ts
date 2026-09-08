/**
 * Server-side load of About-tab Discover identity (interests / places / schools).
 * Used by GET /api/community/profile.
 */

import {
  ACCOUNT_PLACE_KINDS,
  type AccountPlaceKind,
} from '@/lib/accountPlaces/types';
import {
  ACCOUNT_SCHOOL_KINDS,
  type AccountSchoolKind,
} from '@/lib/accountSchools/types';
import type {
  ProfileAboutDiscover,
  ProfileAboutInterest,
  ProfileAboutPlace,
  ProfileAboutSchool,
} from '@/features/community/profileAboutDiscover';

export type {
  ProfileAboutDiscover,
  ProfileAboutInterest,
  ProfileAboutPlace,
  ProfileAboutSchool,
} from '@/features/community/profileAboutDiscover';

/** Minimal query surface — avoids SupabaseClient schema-generic friction. */
type DbClient = {
  from: (table: string) => any;
  schema: (schema: string) => { from: (table: string) => any };
  rpc: (fn: string, args?: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }>;
};

function isPlaceKind(value: string): value is AccountPlaceKind {
  return (ACCOUNT_PLACE_KINDS as readonly string[]).includes(value);
}

function isSchoolKind(value: string): value is AccountSchoolKind {
  return (ACCOUNT_SCHOOL_KINDS as readonly string[]).includes(value);
}

type UnitLabel = { name: string; kind: string };

async function loadUnitLabels(
  supabase: DbClient,
  ids: string[],
): Promise<Map<string, UnitLabel>> {
  const unique = [...new Set(ids.filter(Boolean))];
  const next = new Map<string, UnitLabel>();
  if (unique.length === 0) return next;

  const { data, error } = await supabase.rpc('territory_unit_labels', { p_ids: unique });
  if (!error && data) {
    for (const row of data as Array<{ id?: unknown; name?: unknown; kind?: unknown }>) {
      if (typeof row.id !== 'string' || typeof row.name !== 'string') continue;
      next.set(row.id, {
        name: row.name,
        kind: typeof row.kind === 'string' ? row.kind : 'ctu',
      });
    }
    if (next.size > 0) return next;
  }

  const { data: units } = await supabase
    .schema('territory')
    .from('units')
    .select('id, kind, name')
    .in('id', unique);
  for (const unit of (units ?? []) as Array<{ id?: unknown; name?: unknown; kind?: unknown }>) {
    next.set(String(unit.id), {
      name: String(unit.name ?? ''),
      kind: String(unit.kind ?? 'ctu'),
    });
  }
  return next;
}

async function loadSchoolMeta(
  supabase: DbClient,
  schoolIds: string[],
): Promise<
  Map<
    string,
    {
      name: string;
      school_type: string | null;
      district_name: string | null;
      page_slug: string | null;
      lat: number | null;
      lng: number | null;
    }
  >
> {
  const unique = [...new Set(schoolIds.filter(Boolean))];
  const next = new Map<
    string,
    {
      name: string;
      school_type: string | null;
      district_name: string | null;
      page_slug: string | null;
      lat: number | null;
      lng: number | null;
    }
  >();
  if (unique.length === 0) return next;

  const { data: schools } = await supabase
    .schema('territory')
    .from('schools')
    .select('id, name, school_type, school_district_id, lat, lng, page_id')
    .in('id', unique);

  const schoolRows = (schools ?? []) as Array<{
    id: unknown;
    name: unknown;
    school_type: unknown;
    school_district_id: unknown;
    lat: unknown;
    lng: unknown;
    page_id: unknown;
  }>;

  const districtIds = [
    ...new Set(
      schoolRows
        .map((s) => (s.school_district_id ? String(s.school_district_id) : null))
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const districtNameById = new Map<string, string>();
  if (districtIds.length > 0) {
    const { data: districts } = await supabase
      .schema('territory')
      .from('school_districts')
      .select('id, name')
      .in('id', districtIds);
    for (const d of (districts ?? []) as Array<{ id?: unknown; name?: unknown }>) {
      if (d?.id && d?.name) districtNameById.set(String(d.id), String(d.name));
    }
  }

  const pageIds = [
    ...new Set(
      schoolRows
        .map((s) => (s.page_id ? String(s.page_id) : null))
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const slugByPageId = new Map<string, string>();
  if (pageIds.length > 0) {
    const { data: pages } = await supabase
      .schema('page')
      .from('pages')
      .select('id, slug')
      .in('id', pageIds);
    for (const page of (pages ?? []) as Array<{ id?: unknown; slug?: unknown }>) {
      if (page?.id && page?.slug) slugByPageId.set(String(page.id), String(page.slug));
    }
  }

  for (const row of schoolRows) {
    next.set(String(row.id), {
      name: String(row.name ?? 'School'),
      school_type: row.school_type ? String(row.school_type) : null,
      district_name: row.school_district_id
        ? districtNameById.get(String(row.school_district_id)) ?? null
        : null,
      page_slug: row.page_id ? slugByPageId.get(String(row.page_id)) ?? null : null,
      lat: typeof row.lat === 'number' && Number.isFinite(row.lat) ? row.lat : null,
      lng: typeof row.lng === 'number' && Number.isFinite(row.lng) ? row.lng : null,
    });
  }
  return next;
}

/**
 * Catalog interests the account follows (custom/Yours omitted — private).
 * Places/schools: all for self; `is_public` only for other viewers.
 */
export async function loadProfileAboutDiscover(
  supabase: DbClient,
  service: DbClient,
  accountId: string,
  isSelf: boolean,
): Promise<ProfileAboutDiscover> {
  const interestsClient = isSelf ? supabase : service;

  const [interestsRes, placesRes, schoolsRes] = await Promise.all([
    interestsClient
      .from('account_interests')
      .select('interest_id')
      .eq('account_id', accountId),
    (() => {
      let q = supabase
        .from('account_places')
        .select(
          'territory_unit_id, kind, notify, is_home, is_public, created_at',
        )
        .eq('account_id', accountId)
        .in('kind', [...ACCOUNT_PLACE_KINDS])
        .order('is_home', { ascending: false })
        .order('created_at', { ascending: true });
      if (!isSelf) q = q.eq('is_public', true);
      return q;
    })(),
    (() => {
      let q = supabase
        .from('account_schools')
        .select('school_id, kind, notify, is_public, created_at')
        .eq('account_id', accountId)
        .in('kind', [...ACCOUNT_SCHOOL_KINDS])
        .order('created_at', { ascending: true });
      if (!isSelf) q = q.eq('is_public', true);
      return q;
    })(),
  ]);

  const interestIds = (
    (interestsRes.data ?? []) as Array<{ interest_id?: unknown }>
  )
    .map((row) => String(row.interest_id ?? ''))
    .filter(Boolean);

  let interests: ProfileAboutInterest[] = [];
  if (interestIds.length > 0) {
    const { data: catalog } = await interestsClient
      .from('interests')
      .select('id, name, owner_account_id, retired_at, sort_order, section')
      .in('id', interestIds)
      .is('retired_at', null)
      .is('owner_account_id', null)
      .neq('section', 'civic')
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true });
    interests = ((catalog ?? []) as Array<{ id?: unknown; name?: unknown }>).map(
      (row) => ({
        id: String(row.id),
        name: String(row.name),
      }),
    );
  }

  const placeRows = (placesRes.data ?? []) as Array<{
    territory_unit_id: string | null;
    kind: string;
    notify: boolean;
    is_home: boolean;
  }>;
  const unitIds = placeRows
    .map((r) => r.territory_unit_id)
    .filter((id): id is string => Boolean(id));
  const labels = await loadUnitLabels(supabase, unitIds);

  const placeMap = new Map<string, ProfileAboutPlace>();
  for (const row of placeRows) {
    const unitId = row.territory_unit_id;
    if (!unitId || !isPlaceKind(row.kind)) continue;
    const label = labels.get(unitId);
    if (label && label.kind !== 'ctu') continue;
    const existing = placeMap.get(unitId);
    if (existing) {
      if (!existing.kinds.includes(row.kind)) existing.kinds.push(row.kind);
      existing.notify = existing.notify || Boolean(row.notify);
      existing.is_home = existing.is_home || Boolean(row.is_home);
      continue;
    }
    placeMap.set(unitId, {
      unit_id: unitId,
      name: label?.name?.trim() || 'City',
      kinds: [row.kind],
      is_home: Boolean(row.is_home),
      notify: Boolean(row.notify),
    });
  }
  const places = [...placeMap.values()].sort((a, b) => {
    if (a.is_home !== b.is_home) return a.is_home ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  const schoolRows = (schoolsRes.data ?? []) as Array<{
    school_id: string;
    kind: string;
    notify: boolean;
  }>;
  const schoolMeta = await loadSchoolMeta(
    supabase,
    schoolRows.map((r) => r.school_id),
  );
  const schoolMap = new Map<string, ProfileAboutSchool>();
  for (const row of schoolRows) {
    if (!isSchoolKind(row.kind)) continue;
    const meta = schoolMeta.get(row.school_id);
    const existing = schoolMap.get(row.school_id);
    if (existing) {
      if (!existing.kinds.includes(row.kind)) existing.kinds.push(row.kind);
      existing.notify = existing.notify || Boolean(row.notify);
      continue;
    }
    schoolMap.set(row.school_id, {
      school_id: row.school_id,
      name: meta?.name?.trim() || 'School',
      kinds: [row.kind],
      notify: Boolean(row.notify),
      school_type: meta?.school_type ?? null,
      district_name: meta?.district_name ?? null,
      page_slug: meta?.page_slug ?? null,
      lat: meta?.lat ?? null,
      lng: meta?.lng ?? null,
    });
  }
  const schools = [...schoolMap.values()].sort((a, b) => a.name.localeCompare(b.name));

  return { interests, places, schools };
}
