import { NextResponse } from 'next/server';
import { placeholderSeatsForUnitKind } from '@/features/map/territory/officeholderPlaceholders';
import { createTerritoryServerClient } from '@/lib/supabase/territoryDb';

export const dynamic = 'force-dynamic';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isLocalDevWriteAllowed(): boolean {
  return process.env.NODE_ENV === 'development';
}

export type UnitSeatRow = {
  seat_id: string | null;
  seat_type: string;
  title: string;
  sub_label: string | null;
  seat_number: number | null;
  is_placeholder: boolean;
  officeholder_id: string | null;
  full_name: string | null;
  photo_url: string | null;
  party: string | null;
  bio: string | null;
  email: string | null;
  phone: string | null;
  website_url: string | null;
  source_urls: string[];
  term_start: string | null;
  term_end: string | null;
};

type SeatDb = {
  id: string;
  seat_type: string;
  title: string;
  sub_label: string | null;
  seat_number: number | null;
};

type HolderDb = {
  id: string;
  seat_id: string;
  full_name: string;
  photo_url: string | null;
  party: string | null;
  bio: string | null;
  email: string | null;
  phone: string | null;
  website_url: string | null;
  source_urls: string[] | null;
  term_start: string | null;
  term_end: string | null;
  is_current: boolean;
};

function mergeSeatsWithHolders(seats: SeatDb[], holders: HolderDb[]): UnitSeatRow[] {
  const bySeat = new Map<string, HolderDb>();
  for (const h of holders) {
    if (h.is_current) bySeat.set(h.seat_id, h);
  }
  return seats.map((s) => {
    const h = bySeat.get(s.id);
    return {
      seat_id: s.id,
      seat_type: s.seat_type,
      title: s.title,
      sub_label: s.sub_label,
      seat_number: s.seat_number,
      is_placeholder: false,
      officeholder_id: h?.id ?? null,
      full_name: h?.full_name ?? null,
      photo_url: h?.photo_url ?? null,
      party: h?.party ?? null,
      bio: h?.bio ?? null,
      email: h?.email ?? null,
      phone: h?.phone ?? null,
      website_url: h?.website_url ?? null,
      source_urls: Array.isArray(h?.source_urls) ? h!.source_urls! : [],
      term_start: h?.term_start ?? null,
      term_end: h?.term_end ?? null,
    };
  });
}

/**
 * GET /api/territory/units/[id]/officeholders
 * Active seats for a unit (with current holder when present).
 * Empty seats → kind-based placeholder cards for the + add UI.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    if (!id || !UUID_RE.test(id)) {
      return NextResponse.json({ error: 'Invalid unit id' }, { status: 400 });
    }

    const db = createTerritoryServerClient();
    const { data: unit, error: unitErr } = await db
      .from('units')
      .select('id, kind, subtype')
      .eq('id', id)
      .maybeSingle();

    if (unitErr) {
      if (process.env.NODE_ENV === 'development') {
        console.error(`[territory seats unit ${id}]`, unitErr);
      }
      return NextResponse.json({ error: 'Failed to load unit' }, { status: 500 });
    }
    if (!unit) {
      return NextResponse.json({ error: 'Unit not found' }, { status: 404 });
    }

    const { data: seatsRaw, error: seatsErr } = await db
      .from('seats')
      .select('id, seat_type, title, sub_label, seat_number')
      .eq('unit_id', id)
      .eq('is_active', true)
      .order('seat_number', { ascending: true, nullsFirst: false });

    if (seatsErr) {
      if (process.env.NODE_ENV === 'development') {
        console.error(`[territory seats ${id}]`, seatsErr);
      }
      return NextResponse.json({ error: 'Failed to load seats' }, { status: 500 });
    }

    const seats = (seatsRaw ?? []) as SeatDb[];
    let rows: UnitSeatRow[] = [];

    if (seats.length > 0) {
      const seatIds = seats.map((s) => s.id);
      const { data: holdersRaw, error: holdersErr } = await db
        .from('officeholders')
        .select(
          'id, seat_id, full_name, photo_url, party, bio, email, phone, website_url, source_urls, term_start, term_end, is_current',
        )
        .in('seat_id', seatIds)
        .eq('is_current', true);

      if (holdersErr) {
        if (process.env.NODE_ENV === 'development') {
          console.error(`[territory holders ${id}]`, holdersErr);
        }
        return NextResponse.json({ error: 'Failed to load officeholders' }, { status: 500 });
      }

      rows = mergeSeatsWithHolders(seats, (holdersRaw ?? []) as HolderDb[]);
    } else {
      const placeholders = placeholderSeatsForUnitKind(
        String(unit.kind),
        unit.subtype != null ? String(unit.subtype) : null,
      );
      rows = placeholders.map((p) => ({
        seat_id: null,
        seat_type: p.seat_type,
        title: p.title,
        sub_label: p.sub_label ?? null,
        seat_number: null,
        is_placeholder: true,
        officeholder_id: null,
        full_name: null,
        photo_url: null,
        party: null,
        bio: null,
        email: null,
        phone: null,
        website_url: null,
        source_urls: [],
        term_start: null,
        term_end: null,
      }));
    }

    return NextResponse.json({
      seats: rows,
      /** Legacy alias — filled holders only. */
      holders: rows.filter((r) => r.full_name),
      editable: isLocalDevWriteAllowed(),
    });
  } catch (err) {
    if (process.env.NODE_ENV === 'development') {
      console.error('[territory officeholders GET]', err);
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

type UpsertBody = {
  seat_id?: string | null;
  seat_type?: string;
  title?: string;
  sub_label?: string | null;
  officeholder?: {
    id?: string | null;
    full_name?: string;
    photo_url?: string | null;
    party?: string | null;
    bio?: string | null;
    email?: string | null;
    phone?: string | null;
    website_url?: string | null;
    source_urls?: string[] | null;
    term_start?: string | null;
    term_end?: string | null;
  };
};

/**
 * POST — create/update seat + current officeholder.
 * Localhost / NODE_ENV=development only.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isLocalDevWriteAllowed()) {
    return NextResponse.json({ error: 'Officeholder edits are local-dev only' }, { status: 403 });
  }

  try {
    const { id: unitId } = await params;
    if (!unitId || !UUID_RE.test(unitId)) {
      return NextResponse.json({ error: 'Invalid unit id' }, { status: 400 });
    }

    const body = (await request.json().catch(() => null)) as UpsertBody | null;
    if (!body?.officeholder?.full_name?.trim()) {
      return NextResponse.json({ error: 'full_name is required' }, { status: 400 });
    }

    const db = createTerritoryServerClient();
    let seatId = body.seat_id?.trim() || null;

    if (seatId) {
      if (!UUID_RE.test(seatId)) {
        return NextResponse.json({ error: 'Invalid seat id' }, { status: 400 });
      }
      const { data: existingSeat, error: seatLookupErr } = await db
        .from('seats')
        .select('id, unit_id')
        .eq('id', seatId)
        .maybeSingle();
      if (seatLookupErr || !existingSeat || existingSeat.unit_id !== unitId) {
        return NextResponse.json({ error: 'Seat not found for this unit' }, { status: 404 });
      }
    } else {
      const seatType = body.seat_type?.trim();
      const title = body.title?.trim();
      if (!seatType || !title) {
        return NextResponse.json(
          { error: 'seat_type and title are required when creating a seat' },
          { status: 400 },
        );
      }
      const subLabel = body.sub_label?.trim() || null;
      const { data: createdSeat, error: createSeatErr } = await db
        .from('seats')
        .upsert(
          {
            unit_id: unitId,
            seat_type: seatType,
            title,
            sub_label: subLabel,
            is_active: true,
            is_elected: true,
          },
          { onConflict: 'unit_id,seat_type,sub_label' },
        )
        .select('id')
        .single();

      if (createSeatErr || !createdSeat) {
        if (process.env.NODE_ENV === 'development') {
          console.error('[territory create seat]', createSeatErr);
        }
        return NextResponse.json({ error: 'Failed to create seat' }, { status: 500 });
      }
      seatId = createdSeat.id as string;
    }

    const oh = body.officeholder;
    const sourceUrls = Array.isArray(oh.source_urls)
      ? oh.source_urls
          .filter((u): u is string => typeof u === 'string')
          .map((u) => u.trim())
          .filter(Boolean)
          .slice(0, 12)
      : [];
    const payload = {
      full_name: oh.full_name!.trim(),
      photo_url: oh.photo_url?.trim() || null,
      party: oh.party?.trim() || null,
      bio: oh.bio?.trim() || null,
      email: oh.email?.trim() || null,
      phone: oh.phone?.trim() || null,
      website_url: oh.website_url?.trim() || null,
      source_urls: sourceUrls,
      term_start: oh.term_start?.trim() || null,
      term_end: oh.term_end?.trim() || null,
      is_current: true,
      seat_id: seatId,
    };

    if (oh.id?.trim() && UUID_RE.test(oh.id.trim())) {
      const { data: updated, error: updateErr } = await db
        .from('officeholders')
        .update(payload)
        .eq('id', oh.id.trim())
        .eq('seat_id', seatId)
        .select('id')
        .maybeSingle();
      if (updateErr || !updated) {
        if (process.env.NODE_ENV === 'development') {
          console.error('[territory update holder]', updateErr);
        }
        return NextResponse.json({ error: 'Failed to update officeholder' }, { status: 500 });
      }
      return NextResponse.json({ ok: true, seat_id: seatId, officeholder_id: updated.id });
    }

    // Clear other current holders on this seat, then insert.
    await db
      .from('officeholders')
      .update({ is_current: false })
      .eq('seat_id', seatId)
      .eq('is_current', true);

    const { data: inserted, error: insertErr } = await db
      .from('officeholders')
      .insert(payload)
      .select('id')
      .single();

    if (insertErr || !inserted) {
      if (process.env.NODE_ENV === 'development') {
        console.error('[territory insert holder]', insertErr);
      }
      return NextResponse.json({ error: 'Failed to create officeholder' }, { status: 500 });
    }

    return NextResponse.json({ ok: true, seat_id: seatId, officeholder_id: inserted.id });
  } catch (err) {
    if (process.env.NODE_ENV === 'development') {
      console.error('[territory officeholders POST]', err);
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
