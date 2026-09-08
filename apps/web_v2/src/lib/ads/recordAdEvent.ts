import { getAdsServiceDb } from '@/lib/ads/adsServiceDb';
import { getEventCreditCosts } from '@/lib/ads/credits';

export type RecordAdEventInput = {
  creativeId: string;
  eventType: 'impression' | 'click';
  placementId?: string | null;
  sessionId?: string | null;
  viewerAccountId?: string | null;
};

export type RecordAdEventResult = {
  ok: boolean;
  tracked: boolean;
  alreadyRecorded: boolean;
  eventId: string | null;
  creditsCharged: number;
  paused: boolean;
  reason?: string;
};

export async function recordAdEvent(input: RecordAdEventInput): Promise<RecordAdEventResult> {
  const adsDb = getAdsServiceDb();
  const costs = await getEventCreditCosts();
  const { data, error } = await adsDb.rpc('record_ad_event', {
    p_creative_id: input.creativeId,
    p_event_type: input.eventType,
    p_placement_id: input.placementId ?? null,
    p_session_id: input.sessionId ?? null,
    p_viewer_account_id: input.viewerAccountId ?? null,
    p_impression_cost: costs.impression,
    p_click_cost: costs.click,
  });

  if (error) {
    if (error.message?.includes('insufficient_credits') || error.code === 'P0001') {
      await adsDb.from('ad_creatives').update({ status: 'paused' }).eq('id', input.creativeId);
      return {
        ok: false,
        tracked: false,
        alreadyRecorded: false,
        eventId: null,
        creditsCharged: 0,
        paused: true,
        reason: 'insufficient_credits',
      };
    }
    throw new Error(`record_ad_event: ${error.message ?? error.code ?? 'unknown'}`);
  }

  const row = Array.isArray(data) ? data[0] : data;
  const parsed = row as {
    out_event_id: string | null;
    out_credits_charged: number;
    out_tracked: boolean;
    out_already_recorded: boolean;
  } | null;

  return {
    ok: true,
    tracked: parsed?.out_tracked ?? false,
    alreadyRecorded: parsed?.out_already_recorded ?? false,
    eventId: parsed?.out_event_id ?? null,
    creditsCharged: parsed?.out_credits_charged != null ? Number(parsed.out_credits_charged) : 0,
    paused: false,
  };
}
