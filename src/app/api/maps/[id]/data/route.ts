import { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient, createServerClientWithAuth } from '@/lib/supabaseServer';
import { createErrorResponse, createSuccessResponse } from '@/lib/server/apiError';
import { withSecurity, REQUEST_SIZE_LIMITS } from '@/lib/security/middleware';
import { validatePathParams } from '@/lib/security/validation';
import { z } from 'zod';
import { getRequestAuth } from '@/lib/security/authContext';
import { Database } from '@/types/supabase';

const mapIdPathSchema = z.object({
  id: z.string().min(1).max(200),
});

function isUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

/**
 * GET /api/maps/[id]/data
 * Aggregate endpoint: returns map + stats + pins + areas + members in one call
 * Reduces 6 API calls to 1, with single auth check
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withSecurity(
    request,
    async (req, { userId, accountId }) => {
      try {
        const { id } = await params;
        
        const pathValidation = validatePathParams({ id }, mapIdPathSchema);
        if (!pathValidation.success) {
          return pathValidation.error;
        }
        
        const { id: identifier } = pathValidation.data;
        const auth = await getRequestAuth(req); // Uses cached auth
        
        const supabase = auth?.userId
          ? await createServerClientWithAuth(cookies())
          : createServerClient();

        // Resolve identifier to map_id (handle both UUID and slug)
        let mapId: string;
        let mapQuery = supabase
          .from('map')
          .select(`
            id,
            account_id,
            name,
            description,
            slug,
            visibility,
            settings,
            boundary,
            boundary_data,
            member_count,
            is_active,
            auto_approve_members,
            membership_rules,
            membership_questions,
            tags,
            created_at,
            updated_at,
            account:accounts!map_account_id_fkey(
              id,
              username,
              first_name,
              last_name,
              image_url
            )
          `)
          .eq('is_active', true);
        
        if (isUUID(identifier)) {
          mapQuery = mapQuery.eq('id', identifier);
        } else {
          mapQuery = mapQuery.eq('slug', identifier);
        }

        // If authenticated, also get user's member role
        if (accountId) {
          mapQuery = mapQuery.select(`
            *,
            current_user_member:map_members!left(
              role
            )
          `);
        }

        const { data: map, error: mapError } = await mapQuery.single();

        if (mapError || !map) {
          if (mapError?.code === 'PGRST116' || mapError?.message?.includes('row-level security')) {
            return createErrorResponse('You do not have access to this map', 403);
          }
          return createErrorResponse('Map not found', 404);
        }

        mapId = (map as any).id;

        // Parallel queries for all data
        const [statsResult, pinsResult, areasResult, membersResult] = await Promise.all([
          // Stats using RPC function
          (async () => {
            const result = await (supabase.rpc as any)('get_url_stats', {
              p_url: `/map/${mapId}`,
              p_hours: null,
            });
            return result as { data: Array<{ total_views: number; unique_viewers: number; accounts_viewed: number }> | null; error: any };
          })(),
          
          // Pins
          supabase
            .from('map_pins')
            .select('*')
            .eq('map_id', mapId)
            .eq('is_active', true)
            .order('created_at', { ascending: false }),
          
          // Areas
          supabase
            .from('map_areas')
            .select('*')
            .eq('map_id', mapId)
            .eq('is_active', true)
            .order('created_at', { ascending: false }),
          
          // Members (only if authenticated)
          auth?.userId && accountId
            ? supabase
                .from('map_members')
                .select(`
                  id,
                  map_id,
                  account_id,
                  role,
                  joined_at,
                  account:accounts!map_members_account_id_fkey(
                    id,
                    username,
                    first_name,
                    last_name,
                    image_url
                  )
                `)
                .eq('map_id', mapId)
                .order('joined_at', { ascending: true })
            : Promise.resolve({ data: null, error: null }),
        ]);

        // Extract stats from RPC result
        const stats = statsResult.data && statsResult.data.length > 0
          ? statsResult.data[0]
          : { total_views: 0, unique_viewers: 0, accounts_viewed: 0 };

        return createSuccessResponse({
          map,
          stats: {
            success: true,
            stats,
          },
          pins: pinsResult.data || [],
          areas: areasResult.data || [],
          members: membersResult.data || null,
        }, 200, {
          'Cache-Control': 'private, s-maxage=60, stale-while-revalidate=300',
        });
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.error('[Maps Data API] Error:', error);
        }
        return createErrorResponse('Internal server error', 500);
      }
    },
    {
      rateLimit: 'authenticated',
      requireAuth: false,
      maxRequestSize: REQUEST_SIZE_LIMITS.json,
    }
  );
}
