import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient, createServerClientWithAuth } from '@/lib/supabaseServer';
import { getServerAuth } from '@/lib/authServer';
import { getAccountIdForUser } from '@/lib/server/getAccountId';
import { createErrorResponse, createSuccessResponse } from '@/lib/server/apiError';
import { Database } from '@/types/supabase';
import { withSecurity, REQUEST_SIZE_LIMITS } from '@/lib/security/middleware';
import { validateQueryParams, validateRequestBody } from '@/lib/security/validation';
import { z } from 'zod';
import { commonSchemas } from '@/lib/security/validation';
import { MAP_FEATURE_SLUG, checkMapLimitServer } from '@/lib/billing/mapLimits';

/**
 * GET /api/maps
 * List maps with optional filters (visibility, account_id)
 * Public maps visible to all, private maps only to owner
 * 
 * Security:
 * - Rate limited: 200 requests/minute (authenticated) or 100/min (public)
 * - Query parameter validation
 */
const mapsQuerySchema = z.object({
  visibility: z.enum(['public', 'private']).optional(),
  account_id: commonSchemas.uuid.optional(),
  category: z.enum(['community', 'professional', 'government', 'atlas', 'user']).optional(),
  community: z.coerce.boolean().optional(), // Filter by published_to_community
  limit: z.coerce.number().int().positive().max(200).default(50),
  offset: z.coerce.number().int().nonnegative().default(0),
});

export async function GET(request: NextRequest) {
  return withSecurity(
    request,
    async (req, { userId, accountId }) => {
      try {
        const auth = await getServerAuth();
        const supabase = auth 
          ? await createServerClientWithAuth(cookies())
          : createServerClient();

        // Validate query parameters
        const url = new URL(req.url);
        const validation = validateQueryParams(url.searchParams, mapsQuerySchema);
        if (!validation.success) {
          return validation.error;
        }
        
        const { visibility, account_id, category, community, limit, offset } = validation.data;

    // Build query - use new structure
    let query = supabase
      .from('map')
      .select(`
        id,
        account_id,
        name,
        description,
        slug,
        visibility,
        settings,
        member_count,
        is_active,
        published_to_community,
        published_at,
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

        // Apply filters
        if (community) {
          // Filter by published_to_community for community discovery
          query = query.eq('published_to_community', true);
          // Order by published_at (most recently published first), then created_at
          query = query.order('published_at', { ascending: false, nullsFirst: false });
          query = query.order('created_at', { ascending: false });
        } else {
          query = query.order('created_at', { ascending: false });
        }

        if (visibility) {
          query = query.eq('visibility', visibility);
        }

        if (account_id) {
          query = query.eq('account_id', account_id);
        }

        // Filter by category - TODO: Implement proper join with map_categories table
        // For now, we'll filter after fetching (or use a separate query)
        // This requires a more complex query structure

    // For anonymous users, only show public maps (unless community=true, where RLS handles private published maps)
    // For authenticated users, RLS will handle visibility (public + own private + member of)
    if (!auth && !community) {
      query = query.eq('visibility', 'public');
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

        const { data: maps, error } = await query;

        if (error) {
          if (process.env.NODE_ENV === 'development') {
            console.error('[Maps API] Error fetching maps:', error);
          }
          return createErrorResponse('Failed to fetch maps', 500);
        }

        // Add cache headers for public maps
        const headers: HeadersInit = {};
        if (!account_id && visibility === 'public') {
          headers['Cache-Control'] = 'public, s-maxage=300, stale-while-revalidate=600';
        }

        return createSuccessResponse({
          maps: maps || [],
          limit,
          offset,
        }, 200, headers);
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.error('[Maps API] Error:', error);
        }
        return createErrorResponse('Internal server error', 500);
      }
    },
    {
      rateLimit: 'authenticated', // Higher limit for authenticated, falls back to public
      requireAuth: false, // Optional auth - public maps visible to all
      maxRequestSize: REQUEST_SIZE_LIMITS.json,
    }
  );
}

/**
 * POST /api/maps
 * Create a new map (authenticated users only)
 * Simplified creation: only name, description, visibility
 * Other settings configured on map settings page
 * 
 * Security:
 * - Rate limited: 200 requests/minute (authenticated)
 * - Request size limit: 1MB
 * - Input validation with Zod
 * - Requires authentication
 * - Requires Contributor plan (pro/plus) or admin role
 * - Slug auto-generated (or custom if paying subscriber)
 * - RLS policies enforce ownership at database level
 */
const createMapSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional().nullable(),
  visibility: z.enum(['public', 'private']).default('private'),
  slug: z.string().regex(/^[a-z0-9-]+$/).min(3).max(100).optional().nullable(),
});

export async function POST(request: NextRequest) {
  return withSecurity(
    request,
    async (req, { userId, accountId }) => {
      try {
        if (!userId || !accountId) {
          return createErrorResponse('Unauthorized - authentication required', 401);
        }

        const supabase = await createServerClientWithAuth(cookies());
        
        // userId is already validated by withSecurity middleware
        // Validate request body
        const validation = await validateRequestBody(req, createMapSchema, REQUEST_SIZE_LIMITS.json);
        if (!validation.success) {
          return validation.error;
        }
        const {
          name,
          description,
          visibility,
          slug,
        } = validation.data;

        // Get account_id (already validated in security middleware)
        // accountId is guaranteed to be present when requireAuth: true
        let finalAccountId: string = accountId!;
        
        // Double-check account exists (defensive)
        if (!finalAccountId) {
          try {
            const auth = await getServerAuth();
            if (!auth) {
              return createErrorResponse('Authentication required', 401);
            }
            finalAccountId = await getAccountIdForUser(auth, supabase);
          } catch (error) {
            return createErrorResponse(
              error instanceof Error ? error.message : 'Account not found. Please complete your profile setup.',
              404
            );
          }
        }

        // Check if user has pro plan (required for map creation) or is admin
        const { data: account, error: accountError } = await supabase
          .from('accounts')
          .select('plan, role')
          .eq('id', finalAccountId)
          .single();

        if (accountError) {
          if (process.env.NODE_ENV === 'development') {
            console.error('[Maps API] Error fetching account:', accountError);
          }
          return createErrorResponse('Failed to verify account', 500);
        }

        const accountData = account as { plan: string; role: string } | null;
        const isAdmin = accountData?.role === 'admin';
        
        // Admins can bypass all limits
        if (!isAdmin) {
          // INVARIANT: Count owned maps - this is the single source of truth
          const { count: ownedMapsCount, error: mapsError } = await supabase
            .from('map')
            .select('*', { count: 'exact', head: true })
            .eq('account_id', finalAccountId);

          if (mapsError) {
            if (process.env.NODE_ENV === 'development') {
              console.error('[Maps API] Error counting user maps:', mapsError);
            }
            return createErrorResponse('Failed to check map limit', 500);
          }

          // Get feature limit using canonical slug
          const { data: mapRows, error: mapFeatureError } = await supabase.rpc('get_account_feature_limit', {
            account_id: finalAccountId,
            feature_slug: MAP_FEATURE_SLUG,
          } as any);

          const featureLimit = Array.isArray(mapRows) && (mapRows as any[]).length > 0 ? (mapRows[0] as any) : null;

          if (mapFeatureError) {
            if (process.env.NODE_ENV === 'development') {
              console.error('[Maps API] Error fetching feature limit:', mapFeatureError);
            }
            return createErrorResponse('Failed to check map limit', 500);
          }

          // Use centralized limit check (enforces invariant)
          const limitCheck = checkMapLimitServer(ownedMapsCount ?? 0, featureLimit);
          if (!limitCheck.canCreate) {
            return createErrorResponse(limitCheck.errorMessage || 'Map limit reached', 403);
          }
        }

        // Handle slug: custom if provided and user has pro/plus plan, otherwise auto-generate
        let finalSlug: string | null = null;
        if (slug) {
          // Check if user can set custom slug (pro/plus or admin)
          const canSetCustomSlug = isAdmin || accountData?.plan === 'pro' || accountData?.plan === 'plus';
          if (!canSetCustomSlug) {
            return createErrorResponse('Custom slugs are only available for pro/plus accounts or admins', 403);
          }

          // Check if slug is already taken
          const { data: existingMap } = await supabase
            .from('map')
            .select('id')
            .eq('slug', slug)
            .maybeSingle();

          if (existingMap) {
            return createErrorResponse('Custom slug is already taken', 409);
          }

          finalSlug = slug.trim();
        }

        // Initialize default settings
        const defaultSettings = {
          appearance: {
            map_style: 'street' as const,
            map_layers: {},
            meta: {},
          },
          collaboration: {
            allow_pins: false,
            allow_areas: false,
            allow_posts: false,
          },
          presentation: {
            hide_creator: false,
            is_featured: false,
          },
        };

        const insertData: Database['public']['Tables']['map']['Insert'] = {
          account_id: finalAccountId,
          name: name.trim(),
          description: description?.trim() || null,
          visibility,
          settings: defaultSettings,
          // Slug will be auto-generated by trigger if null
          slug: finalSlug,
        } as any;

        const { data: map, error } = await supabase
          .from('map')
          .insert(insertData as any)
          .select(`
            id,
            account_id,
            name,
            description,
            slug,
            visibility,
            settings,
            member_count,
            is_active,
            created_at,
            updated_at
          `)
          .single();

        if (error) {
          if (process.env.NODE_ENV === 'development') {
            console.error('[Maps API] Error creating map:', error);
          }
          return createErrorResponse('Failed to create map', 500);
        }

        return createSuccessResponse(map, 201);
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.error('[Maps API] Error:', error);
        }
        return createErrorResponse('Internal server error', 500);
      }
    },
    {
      rateLimit: 'authenticated',
      requireAuth: true,
      maxRequestSize: REQUEST_SIZE_LIMITS.json,
    }
  );
}

