import { NextRequest, NextResponse } from 'next/server';
import { withSecurity } from '@/lib/security/middleware';

/**
 * GET /api/civic/layers
 * Returns row counts for each layers schema table.
 * Used by Explore Minnesota page to render layer cards dynamically.
 */
export async function GET(request: NextRequest) {
  return withSecurity(
    request,
    async () => {
      try {
        const { createSupabaseClient } = await import('@/lib/supabase/unified');
        const supabase = await createSupabaseClient();

        const { data, error } = await supabase.rpc('get_layer_counts');

        if (error) {
          if (process.env.NODE_ENV === 'development') {
            console.error('[Layers API] Error:', error);
          }
          return NextResponse.json(
            { error: 'Failed to fetch layer counts' },
            { status: 500 }
          );
        }

        return NextResponse.json(data || {});
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.error('[Layers API] Error:', error);
        }
        return NextResponse.json(
          { error: 'Internal server error' },
          { status: 500 }
        );
      }
    },
    {
      rateLimit: 'public',
      requireAuth: false,
    }
  );
}
