import { NextRequest, NextResponse } from 'next/server';
import { createServerClientWithAuth } from '@/lib/supabaseServer';
import { withSecurity } from '@/lib/security/middleware';
import { createErrorResponse, createSuccessResponse } from '@/lib/server/apiError';
import { requireAdmin } from '@/lib/security/accessControl';
import { cookies } from 'next/headers';

/**
 * GET /api/maps/live/mentions/admin
 * Admin-only endpoint to fetch pins from maps.pins table
 * Requires admin role
 */
export async function GET(request: NextRequest) {
  return withSecurity(
    request,
    async (req) => {
      // Check admin role
      const adminCheck = await requireAdmin(cookies());
      if (!adminCheck.success) {
        return adminCheck.error;
      }

      try {
        const supabase = await createServerClientWithAuth(cookies());
        
        // Use RPC function to fetch pins from maps.pins
        const { data: pinsResult, error } = await supabase.rpc('fetch_live_map_pins');
        
        if (error) {
          console.error('[Admin Mentions API] Error fetching pins:', error);
          return createErrorResponse('Failed to fetch admin pins', 500);
        }
        
        // Transform to match Mention format
        const mentions = (pinsResult || []).map((pin: any) => ({
          id: pin.id,
          map_id: pin.map_id,
          lat: pin.lat,
          lng: pin.lng,
          description: pin.body,
          image_url: pin.image_url,
          video_url: pin.video_url,
          media_type: pin.media_type,
          account_id: pin.author_account_id,
          mention_type_id: pin.tag_id,
          visibility: pin.visibility,
          archived: pin.archived,
          post_date: pin.post_date,
          created_at: pin.created_at,
          updated_at: pin.updated_at,
          view_count: pin.view_count,
          account: pin.account_data ? {
            id: pin.account_data.id,
            username: pin.account_data.username,
            first_name: pin.account_data.first_name,
            image_url: pin.account_data.image_url,
          } : null,
          mention_type: pin.tag_data ? {
            id: pin.tag_data.id,
            emoji: pin.tag_data.emoji,
            name: pin.tag_data.name,
          } : null,
        }));
        
        return NextResponse.json({
          mentions,
          count: mentions.length,
          source: 'maps.pins',
        });
      } catch (error) {
        console.error('[Admin Mentions API] Error:', error);
        return createErrorResponse(
          error instanceof Error ? error.message : 'Failed to fetch admin mentions',
          500
        );
      }
    },
    {
      rateLimit: 'authenticated',
      requireAuth: true,
      maxRequestSize: 1024,
    }
  );
}
