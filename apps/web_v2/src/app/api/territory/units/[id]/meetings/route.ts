import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Window for listing meetings: 30 days back through 180 days forward. */
const PAST_DAYS = 30;
const FUTURE_DAYS = 180;

type MeetingDb = {
  id: string;
  unit_id: string | null;
  owner_account_id: string;
  title: string;
  body_name: string | null;
  cadence: string;
  cadence_label: string | null;
  starts_at: string;
  ends_at: string | null;
  location_label: string | null;
  virtual_url: string | null;
  status: string;
  external_agenda_url: string | null;
};

type AgendaDb = {
  id: string;
  meeting_id: string;
  sort_order: number;
  title: string;
  summary: string | null;
  presenter: string | null;
  status: string;
  is_public_hearing: boolean;
};

type ResourceDb = {
  id: string;
  meeting_id: string;
  agenda_item_id: string | null;
  kind: string;
  title: string;
  url: string;
};

function mapMeeting(row: MeetingDb) {
  return {
    id: row.id,
    unitId: row.unit_id,
    bodyName: row.body_name?.trim() || 'Governing body',
    title: row.title,
    cadence: row.cadence === 'recurring' ? 'recurring' : 'one_off',
    cadenceLabel: row.cadence_label,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    locationLabel: row.location_label,
    virtualUrl: row.virtual_url,
    status: row.status,
    externalAgendaUrl: row.external_agenda_url,
  };
}

function mapAgendaItem(row: AgendaDb) {
  return {
    id: row.id,
    meetingId: row.meeting_id,
    order: row.sort_order,
    title: row.title,
    summary: row.summary,
    presenter: row.presenter,
    status: row.status,
    isPublicHearing: row.is_public_hearing,
  };
}

function mapResource(row: ResourceDb) {
  return {
    id: row.id,
    meetingId: row.meeting_id,
    agendaItemId: row.agenda_item_id,
    kind: row.kind,
    title: row.title,
    url: row.url,
  };
}

function appendExternalAgendaLink(
  resources: ReturnType<typeof mapResource>[],
  externalUrl: string | null,
  meetingId: string,
): ReturnType<typeof mapResource>[] {
  const url = externalUrl?.trim();
  if (!url) return resources;
  if (resources.some((r) => r.url === url)) return resources;
  return [
    ...resources,
    {
      id: `external:${meetingId}`,
      meetingId,
      agendaItemId: null,
      kind: 'link',
      title: 'Official agenda',
      url,
    },
  ];
}

/**
 * GET /api/territory/units/[id]/meetings
 *
 * List upcoming/recent meetings for a unit (public.meetings, Phase 0).
 *
 * GET /api/territory/units/[id]/meetings?meeting_id=<uuid>
 * Agenda/resources still live in territory.* when present; migrated rows may
 * only have the meeting shell + optional external agenda link.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: unitId } = await params;
    if (!unitId || !UUID_RE.test(unitId)) {
      return NextResponse.json({ error: 'Invalid unit id' }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const meetingId = searchParams.get('meeting_id')?.trim() ?? null;

    const publicDb = createServiceRoleClient();
    const territoryDb = createServiceRoleClient('territory');

    const { data: unit, error: unitErr } = await territoryDb
      .from('units')
      .select('id')
      .eq('id', unitId)
      .maybeSingle();

    if (unitErr) {
      return NextResponse.json({ error: unitErr.message }, { status: 500 });
    }
    if (!unit) {
      return NextResponse.json({ error: 'Unit not found' }, { status: 404 });
    }

    if (meetingId) {
      if (!UUID_RE.test(meetingId)) {
        return NextResponse.json({ error: 'Invalid meeting id' }, { status: 400 });
      }

      const { data: meetingRaw, error: meetingErr } = await publicDb
        .from('meetings')
        .select(
          `
          id,
          unit_id,
          owner_account_id,
          title,
          body_name,
          cadence,
          cadence_label,
          starts_at,
          ends_at,
          location_label,
          virtual_url,
          status,
          external_agenda_url
        `,
        )
        .eq('id', meetingId)
        .eq('unit_id', unitId)
        .maybeSingle();

      if (meetingErr) {
        return NextResponse.json({ error: meetingErr.message }, { status: 500 });
      }
      if (!meetingRaw) {
        return NextResponse.json({ error: 'Meeting not found' }, { status: 404 });
      }

      // Agenda/resources remain in territory until a later phase moves them.
      const [agendaResult, resourcesResult] = await Promise.all([
        territoryDb
          .from('agenda_items')
          .select(
            'id, meeting_id, sort_order, title, summary, presenter, status, is_public_hearing',
          )
          .eq('meeting_id', meetingId)
          .order('sort_order', { ascending: true }),
        territoryDb
          .from('meeting_resources')
          .select('id, meeting_id, agenda_item_id, kind, title, url')
          .eq('meeting_id', meetingId)
          .order('title', { ascending: true }),
      ]);

      // Missing territory tables / empty results are fine for migrated shells.
      const agenda = ((agendaResult.data ?? []) as AgendaDb[]).map(mapAgendaItem);
      const resources = appendExternalAgendaLink(
        ((resourcesResult.data ?? []) as ResourceDb[]).map(mapResource),
        (meetingRaw as MeetingDb).external_agenda_url,
        meetingId,
      );

      const meeting = mapMeeting(meetingRaw as MeetingDb);
      return NextResponse.json({ meeting, agenda, resources });
    }

    const now = new Date();
    const from = new Date(now);
    from.setDate(from.getDate() - PAST_DAYS);
    const to = new Date(now);
    to.setDate(to.getDate() + FUTURE_DAYS);

    const { data: meetingsRaw, error: meetingsErr } = await publicDb
      .from('meetings')
      .select(
        `
        id,
        unit_id,
        owner_account_id,
        title,
        body_name,
        cadence,
        cadence_label,
        starts_at,
        ends_at,
        location_label,
        virtual_url,
        status,
        external_agenda_url
      `,
      )
      .eq('unit_id', unitId)
      .gte('starts_at', from.toISOString())
      .lte('starts_at', to.toISOString())
      .neq('status', 'cancelled')
      .order('starts_at', { ascending: true });

    if (meetingsErr) {
      if (process.env.NODE_ENV === 'development') {
        console.error(`[territory meetings ${unitId}]`, meetingsErr);
      }
      return NextResponse.json({ error: 'Failed to load meetings' }, { status: 500 });
    }

    const meetings = ((meetingsRaw ?? []) as MeetingDb[]).map((row) => {
      const mapped = mapMeeting(row);
      const { externalAgendaUrl: _drop, ...rest } = mapped;
      return rest;
    });

    return NextResponse.json({ meetings });
  } catch (err) {
    if (process.env.NODE_ENV === 'development') {
      console.error('[territory meetings GET]', err);
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
