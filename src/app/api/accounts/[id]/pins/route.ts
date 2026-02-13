import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClientWithAuth } from '@/lib/supabaseServer';
import { withSecurity } from '@/lib/security/middleware';
import { MAP_CONFIG } from '@/features/map/config';

/**
 * GET /api/accounts/[id]/pins
 * List pins for an account. Requires auth; [id] must match authenticated account.
 * Query: collection_id (optional), visibility (optional), limit, offset.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withSecurity(
    request,
    async (req, { accountId }) => {
      const { id } = await params;
      if (!accountId || accountId !== id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      const { searchParams } = new URL(request.url);
      const collectionId = searchParams.get('collection_id') ?? undefined;
      const visibility = searchParams.get('visibility') ?? undefined;
      const limit = Math.min(parseInt(searchParams.get('limit') ?? '50', 10), 100);
      const offset = parseInt(searchParams.get('offset') ?? '0', 10);

      const supabase = await createServerClientWithAuth(cookies());
      let query = supabase
        .from('map_pins')
        .select(
          `
          id, lat, lng, description, visibility, city_id, collection_id, mention_type_id, map_id,
          image_url, video_url, media_type, view_count, created_at, updated_at,
          collections (id, emoji, title),
          mention_types (id, emoji, name)
        `,
          { count: 'exact' }
        )
        .eq('account_id', id)
        .eq('archived', false)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (collectionId) query = query.eq('collection_id', collectionId);
      if (visibility) query = query.eq('visibility', visibility);

      const { data, error, count } = await query;

      if (error) {
        if (process.env.NODE_ENV === 'development') console.error('[Pins API]', error);
        return NextResponse.json({ error: 'Failed to fetch pins' }, { status: 500 });
      }
      return NextResponse.json({
        pins: data ?? [],
        total: count ?? 0,
        limit,
        offset,
      });
    },
    { requireAuth: true, rateLimit: 'authenticated' }
  );
}

/**
 * POST /api/accounts/[id]/pins
 * Create a pin. Requires auth; [id] must match authenticated account.
 * Body: lat, lng (required); collection_id, mention_type_id, description, image_url, video_url, visibility, etc.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withSecurity(
    request,
    async (req, { accountId }) => {
      const { id } = await params;
      if (!accountId || accountId !== id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      const body = await request.json().catch(() => ({})) as Record<string, unknown>;
      const lat = typeof body.lat === 'number' ? body.lat : parseFloat(String(body.lat ?? ''));
      const lng = typeof body.lng === 'number' ? body.lng : parseFloat(String(body.lng ?? ''));
      if (Number.isNaN(lat) || Number.isNaN(lng)) {
        return NextResponse.json({ error: 'lat and lng are required numbers' }, { status: 400 });
      }
      const { north, south, east, west } = MAP_CONFIG.MINNESOTA_BOUNDS;
      if (lat < south || lat > north || lng < west || lng > east) {
        return NextResponse.json({ error: 'Location must be within Minnesota' }, { status: 400 });
      }
      const row = {
        account_id: id,
        lat,
        lng,
        description: typeof body.description === 'string' ? body.description : null,
        collection_id: typeof body.collection_id === 'string' ? body.collection_id : null,
        mention_type_id: typeof body.mention_type_id === 'string' ? body.mention_type_id : null,
        image_url: typeof body.image_url === 'string' ? body.image_url : null,
        video_url: typeof body.video_url === 'string' ? body.video_url : null,
        visibility: (body.visibility === 'only_me' ? 'only_me' : 'public') as 'public' | 'only_me',
        media_type: (body.media_type === 'image' || body.media_type === 'video' ? body.media_type : 'none') as 'image' | 'video' | 'none',
        full_address: typeof body.full_address === 'string' ? body.full_address : null,
        city_id: typeof body.city_id === 'string' ? body.city_id : null,
      };

      const supabase = await createServerClientWithAuth(cookies());
      const { data, error } = await supabase
        .from('map_pins')
        .insert(row)
        .select(
          `
          id, lat, lng, description, visibility, city_id, collection_id, mention_type_id, map_id,
          image_url, video_url, media_type, view_count, created_at, updated_at,
          collections (id, emoji, title),
          mention_types (id, emoji, name)
        `
        )
        .single();

      if (error) {
        if (process.env.NODE_ENV === 'development') console.error('[Pins API]', error);
        return NextResponse.json({ error: 'Failed to create pin' }, { status: 500 });
      }
      return NextResponse.json({ pin: data });
    },
    { requireAuth: true, rateLimit: 'authenticated' }
  );
}
