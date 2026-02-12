import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClientWithAuth } from '@/lib/supabaseServer';
import { withSecurity } from '@/lib/security/middleware';

/**
 * GET /api/pins
 * Get all pins for the authenticated user's account
 * 
 * Security:
 * - Rate limited: 200 requests/minute (authenticated)
 * - Requires authentication
 */
export async function GET(request: NextRequest) {
  return withSecurity(
    request,
    async (req, { accountId }) => {
      try {
        if (!accountId) {
          return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const supabase = await createServerClientWithAuth(cookies());
        const { searchParams } = new URL(req.url);
        const limit = parseInt(searchParams.get('limit') || '50');
        const offset = parseInt(searchParams.get('offset') || '0');

        // Fetch pins from public.map_pins (profile source of truth)
        const { data: pins, error } = await supabase
          .from('map_pins')
          .select(
            `
            id, lat, lng, description, visibility, city_id, collection_id, mention_type_id, map_id,
            image_url, video_url, media_type, view_count, created_at, updated_at, account_id,
            collections (id, emoji, title),
            mention_types (id, emoji, name)
          `
          )
          .eq('account_id', accountId)
          .eq('is_active', true)
          .eq('archived', false)
          .order('created_at', { ascending: false })
          .range(offset, offset + limit - 1);

        if (error) {
          console.error('[Pins API] Error fetching pins:', error);
          return NextResponse.json({ error: 'Failed to fetch pins' }, { status: 500 });
        }

        const { count } = await supabase
          .from('map_pins')
          .select('*', { count: 'exact', head: true })
          .eq('account_id', accountId)
          .eq('is_active', true)
          .eq('archived', false);

        return NextResponse.json({
          pins: pins || [],
          total: count || 0,
          limit,
          offset,
        });
      } catch (error) {
        console.error('[Pins API] Error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
      }
    },
    {
      requireAuth: true,
      rateLimit: 'authenticated',
    }
  );
}
