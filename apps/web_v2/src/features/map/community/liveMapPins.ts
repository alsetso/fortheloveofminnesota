import type { Feature, FeatureCollection, Point } from 'geojson';
import { resolveAccountMapPinIconImageId } from '@/features/map/community/accountMapPinIcons';

export type LiveMapPin = {
  id: string;
  lat: number;
  lng: number;
  body: string | null;
  emoji: string | null;
  full_address: string | null;
  account_id: string | null;
  created_at: string;
  like_count: number;
  comment_count: number;
  view_count: number;
  /** 0 = unread (green ring), 1 = seen / own / signed out. */
  seen_by_me?: number;
  mention_type: { id: string; name: string; emoji: string } | null;
  account: {
    id: string;
    username: string | null;
    image_url: string | null;
  } | null;
};

export type LiveMapPinsTime = 'all' | '24h' | '7d';

/** Convert API pins → Mapbox GeoJSON (Point features, promoteId = id). */
export function livePinsToFeatureCollection(pins: LiveMapPin[]): FeatureCollection {
  const features: Feature<Point>[] = [];
  for (const pin of pins) {
    if (!Number.isFinite(pin.lat) || !Number.isFinite(pin.lng)) continue;
    const accountId = pin.account?.id ?? pin.account_id;
    const imageUrl = pin.account?.image_url ?? null;
    features.push({
      type: 'Feature',
      id: pin.id,
      geometry: {
        type: 'Point',
        coordinates: [pin.lng, pin.lat],
      },
      properties: {
        id: pin.id,
        body: pin.body,
        emoji: pin.emoji || pin.mention_type?.emoji || '📍',
        title: pin.mention_type?.name || 'Pin',
        address: pin.full_address,
        created_at: pin.created_at,
        like_count: pin.like_count,
        comment_count: pin.comment_count,
        seen_by_me: pin.seen_by_me === 0 ? 0 : 1,
        account_id: accountId,
        account_image_url: imageUrl,
        icon_image_id: resolveAccountMapPinIconImageId(accountId, imageUrl),
        username: pin.account?.username ?? null,
      },
    });
  }
  return { type: 'FeatureCollection', features };
}

export async function fetchLiveMapPins(
  time: LiveMapPinsTime = 'all',
  signal?: AbortSignal,
): Promise<LiveMapPin[]> {
  const res = await fetch(`/api/maps/live/data?time=${encodeURIComponent(time)}`, {
    cache: 'no-store',
    credentials: 'include',
    signal,
  });
  if (!res.ok) {
    throw new Error('Failed to load community pins');
  }
  const json = (await res.json()) as { pins?: LiveMapPin[]; error?: string };
  if (json.error) throw new Error(json.error);
  return json.pins ?? [];
}
