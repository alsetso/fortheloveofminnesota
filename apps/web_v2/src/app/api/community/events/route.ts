import { NextResponse } from 'next/server';
import type { CommunityCalendarEvent } from '@/features/calendar/calendarEventsApi';
import { CATEGORY_UUID } from '@/features/community/contributionTypes';
import { buildPostPlaceBits } from '@/features/feed/postPlaceLabel';
import { FEED_CONTENT_SHAPES, POST_VISIBILITY } from '@/lib/community/postVisibility';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const EVENT_TYPE_ID = CATEGORY_UUID.event;
const MAX_RANGE_DAYS = 93;
const MAX_ITEMS = 500;

type PostRow = {
  id: string;
  body: string | null;
  title: string | null;
  emoji: string | null;
  full_address: string | null;
  unit_id: string | null;
  zipcode_id: string | null;
  lat: number | null;
  lng: number | null;
  account_id: string | null;
  meta: Record<string, unknown> | null;
  category_id: string | null;
  mention_type_id: string | null;
};

function parseIsoDay(raw: string | null, fallback: Date): Date {
  if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return fallback;
  const [y, m, d] = raw.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

function readEventWindow(meta: Record<string, unknown> | null): {
  startsAt: string;
  endsAt: string | null;
  title: string | null;
} | null {
  const event = meta?.event;
  if (!event || typeof event !== 'object' || Array.isArray(event)) return null;
  const startsRaw = (event as { starts_at?: unknown }).starts_at;
  if (typeof startsRaw !== 'string' || !startsRaw.trim()) return null;
  const startsAt = startsRaw.trim();
  if (!Number.isFinite(Date.parse(startsAt))) return null;
  const endsRaw = (event as { ends_at?: unknown }).ends_at;
  const endsAt =
    typeof endsRaw === 'string' && endsRaw.trim() && Number.isFinite(Date.parse(endsRaw))
      ? endsRaw.trim()
      : null;
  const titleRaw = (event as { title?: unknown }).title;
  const title =
    typeof titleRaw === 'string' && titleRaw.trim() ? titleRaw.trim().slice(0, 120) : null;
  return { startsAt, endsAt, title };
}

/**
 * GET /api/community/events?from=YYYY-MM-DD&to=YYYY-MM-DD
 *
 * Public community.post events (`category` / `mention_type` = Event) whose
 * `meta.event.starts_at` falls in `[from, to)` (local calendar days → UTC bounds).
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const today = new Date();
    const fromDay = parseIsoDay(url.searchParams.get('from'), new Date(today.getFullYear(), today.getMonth(), 1));
    const defaultTo = new Date(fromDay.getFullYear(), fromDay.getMonth() + 1, 1);
    const toDay = parseIsoDay(url.searchParams.get('to'), defaultTo);

    const fromMs = fromDay.getTime();
    const toMs = toDay.getTime();
    if (!(toMs > fromMs)) {
      return NextResponse.json({ error: 'Invalid range' }, { status: 400 });
    }
    const spanDays = (toMs - fromMs) / 86_400_000;
    if (spanDays > MAX_RANGE_DAYS) {
      return NextResponse.json(
        { error: `Range must be ≤ ${MAX_RANGE_DAYS} days` },
        { status: 400 },
      );
    }

    const rangeStartIso = fromDay.toISOString();
    const rangeEndIso = toDay.toISOString();
    const nowIso = new Date().toISOString();

    const supabase = await createSupabaseServerClient();
    const { data: rows, error } = await supabase
      .schema('community')
      .from('posts')
      .select(
        'id, body, title, emoji, full_address, unit_id, zipcode_id, lat, lng, account_id, meta, category_id, mention_type_id',
      )
      .eq('kind', 'post')
      .eq('visibility', POST_VISIBILITY.public)
      .eq('is_active', true)
      .eq('archived', false)
      .or(
        `content_shape.is.null,content_shape.in.(${FEED_CONTENT_SHAPES.join(',')})`,
      )
      .or(`expires_at.is.null,expires_at.gt."${nowIso}"`)
      .or(`category_id.eq.${EVENT_TYPE_ID},mention_type_id.eq.${EVENT_TYPE_ID}`)
      .limit(MAX_ITEMS);

    if (error) {
      console.error('[community/events]', error);
      return NextResponse.json({ error: 'Failed to load events' }, { status: 500 });
    }

    const unitIds = [
      ...new Set(
        ((rows ?? []) as PostRow[])
          .map((p) => (p.unit_id ? String(p.unit_id) : null))
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    const zipIds = [
      ...new Set(
        ((rows ?? []) as PostRow[])
          .map((p) => (p.zipcode_id ? String(p.zipcode_id) : null))
          .filter((id): id is string => Boolean(id)),
      ),
    ];

    const unitNameById = new Map<string, string>();
    const nameIds = [...new Set([...unitIds, ...zipIds])];
    if (nameIds.length > 0) {
      const { data: units } = await supabase
        .schema('territory')
        .from('units')
        .select('id, name')
        .in('id', nameIds);
      for (const u of units ?? []) {
        const id = String((u as { id: string }).id);
        const name = String((u as { name: string | null }).name ?? '').trim();
        if (id && name) unitNameById.set(id, name);
      }
    }

    const items: CommunityCalendarEvent[] = [];
    for (const row of (rows ?? []) as PostRow[]) {
      const window = readEventWindow(row.meta);
      if (!window) continue;
      if (window.startsAt < rangeStartIso || window.startsAt >= rangeEndIso) continue;

      const unitId = row.unit_id ? String(row.unit_id) : null;
      const zipcodeId = row.zipcode_id ? String(row.zipcode_id) : null;
      const place = buildPostPlaceBits({
        unitId,
        zipcodeId,
        fullAddress: row.full_address,
        cityName: unitId ? unitNameById.get(unitId) ?? null : null,
        zipCode: zipcodeId ? unitNameById.get(zipcodeId) ?? null : null,
      });

      const title =
        window.title ||
        (typeof row.title === 'string' && row.title.trim() && row.title.trim() !== 'Event'
          ? row.title.trim()
          : null) ||
        (typeof row.body === 'string' && row.body.trim()
          ? row.body.trim().slice(0, 80)
          : 'Event');

      items.push({
        id: String(row.id),
        title,
        body: row.body,
        emoji: row.emoji,
        starts_at: window.startsAt,
        ends_at: window.endsAt,
        lat: row.lat,
        lng: row.lng,
        place_label: place.label,
        account_id: row.account_id ? String(row.account_id) : null,
      });
    }

    items.sort((a, b) => a.starts_at.localeCompare(b.starts_at));

    return NextResponse.json(
      { items },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (e) {
    console.error('[community/events]', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
