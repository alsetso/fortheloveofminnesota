import { NextResponse } from 'next/server';
import { getSessionAccount } from '@/lib/auth/getSessionAccount';
import { recordAdEvent } from '@/lib/ads/recordAdEvent';

export const dynamic = 'force-dynamic';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value);
}

/**
 * POST /api/analytics/ad-event — impression / click with credit ledger.
 * Viewer account from session; guests stored as null.
 */
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const raw = body as {
    creative_id?: unknown;
    placement_id?: unknown;
    event_type?: unknown;
    session_id?: unknown;
  };

  if (!isUuid(raw.creative_id)) {
    return NextResponse.json({ error: 'creative_id required' }, { status: 400 });
  }
  if (raw.event_type !== 'impression' && raw.event_type !== 'click') {
    return NextResponse.json({ error: 'event_type must be impression or click' }, { status: 400 });
  }
  if (raw.placement_id != null && raw.placement_id !== '' && !isUuid(raw.placement_id)) {
    return NextResponse.json({ error: 'invalid placement_id' }, { status: 400 });
  }
  if (raw.session_id != null && raw.session_id !== '' && !isUuid(raw.session_id)) {
    return NextResponse.json({ error: 'invalid session_id' }, { status: 400 });
  }

  const session = await getSessionAccount();

  try {
    const result = await recordAdEvent({
      creativeId: raw.creative_id,
      eventType: raw.event_type,
      placementId: isUuid(raw.placement_id) ? raw.placement_id : null,
      sessionId: isUuid(raw.session_id) ? raw.session_id : null,
      viewerAccountId: session?.accountId ?? null,
    });

    if (result.paused) {
      return NextResponse.json({ ok: false, paused: true, reason: result.reason });
    }

    return NextResponse.json({
      ok: true,
      tracked: result.tracked,
      alreadyRecorded: result.alreadyRecorded,
      eventId: result.eventId,
      creditsCharged: result.creditsCharged,
    });
  } catch (e) {
    console.error('[ad-event]', e);
    return NextResponse.json({ error: 'Failed to record event' }, { status: 500 });
  }
}
