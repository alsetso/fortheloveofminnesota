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

export interface FeedPinActivityMentionType {
  id: string;
  emoji: string;
  name: string;
}

export interface FeedPinActivityTaggedAccount {
  id: string;
  username: string | null;
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
  video_url: string | null;
  media_type: 'image' | 'video' | 'none' | null;
  account_id: string | null;
  created_at: string;
  map: FeedMap | null;
  account: {
    id: string;
    username: string | null;
    image_url: string | null;
  } | null;
  mention_type: FeedPinActivityMentionType | null;
  /** Tagged users on this pin (from tagged_account_ids); only present when pin has tagged users */
  tagged_accounts: FeedPinActivityTaggedAccount[] | null;
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

      // Optional: filter pins to a specific account (only allowed for the logged-in account)
      const { searchParams } = new URL(request.url);
      const filterAccountId = searchParams.get('account_id');
      const pinAccountFilter =
        filterAccountId && filterAccountId === accountId ? filterAccountId : null;

      // 4. Pin activity: pins on maps the logged-in account owns or is a member of; optionally only by that account
      let pinsQuery = supabase
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
          video_url,
          media_type,
          account_id,
          tagged_account_ids,
          created_at,
          map:map(id,name,slug),
          account:accounts(id,username,image_url),
          mention_type:mention_types(id,emoji,name)
        `
        )
        .in('map_id', mapIds)
        .eq('archived', false)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(50);

      if (pinAccountFilter) {
        pinsQuery = pinsQuery.eq('account_id', pinAccountFilter);
      }

      const { data: pins, error: pinsError } = await pinsQuery;

      if (pinsError) {
        return createErrorResponse('Failed to fetch pin activity', 500);
      }

      // Resolve tagged account IDs to usernames (only for pins that have tagged_account_ids)
      const taggedIds = new Set<string>();
      (pins || []).forEach((p: any) => {
        const ids = p.tagged_account_ids;
        if (Array.isArray(ids)) ids.forEach((id: string) => typeof id === 'string' && taggedIds.add(id));
      });
      const taggedAccountsMap = new Map<string, { id: string; username: string | null }>();
      if (taggedIds.size > 0) {
        const { data: taggedRows } = await supabase
          .from('accounts')
          .select('id, username')
          .in('id', Array.from(taggedIds));
        (taggedRows || []).forEach((r: { id: string; username: string | null }) => {
          taggedAccountsMap.set(r.id, { id: r.id, username: r.username ?? null });
        });
      }

      const activity: FeedPinActivity[] = (pins || []).map((p: any) => {
        const acc = p.account ?? p.accounts ?? null;
        const mt = p.mention_type ?? null;
        const rawTagged = p.tagged_account_ids;
        const taggedIdsList = Array.isArray(rawTagged) ? rawTagged as string[] : [];
        const tagged_accounts =
          taggedIdsList.length > 0
            ? taggedIdsList
                .map((id: string) => taggedAccountsMap.get(id))
                .filter(Boolean) as { id: string; username: string | null }[]
            : null;
        return {
          id: p.id,
          map_id: p.map_id,
          lat: p.lat != null && Number.isFinite(p.lat) ? p.lat : null,
          lng: p.lng != null && Number.isFinite(p.lng) ? p.lng : null,
          description: p.description ?? null,
          caption: p.caption ?? null,
          emoji: p.emoji ?? null,
          image_url: p.image_url ?? null,
          video_url: p.video_url ?? null,
          media_type: p.media_type ?? null,
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
          mention_type: mt
            ? { id: mt.id, emoji: mt.emoji ?? '', name: mt.name ?? '' }
            : null,
          tagged_accounts: tagged_accounts && tagged_accounts.length > 0 ? tagged_accounts : null,
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
