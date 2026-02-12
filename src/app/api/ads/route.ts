import { NextRequest, NextResponse } from 'next/server';
import { createServerClientWithAuth } from '@/lib/supabaseServer';
import { withSecurity } from '@/lib/security/middleware';
import { cookies } from 'next/headers';

/**
 * GET /api/ads
 * Fetch active ads for display
 * 
 * Security:
 * - Rate limited: 200 requests/minute
 * - Optional authentication
 */
export async function GET(request: NextRequest) {
  return withSecurity(
    request,
    async (req) => {
      try {
        const supabase = await createServerClientWithAuth(cookies());
        const { searchParams } = new URL(req.url);
        const limit = parseInt(searchParams.get('limit') || '1', 10);

        // Fetch active ads from ads.ads table
        const { data: ads, error } = await supabase
          .schema('ads')
          .from('ads')
          .select(`
            id,
            campaign_id,
            title,
            description,
            image_url,
            link_url,
            ad_type,
            status,
            created_at
          `)
          .eq('status', 'active')
          .order('created_at', { ascending: false })
          .limit(limit);

        if (error) {
          console.error('[Ads API] Error fetching ads:', error);
          return NextResponse.json(
            { error: 'Failed to fetch ads' },
            { status: 500 }
          );
        }

        return NextResponse.json({ ads: ads || [] });
      } catch (error) {
        console.error('[Ads API] Error:', error);
        return NextResponse.json(
          { error: 'Internal server error' },
          { status: 500 }
        );
      }
    },
    {
      rateLimit: 'public',
    }
  );
}
