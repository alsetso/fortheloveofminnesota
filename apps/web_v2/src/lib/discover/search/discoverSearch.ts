import { getSessionAccount } from '@/lib/auth/getSessionAccount';
import { searchMinnesotaForward } from '@/lib/geo/minnesotaMapbox';
import { createServiceRoleClient, createSupabaseServerClient } from '@/lib/supabase/server';
import { createTerritoryServerClient } from '@/lib/supabase/territoryDb';
import { createPageServiceClient } from '@/lib/supabase/pageDb';
import { createAtlasServerClient } from '@/lib/supabase/atlasDb';
import { pageTypeName } from '@/lib/directory/pageTypes';
import { atlasFeatureLabel } from '@/lib/atlas/types';
import {
  TERRITORY_LAYERS,
  rowKindLabel,
  rowLabel,
  rowSubtitle,
} from '@/features/map/territory/territoryLayers';
import { MAP_CONFIG } from '@/map/config';
import { ACCOUNT_SEARCH_VISIBILITY_FILTER } from '@/lib/account/accountSearchVisibility';
import {
  DISCOVER_SEARCH_SECTION_LABELS,
  DISCOVER_SEARCH_SECTION_ORDER,
  type DiscoverSearchCompletedVia,
  type DiscoverSearchHit,
  type DiscoverSearchKind,
  type DiscoverSearchPersistInput,
  type DiscoverSearchRecentRow,
  type DiscoverSearchResponse,
  type DiscoverSearchSection,
} from '@/lib/discover/search/types';
import { directoryTerritoryPath } from '@/lib/routes/routePolicy';

const RECENT_FETCH_LIMIT = 40;
const RECENT_DISPLAY_LIMIT = 12;

const LIMITS = {
  page: 6,
  territoryPerLayer: 3,
  territoryMax: 12,
  atlasFeature: 8,
  atlasCollection: 4,
  place: 5,
  experienceZone: 6,
  post: 8,
  account: 5,
} as const;

function escapeIlike(s: string): string {
  return s.replaceAll('\\', '\\\\').replaceAll('%', '\\%').replaceAll('_', '\\_');
}

function looksLikeEmail(q: string): boolean {
  return q.includes('@');
}

function buildSections(
  hitsByKind: Partial<Record<DiscoverSearchKind, DiscoverSearchHit[]>>,
): DiscoverSearchSection[] {
  const sections: DiscoverSearchSection[] = [];
  for (const kind of DISCOVER_SEARCH_SECTION_ORDER) {
    const hits = hitsByKind[kind];
    if (!hits?.length) continue;
    sections.push({
      kind,
      label: DISCOVER_SEARCH_SECTION_LABELS[kind],
      hits,
    });
  }
  return sections;
}

async function searchPages(q: string): Promise<DiscoverSearchHit[]> {
  const pattern = `%${escapeIlike(q)}%`;
  const db = createPageServiceClient();
  const { data, error } = await db
    .from('pages')
    .select('id, slug, title, page_type, address_line, description')
    .eq('visibility', 'public')
    .eq('status', 'active')
    .or(
      `title.ilike.${pattern},description.ilike.${pattern},address_line.ilike.${pattern},slug.ilike.${pattern}`,
    )
    .order('title', { ascending: true })
    .limit(LIMITS.page);

  if (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('[discover search pages]', error);
    }
    return [];
  }

  return (data ?? []).map((row) => {
    const slug = String(row.slug ?? '').trim();
    const pageType = pageTypeName(row.page_type as string | null);
    const address = (row.address_line as string | null)?.trim() || null;
    return {
      kind: 'page' as const,
      id: String(row.id),
      title: String(row.title ?? slug ?? 'Page'),
      subtitle: address ?? pageType,
      kindLabel: pageType ?? 'Page',
      href: slug ? `/page/${encodeURIComponent(slug)}` : null,
      meta: { slug: slug || undefined },
    };
  });
}

async function searchTerritories(q: string): Promise<DiscoverSearchHit[]> {
  const pattern = `%${escapeIlike(q)}%`;
  const db = createTerritoryServerClient();

  const layerResults = await Promise.all(
    TERRITORY_LAYERS.map(async (config) => {
      const { data, error } = await db
        .from(config.table)
        .select(config.selectColumns)
        .ilike(config.nameColumn, pattern)
        .order(config.nameColumn, { ascending: true })
        .limit(LIMITS.territoryPerLayer);

      if (error) {
        if (process.env.NODE_ENV === 'development') {
          console.error(`[discover search territory ${config.slug}]`, error);
        }
        return [] as DiscoverSearchHit[];
      }

      return (data ?? []).map((row) => {
        const rec = row as unknown as Record<string, unknown>;
        const kindLabel = rowKindLabel(config, rec) ?? config.label;
        return {
          kind: 'territory' as const,
          id: String(rec.id),
          title: rowLabel(config, rec),
          subtitle: rowSubtitle(config, rec) ?? null,
          kindLabel,
          href: directoryTerritoryPath(String(rec.id)),
          meta: { slug: config.slug },
        };
      });
    }),
  );

  return layerResults.flat().slice(0, LIMITS.territoryMax);
}

async function searchAtlasFeatures(q: string): Promise<DiscoverSearchHit[]> {
  const pattern = `%${escapeIlike(q)}%`;
  const db = createAtlasServerClient();

  const { data, error } = await db
    .from('features')
    .select(
      'id, name, slug, display_name, blurb, lat, lng, collection_id, collections!inner(slug, name, is_published)',
    )
    .eq('is_published', true)
    .eq('collections.is_published', true)
    .or(`name.ilike.${pattern},display_name.ilike.${pattern},blurb.ilike.${pattern}`)
    .order('featured', { ascending: false })
    .order('name', { ascending: true })
    .limit(LIMITS.atlasFeature);

  if (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('[discover search atlas features]', error);
    }
    return [];
  }

  return (data ?? []).map((row) => {
    const collection = row.collections as { slug?: string; name?: string } | null;
    const collectionSlug = collection?.slug?.trim() ?? '';
    const collectionName = collection?.name?.trim() ?? 'Atlas';
    const label = atlasFeatureLabel({
      name: String(row.name ?? ''),
      displayName: row.display_name as string | null,
    });
    const blurb = (row.blurb as string | null)?.trim();
    return {
      kind: 'atlas_feature' as const,
      id: String(row.id),
      title: label,
      subtitle: blurb ? `${collectionName} · ${blurb}` : collectionName,
      kindLabel: 'Atlas',
      href: collectionSlug
        ? `/discover/atlas/${encodeURIComponent(collectionSlug)}`
        : '/discover/atlas',
      meta: {
        collectionSlug: collectionSlug || undefined,
        slug: String(row.slug ?? ''),
        lat: typeof row.lat === 'number' ? row.lat : undefined,
        lng: typeof row.lng === 'number' ? row.lng : undefined,
      },
    };
  });
}

async function searchAtlasCollections(q: string): Promise<DiscoverSearchHit[]> {
  const pattern = `%${escapeIlike(q)}%`;
  const db = createAtlasServerClient();

  const { data, error } = await db
    .from('collections')
    .select('id, slug, name, description, filter_kind')
    .eq('is_published', true)
    .or(`name.ilike.${pattern},description.ilike.${pattern}`)
    .order('sort_order', { ascending: true })
    .limit(LIMITS.atlasCollection);

  if (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('[discover search atlas collections]', error);
    }
    return [];
  }

  return (data ?? []).map((row) => {
    const slug = String(row.slug ?? '').trim();
    const description = (row.description as string | null)?.trim();
    return {
      kind: 'atlas_collection' as const,
      id: String(row.id),
      title: String(row.name ?? slug),
      subtitle: description ?? 'Feature set',
      kindLabel: 'Atlas set',
      href: slug ? `/discover/atlas/${encodeURIComponent(slug)}` : '/discover/atlas',
      meta: { slug },
    };
  });
}

async function searchPlaces(q: string): Promise<DiscoverSearchHit[]> {
  if (!MAP_CONFIG.MAPBOX_TOKEN) return [];
  const hits = await searchMinnesotaForward(q, LIMITS.place);
  return hits.map((h) => ({
    kind: 'place' as const,
    id: h.id,
    title: h.name.split(',')[0]?.trim() || h.name,
    subtitle: h.name.includes(',') ? h.name.split(',').slice(1).join(',').trim() : 'Minnesota',
    kindLabel: 'Address',
    href: null,
    meta: { lat: h.lat, lng: h.lng },
  }));
}

async function searchExperienceZones(q: string): Promise<DiscoverSearchHit[]> {
  const pattern = `%${escapeIlike(q)}%`;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .schema('world')
    .from('experience_zones')
    .select('id, slug, name, description, parent_zone_id')
    .eq('status', 'active')
    .eq('featured', true)
    .is('parent_zone_id', null)
    .or(`name.ilike.${pattern},description.ilike.${pattern}`)
    .order('name', { ascending: true })
    .limit(LIMITS.experienceZone);

  if (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('[discover search experience zones]', error);
    }
    return [];
  }

  return (data ?? []).map((row) => {
    const description = (row.description as string | null)?.trim();
    return {
      kind: 'experience_zone' as const,
      id: String(row.id),
      title: String(row.name ?? 'Experience zone'),
      subtitle: description ?? 'Experience zone',
      kindLabel: 'Zone',
      href: `/discover/zone/${encodeURIComponent(String(row.id))}`,
      meta: { slug: String(row.slug ?? '') },
    };
  });
}

async function searchPosts(q: string): Promise<DiscoverSearchHit[]> {
  const escaped = q.replace(/[%_,]/g, '');
  if (escaped.length < 2) return [];

  const supabase = await createSupabaseServerClient();
  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .schema('community')
    .from('posts')
    .select('id, body, city_name, zip_code, full_address, created_at')
    .eq('kind', 'post')
    .eq('visibility', 'public')
    .eq('is_active', true)
    .eq('archived', false)
    .or(`expires_at.is.null,expires_at.gt."${nowIso}"`)
    .or(`body.ilike.%${escaped}%,full_address.ilike.%${escaped}%`)
    .order('created_at', { ascending: false })
    .limit(LIMITS.post);

  if (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('[discover search posts]', error);
    }
    return [];
  }

  return (data ?? []).map((row) => {
    const body = (row.body as string | null)?.trim() ?? '';
    const place =
      (row.city_name as string | null)?.trim() ||
      (row.full_address as string | null)?.trim() ||
      null;
    const title = body.length > 80 ? `${body.slice(0, 77)}…` : body || 'Post';
    return {
      kind: 'post' as const,
      id: String(row.id),
      title,
      subtitle: place,
      kindLabel: 'Post',
      href: `/post/${encodeURIComponent(String(row.id))}`,
    };
  });
}

async function searchAccounts(q: string): Promise<DiscoverSearchHit[]> {
  const supabase = await createSupabaseServerClient();
  const select = 'id,username,first_name,last_name,image_url,search_visibility';

  if (looksLikeEmail(q)) {
    const { data } = await supabase
      .from('accounts')
      .select(select)
      .ilike('email', q.trim().toLowerCase())
      .or(ACCOUNT_SEARCH_VISIBILITY_FILTER)
      .limit(LIMITS.account);
    return mapAccountHits(data ?? []);
  }

  const tokens = q.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return [];
  const firstPattern = `%${escapeIlike(tokens[0])}%`;

  const { data: rows } = await supabase
    .from('accounts')
    .select(select)
    .not('username', 'is', null)
    .or(ACCOUNT_SEARCH_VISIBILITY_FILTER)
    .or(
      `first_name.ilike.${firstPattern},last_name.ilike.${firstPattern},username.ilike.${firstPattern}`,
    )
    .limit(40);

  const rest = tokens.slice(1).map((t) => t.toLowerCase());
  const filtered = (rows ?? [])
    .filter(
      (row: {
        first_name: string | null;
        last_name: string | null;
        username: string | null;
        search_visibility?: boolean | null;
      }) => {
        const first = (row.first_name ?? '').toLowerCase();
        const last = (row.last_name ?? '').toLowerCase();
        const username = (row.username ?? '').toLowerCase();
        return rest.every(
          (t) => first.includes(t) || last.includes(t) || username.includes(t),
        );
      },
    )
    .slice(0, LIMITS.account);

  return mapAccountHits(filtered);
}

function mapAccountHits(
  rows: Array<{
    id: string;
    username: string | null;
    first_name: string | null;
    last_name: string | null;
    image_url: string | null;
    search_visibility?: boolean | null;
  }>,
): DiscoverSearchHit[] {
  return rows
    .filter(
      (row) =>
        row.username?.trim() &&
        row.search_visibility !== false,
    )
    .map((row) => {
      const name = [row.first_name, row.last_name].filter(Boolean).join(' ').trim();
      const username = row.username!.trim();
      return {
        kind: 'account' as const,
        id: row.id,
        title: name || username,
        subtitle: `@${username}`,
        kindLabel: 'Account',
        href: `/${encodeURIComponent(username)}`,
        meta: { username, imageUrl: row.image_url },
      };
    });
}

function asCompletedVia(value: unknown): DiscoverSearchCompletedVia {
  return value === 'submit' ? 'submit' : 'result_open';
}

function asHitKind(value: unknown): DiscoverSearchKind | null {
  if (typeof value !== 'string') return null;
  return (DISCOVER_SEARCH_SECTION_ORDER as string[]).includes(value) ||
    value === 'school' ||
    value === 'atlas_collection'
    ? (value as DiscoverSearchKind)
    : null;
}

async function loadRecent(accountId: string): Promise<DiscoverSearchRecentRow[]> {
  try {
    const db = createServiceRoleClient();
    const { data } = await db
      .from('discover_searches')
      .select('id, query, completed_via, hit_kind, hit_title, hit_href, created_at')
      .eq('account_id', accountId)
      .order('created_at', { ascending: false })
      .limit(RECENT_FETCH_LIMIT);

    const seen = new Set<string>();
    const rows: DiscoverSearchRecentRow[] = [];
    for (const row of data ?? []) {
      const query = (row.query as string) ?? '';
      const key = query.trim().toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      rows.push({
        id: row.id as string,
        query,
        createdAt: row.created_at as string,
        completedVia: asCompletedVia(row.completed_via),
        hitKind: asHitKind(row.hit_kind),
        hitTitle: (row.hit_title as string | null) ?? null,
        hitHref: (row.hit_href as string | null) ?? null,
      });
      if (rows.length >= RECENT_DISPLAY_LIMIT) break;
    }
    return rows;
  } catch {
    return [];
  }
}

export async function persistDiscoverSearch(
  accountId: string,
  input: DiscoverSearchPersistInput,
): Promise<void> {
  const query = input.query.trim();
  if (query.length < 2 || query.length > 120) return;

  const completedVia = input.completedVia;
  const hitKind = input.hitKind ?? null;
  const hitId = input.hitId?.trim() || null;
  const hitTitle = input.hitTitle?.trim() || null;
  const hitHref = input.hitHref?.trim() || null;

  if (completedVia === 'result_open' && (!hitKind || !hitId)) return;

  try {
    const db = createServiceRoleClient();
    const { error } = await db.from('discover_searches').insert({
      account_id: accountId,
      query,
      completed_via: completedVia,
      hit_kind: hitKind,
      hit_id: hitId,
      hit_title: hitTitle,
      hit_href: hitHref,
    });
    if (error && process.env.NODE_ENV === 'development') {
      console.warn('[discover search] persist failed', error.message);
    }
  } catch (err) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[discover search] persist failed', err);
    }
  }
}

export async function runDiscoverSearch(
  q: string,
  opts?: { accountId?: string | null },
): Promise<DiscoverSearchResponse> {
  const query = q.trim();
  const accountId = opts?.accountId ?? null;

  if (query.length < 2) {
    const recent = accountId ? await loadRecent(accountId) : [];
    return { query, sections: [], recent };
  }

  const [
    pages,
    territories,
    atlasFeatures,
    atlasCollections,
    places,
    experienceZones,
    posts,
    accounts,
  ] = await Promise.all([
    searchPages(query),
    searchTerritories(query),
    searchAtlasFeatures(query),
    searchAtlasCollections(query),
    searchPlaces(query),
    searchExperienceZones(query),
    searchPosts(query),
    searchAccounts(query),
  ]);

  const atlasHits = [
    ...atlasFeatures,
    ...atlasCollections.map((hit) => ({
      ...hit,
      kind: 'atlas_feature' as const,
    })),
  ];

  const sections = buildSections({
    page: pages,
    territory: territories,
    atlas_feature: atlasHits,
    place: places,
    experience_zone: experienceZones,
    post: posts,
    account: accounts,
  });

  return { query, sections };
}

export async function getDiscoverSearchSession(): Promise<{
  accountId: string | null;
}> {
  const session = await getSessionAccount().catch(() => null);
  return { accountId: session?.accountId ?? null };
}
