import { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClientWithAuth } from '@/lib/supabaseServer';
import { createErrorResponse, createSuccessResponse } from '@/lib/server/apiError';
import { withSecurity } from '@/lib/security/middleware';

export interface FeedMap {
  id: string;
  name: string;
  slug: string | null;
}

export interface FeedPinActivity {
  id: string;
  map_id: string;
  lat: number | null;
  lng: number | null;
  description: string | null;
  caption: string | null;
  emoji: string | null;
  image_url: string | null;
  account_id: string | null;
  created_at: string;
  map: FeedMap | null;
  account: {
    id: string;
    username: string | null;
    image_url: string | null;
  } | null;
}

/**
 * GET /api/feed/pin-activity
 * Returns maps the user is part of (owner or member) and recent pin activity across those maps.
 * Requires authentication.
 */
export async function GET(request: NextRequest) {
  return withSecurity(
    request,
    async (_req, { accountId }) => {
      if (!accountId) {
        return createErrorResponse('Unauthorized', 401);
      }

      const supabase = await createServerClientWithAuth(cookies());

      // 1. Owned map IDs
      const { data: ownedMaps, error: ownedError } = await supabase
        .from('map')
        .select('id')
        .eq('account_id', accountId)
        .eq('is_active', true);

      if (ownedError) {
        return createErrorResponse('Failed to fetch maps', 500);
      }

      // 2. Member map IDs (map_members)
      const { data: memberRows, error: memberError } = await supabase
        .from('map_members')
        .select('map_id')
        .eq('account_id', accountId);

      if (memberError) {
        return createErrorResponse('Failed to fetch member maps', 500);
      }

      const ownedIds = (ownedMaps || []).map((m: { id: string }) => m.id);
      const memberIds = (memberRows || []).map((m: { map_id: string }) => m.map_id);
      const mapIds = Array.from(new Set([...ownedIds, ...memberIds]));

      if (mapIds.length === 0) {
        return createSuccessResponse({
          maps: [],
          activity: [],
        });
      }

      // 3. Maps list for header (id, name, slug)
      const { data: mapsData, error: mapsError } = await supabase
        .from('map')
        .select('id, name, slug')
        .in('id', mapIds)
        .eq('is_active', true)
        .order('name', { ascending: true });

      if (mapsError) {
        return createErrorResponse('Failed to fetch maps list', 500);
      }

      const maps: FeedMap[] = (mapsData || []).map((m: { id: string; name: string; slug: string | null }) => ({
        id: m.id,
        name: m.name ?? '',
        slug: m.slug ?? null,
      }));

      // 4. Recent pin activity across those maps (with map + account, lat/lng for zoom-to-pin)
      const { data: pins, error: pinsError } = await supabase
        .from('map_pins')
        .select(
          `
          id,
          map_id,
          lat,
          lng,
          description,
          caption,
          emoji,
          image_url,
          account_id,
          created_at,
          map:map(id,name,slug),
          account:accounts(id,username,image_url)
        `
        )
        .in('map_id', mapIds)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(50);

      if (pinsError) {
        return createErrorResponse('Failed to fetch pin activity', 500);
      }

      const activity: FeedPinActivity[] = (pins || []).map((p: any) => {
        const acc = p.account ?? p.accounts ?? null;
        return {
          id: p.id,
          map_id: p.map_id,
          lat: p.lat != null && Number.isFinite(p.lat) ? p.lat : null,
          lng: p.lng != null && Number.isFinite(p.lng) ? p.lng : null,
          description: p.description ?? null,
          caption: p.caption ?? null,
          emoji: p.emoji ?? null,
          image_url: p.image_url ?? null,
          account_id: p.account_id ?? null,
          created_at: p.created_at,
          map: p.map
            ? {
                id: p.map.id,
                name: p.map.name ?? '',
                slug: p.map.slug ?? null,
              }
            : null,
          account: acc
            ? {
                id: acc.id,
                username: acc.username ?? null,
                image_url: acc.image_url ?? null,
              }
            : null,
        };
      });

      return createSuccessResponse({
        maps,
        activity,
      });
    },
    {
      rateLimit: 'authenticated',
      requireAuth: true,
    }
  );
}
