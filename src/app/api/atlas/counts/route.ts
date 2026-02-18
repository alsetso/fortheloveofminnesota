import { NextRequest, NextResponse } from 'next/server';
import { withSecurity } from '@/lib/security/middleware';

/**
 * GET /api/atlas/counts
 * Returns row counts for each atlas schema table.
 */
export async function GET(request: NextRequest) {
  return withSecurity(
    request,
    async () => {
      try {
        const { createSupabaseClient } = await import('@/lib/supabase/unified');
        const supabase = await createSupabaseClient();

        const { data, error } = await supabase.rpc('get_atlas_counts');

        if (error) {
          if (process.env.NODE_ENV === 'development') {
            console.error('[Atlas Counts API] Error:', error);
          }
          return NextResponse.json({ error: 'Failed to fetch atlas counts' }, { status: 500 });
        }

        return NextResponse.json(data || {});
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.error('[Atlas Counts API] Error:', error);
        }
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
      }
    },
    {
      rateLimit: 'public',
      requireAuth: false,
    }
  );
}
