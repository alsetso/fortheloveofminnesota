import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { Database } from '@/types/supabase';
import { withSecurity, REQUEST_SIZE_LIMITS } from '@/lib/security/middleware';
import { validateRequestBody } from '@/lib/security/validation';
import { z } from 'zod';
import { commonSchemas } from '@/lib/security/validation';

/**
 * POST /api/analytics/map-view
 * Records a map view using the map_views system
 * 
 * Security:
 * - Rate limited: 100 requests/minute (public)
 * - Request size limit: 1MB
 * - Input validation with Zod
 * - Optional authentication (tracks anonymous views)
 */
const mapViewSchema = z.object({
  map_id: commonSchemas.uuid,
  referrer_url: z.string().url().max(2000).optional().nullable(),
  session_id: z.string().max(200).optional().nullable(),
  user_agent: z.string().max(500).optional().nullable(),
});

export async function POST(request: NextRequest) {
  return withSecurity(
    request,
    async (req, { userId, accountId }) => {
      try {
        // Validate request body
        const validation = await validateRequestBody(req, mapViewSchema, REQUEST_SIZE_LIMITS.json);
        if (!validation.success) {
          return validation.error;
        }
        
        const { map_id, referrer_url, session_id, user_agent } = validation.data;

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    const cookieStore = await cookies();
    const supabase = createServerClient<Database>(
      supabaseUrl,
      supabaseAnonKey,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll() {
            // Route handlers can set cookies - no-op for read operations
          },
        },
      }
    );

        // Use accountId from security middleware context if available
        const finalAccountId = accountId || null;

        // Record map view using record_map_view function
        const { data, error } = await supabase.rpc('record_map_view', {
          p_map_id: map_id,
          p_account_id: finalAccountId,
          p_user_agent: user_agent || null,
          p_referrer_url: referrer_url || null,
          p_session_id: session_id || null,
        } as any) as { data: string | null; error: any };

        if (error) {
          if (process.env.NODE_ENV === 'development') {
            console.error('[Map View API] Error recording map view:', error);
          }
          return NextResponse.json(
            { error: 'Failed to record map view' },
            { status: 500 }
          );
        }

        return NextResponse.json({ 
          success: true,
          view_id: data 
        });
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.error('[Map View API] Error:', error);
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
      maxRequestSize: REQUEST_SIZE_LIMITS.json,
    }
  );
}

