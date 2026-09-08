import { NextResponse } from 'next/server';
import {
  aiAccessCanApply,
  resolveAiAccess,
} from '@/lib/ai/requireAiAccess';
import {
  mergeUnitAttrs,
  readAttrsFoundation,
} from '@/lib/ai/unitProfileFacts';
import { isUuid } from '@/lib/ai/subjectTypes';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { createTerritoryServerClient } from '@/lib/supabase/territoryDb';

type OwnerAccount = {
  id: string;
  username: string | null;
  claim_status: string | null;
  about: string | null;
  bio: string | null;
  website_url: string | null;
  email: string | null;
  phone: string | null;
  office_hours: string | null;
  image_url: string | null;
};

type AccountLink = {
  kind: 'social' | 'service';
  platform: string | null;
  label: string;
  url: string;
};

type AccountMedia = {
  id: string;
  platform: 'youtube';
  external_id: string;
  title: string;
  url: string;
  thumbnail_url: string | null;
  published_at: string | null;
};

type PublicNavItem = {
  id: string;
  parent_id: string | null;
  label: string;
  url: string | null;
  summary: string | null;
  children: PublicNavItem[];
};

function canonicalizeProfileUrl(raw: string): string {
  const v = raw.trim();
  if (!v) return '';
  try {
    const parsed = new URL(v);
    parsed.hash = '';
    return parsed.toString().replace(/\/$/, '');
  } catch {
    return v.replace(/\/$/, '');
  }
}

function nestPublicNav(
  rows: Array<{
    id: string;
    parent_id: string | null;
    label: string;
    url: string | null;
    sort_order: number;
    hidden: boolean;
  }>,
  knowledgeByUrl: Map<string, string>,
): PublicNavItem[] {
  const items: Array<PublicNavItem & { sort_order: number; hidden: boolean }> = rows.map(row => ({
    id: row.id,
    parent_id: row.parent_id,
    label: row.label,
    url: row.url,
    summary: row.url ? knowledgeByUrl.get(canonicalizeProfileUrl(row.url)) ?? null : null,
    children: [],
    sort_order: row.sort_order,
    hidden: row.hidden,
  }));
  const byId = new Map(items.map(n => [n.id, n]));
  const roots: typeof items = [];
  for (const node of items) {
    if (node.parent_id && byId.has(node.parent_id)) {
      byId.get(node.parent_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  const prune = (
    nodes: Array<PublicNavItem & { sort_order: number; hidden: boolean }>,
  ): PublicNavItem[] => {
    return nodes
      .filter(n => !n.hidden)
      .sort((a, b) => a.sort_order - b.sort_order || a.label.localeCompare(b.label))
      .map(n => ({
        id: n.id,
        parent_id: n.parent_id,
        label: n.label,
        url: n.url,
        summary: n.summary,
        children: prune(n.children as typeof items),
      }));
  };
  return prune(roots);
}

export const dynamic = 'force-dynamic';

function asNullableString(v: unknown): string | null | undefined {
  if (v === undefined) return undefined;
  if (v === null) return null;
  if (typeof v !== 'string') return undefined;
  const t = v.trim();
  return t ? t : null;
}

function asNullablePopulation(v: unknown): number | null | undefined {
  if (v === undefined) return undefined;
  if (v === null || v === '') return null;
  if (typeof v === 'number' && Number.isFinite(v) && v > 0) return Math.round(v);
  if (typeof v === 'string') {
    const n = Number(v.replace(/,/g, '').trim());
    if (!Number.isFinite(n) || n <= 0) return null;
    return Math.round(n);
  }
  return undefined;
}

function asStringList(v: unknown, max = 12): string[] | undefined {
  if (v === undefined) return undefined;
  if (!Array.isArray(v)) return undefined;
  const out: string[] = [];
  for (const item of v) {
    if (typeof item !== 'string') continue;
    const t = item.trim();
    if (!t || out.includes(t)) continue;
    out.push(t);
    if (out.length >= max) break;
  }
  return out;
}

/**
 * GET /api/territory/units/[id]/profile
 * Public place foundation fields for the details dock.
 * `editable` is true for localhost/dev and staff/admin.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    if (!isUuid(id)) {
      return NextResponse.json({ error: 'Invalid unit id' }, { status: 400 });
    }

    const db = createTerritoryServerClient();
    const { data: unit, error } = await db
      .from('units')
      .select(
        'id, name, kind, subtype, description, website_url, contact_email, contact_phone, hall_name, hall_address, meeting_schedule_label, owner_account_id, attrs',
      )
      .eq('id', id)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!unit) {
      return NextResponse.json({ error: 'Unit not found' }, { status: 404 });
    }

    let owner: OwnerAccount | null = null;
    let links: AccountLink[] = [];
    let videos: AccountMedia[] = [];
    let nav: PublicNavItem[] = [];
    let knowledgeByUrl = new Map<string, string>();
    if (unit.owner_account_id) {
      const pub = createServiceRoleClient();
      const ai = createServiceRoleClient('ai');
      const [{ data: acct }, { data: linkRows }, { data: mediaRows }, { data: navRows }, { data: knowledgeRows }] =
        await Promise.all([
        pub
          .from('accounts')
          .select(
            'id, username, claim_status, about, bio, website_url, email, phone, office_hours, image_url',
          )
          .eq('id', unit.owner_account_id)
          .maybeSingle(),
        pub
          .from('account_links')
          .select('kind, platform, label, url, sort_order')
          .eq('owner_account_id', unit.owner_account_id)
          .order('kind')
          .order('sort_order'),
        pub
          .from('account_media')
          .select('id, platform, external_id, title, url, thumbnail_url, published_at, sort_order, hidden')
          .eq('owner_account_id', unit.owner_account_id)
          .eq('platform', 'youtube')
          .eq('hidden', false)
          .order('published_at', { ascending: false, nullsFirst: false })
          .order('sort_order'),
        pub
          .from('account_nav')
          .select('id, parent_id, label, url, sort_order, hidden')
          .eq('owner_account_id', unit.owner_account_id)
          .order('sort_order'),
        ai
          .from('unit_knowledge')
          .select('source_url, summary, status')
          .eq('unit_id', id)
          .eq('status', 'ready'),
      ]);
      owner = (acct as OwnerAccount | null) ?? null;
      links = (linkRows ?? []).flatMap(row => {
        const r = row as Record<string, unknown>;
        const url = typeof r.url === 'string' ? r.url.trim() : '';
        const label = typeof r.label === 'string' ? r.label.trim() : '';
        if (!url || !label) return [];
        return [
          {
            kind: r.kind === 'social' ? 'social' : 'service',
            platform: typeof r.platform === 'string' ? r.platform : null,
            label,
            url,
          } satisfies AccountLink,
        ];
      });
      videos = (mediaRows ?? []).flatMap(row => {
        const r = row as Record<string, unknown>;
        const external = typeof r.external_id === 'string' ? r.external_id.trim() : '';
        const title = typeof r.title === 'string' ? r.title.trim() : '';
        if (!external || !title) return [];
        return [
          {
            id: String(r.id),
            platform: 'youtube',
            external_id: external,
            title,
            url:
              typeof r.url === 'string' && r.url.trim()
                ? r.url.trim()
                : `https://www.youtube.com/watch?v=${external}`,
            thumbnail_url: typeof r.thumbnail_url === 'string' ? r.thumbnail_url : null,
            published_at: typeof r.published_at === 'string' ? r.published_at : null,
          } satisfies AccountMedia,
        ];
      });
      for (const row of knowledgeRows ?? []) {
        const r = row as { source_url?: string; summary?: string };
        const url = canonicalizeProfileUrl(String(r.source_url ?? ''));
        if (url && r.summary) knowledgeByUrl.set(url, r.summary);
      }
      nav = nestPublicNav(
        (navRows ?? []).map(row => {
          const r = row as Record<string, unknown>;
          return {
            id: String(r.id),
            parent_id: typeof r.parent_id === 'string' ? r.parent_id : null,
            label: String(r.label ?? ''),
            url: typeof r.url === 'string' && r.url.trim() ? r.url.trim() : null,
            sort_order: typeof r.sort_order === 'number' ? r.sort_order : 0,
            hidden: Boolean(r.hidden),
          };
        }),
        knowledgeByUrl,
      );
    }

    const foundation = readAttrsFoundation(
      (unit.attrs as Record<string, unknown>) ?? {},
    );
    const access = await resolveAiAccess();
    const editable = aiAccessCanApply(access);

    return NextResponse.json({
      id: unit.id,
      name: unit.name,
      kind: unit.kind,
      subtype: unit.subtype,
      description: owner?.about?.trim() || unit.description || owner?.bio || null,
      website_url: owner?.website_url?.trim() || unit.website_url,
      contact_email: owner?.email?.trim() || unit.contact_email,
      contact_phone: owner?.phone?.trim() || unit.contact_phone,
      hall_name: unit.hall_name,
      hall_address: unit.hall_address,
      meeting_schedule_label: unit.meeting_schedule_label,
      office_hours: owner?.office_hours ?? null,
      has_publisher: Boolean(unit.owner_account_id),
      publisher_username: owner?.username ?? null,
      image_url: owner?.image_url?.trim() || null,
      claim_status: owner?.claim_status ?? null,
      population: foundation.population,
      features: foundation.features,
      social_links: links.filter(l => l.kind === 'social'),
      service_links: links.filter(l => l.kind === 'service'),
      videos,
      nav,
      editable,
    });
  } catch (err) {
    console.error('[territory/units profile GET]', err);
    return NextResponse.json({ error: 'Failed to load unit profile' }, { status: 500 });
  }
}

/**
 * PATCH /api/territory/units/[id]/profile
 * Manually configure foundation columns + attrs (population / features).
 * Localhost/dev and staff/admin only.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const access = await resolveAiAccess();
  if (!aiAccessCanApply(access)) {
    return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
  }

  try {
    const { id } = await params;
    if (!isUuid(id)) {
      return NextResponse.json({ error: 'Invalid unit id' }, { status: 400 });
    }

    const body = (await request.json().catch(() => null)) as Record<
      string,
      unknown
    > | null;
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
    }

    const db = createTerritoryServerClient();
    const { data: existing, error: loadErr } = await db
      .from('units')
      .select(
        'id, description, website_url, contact_email, contact_phone, owner_account_id, attrs',
      )
      .eq('id', id)
      .maybeSingle();

    if (loadErr) {
      return NextResponse.json({ error: loadErr.message }, { status: 500 });
    }
    if (!existing) {
      return NextResponse.json({ error: 'Unit not found' }, { status: 404 });
    }

    const patch: Record<string, unknown> = {};

    const description = asNullableString(body.description);
    if (description !== undefined) patch.description = description;
    const website = asNullableString(body.website_url);
    if (website !== undefined) patch.website_url = website;
    const email = asNullableString(body.contact_email);
    if (email !== undefined) patch.contact_email = email;
    const phone = asNullableString(body.contact_phone);
    if (phone !== undefined) patch.contact_phone = phone;

    const population = asNullablePopulation(body.population);
    const featuresBody =
      body.features && typeof body.features === 'object' && !Array.isArray(body.features)
        ? (body.features as Record<string, unknown>)
        : null;
    const best = featuresBody ? asStringList(featuresBody.best) : undefined;
    const worst = featuresBody ? asStringList(featuresBody.worst) : undefined;

    const attrsPatch: {
      population?: number;
      features?: { best?: string[]; worst?: string[] };
    } = {};
    let touchAttrs = false;

    if (population !== undefined) {
      touchAttrs = true;
      if (population != null) attrsPatch.population = population;
    }
    if (best !== undefined || worst !== undefined) {
      touchAttrs = true;
      attrsPatch.features = {};
      if (best !== undefined) attrsPatch.features.best = best;
      if (worst !== undefined) attrsPatch.features.worst = worst;
    }

    if (touchAttrs) {
      const existingAttrs = (existing.attrs as Record<string, unknown>) ?? {};
      let nextAttrs = mergeUnitAttrs(existingAttrs, attrsPatch);
      // Explicit clear for population when null was sent.
      if (population === null) {
        const { population: _drop, ...rest } = nextAttrs;
        nextAttrs = rest;
      }
      patch.attrs = nextAttrs;
    }

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: 'No changes' }, { status: 400 });
    }

    if (existing.owner_account_id) {
      const acctPatch: Record<string, unknown> = {};
      if (description !== undefined) acctPatch.about = description;
      if (website !== undefined) acctPatch.website_url = website;
      if (email !== undefined) acctPatch.email = email;
      if (phone !== undefined) acctPatch.phone = phone;
      if (Object.keys(acctPatch).length > 0) {
        const pub = createServiceRoleClient();
        const { error: acctErr } = await pub
          .from('accounts')
          .update(acctPatch)
          .eq('id', existing.owner_account_id);
        if (acctErr) {
          return NextResponse.json({ error: acctErr.message }, { status: 500 });
        }
      }
    }

    const { data: updated, error: updateErr } = await db
      .from('units')
      .update(patch)
      .eq('id', id)
      .select(
        'id, name, kind, subtype, description, website_url, contact_email, contact_phone, attrs',
      )
      .single();

    if (updateErr || !updated) {
      return NextResponse.json(
        { error: updateErr?.message ?? 'Update failed' },
        { status: 500 },
      );
    }

    const foundation = readAttrsFoundation(
      (updated.attrs as Record<string, unknown>) ?? {},
    );

    return NextResponse.json({
      id: updated.id,
      name: updated.name,
      kind: updated.kind,
      subtype: updated.subtype,
      description: updated.description,
      website_url: updated.website_url,
      contact_email: updated.contact_email,
      contact_phone: updated.contact_phone,
      population: foundation.population,
      features: foundation.features,
      editable: true,
    });
  } catch (err) {
    console.error('[territory/units profile PATCH]', err);
    return NextResponse.json({ error: 'Failed to save unit profile' }, { status: 500 });
  }
}
