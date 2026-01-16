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
  visibility: z.enum(['public', 'private', 'shared']).optional(),
  account_id: commonSchemas.uuid.optional(),
  limit: z.coerce.number().int().positive().max(100).default(50),
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
        
        const { visibility, account_id, limit, offset } = validation.data;

    // Build query
    let query = supabase
      .from('map')
      .select(`
        id,
        account_id,
        title,
        description,
        visibility,
        map_style,
        type,
        custom_slug,
        tags,
        meta,
        created_at,
        updated_at,
        account:accounts!inner(
          id,
          username,
          first_name,
          last_name,
          image_url
        )
      `)
      .order('created_at', { ascending: false });

        // Apply filters
        if (visibility) {
          query = query.eq('visibility', visibility);
        }

        if (account_id) {
          query = query.eq('account_id', account_id);
        }

    // For anonymous users, only show public maps
    // For authenticated users, RLS will handle visibility (public + own private)
    if (!auth) {
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

        return createSuccessResponse({
          maps: maps || [],
          limit,
          offset,
        });
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
 * 
 * Security:
 * - Rate limited: 200 requests/minute (authenticated)
 * - Request size limit: 1MB
 * - Input validation with Zod
 * - Requires authentication
 * - Requires Pro plan
 */
const createMapSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional().nullable(),
  visibility: z.enum(['public', 'private', 'shared']).default('private'),
  map_style: z.enum(['street', 'satellite', 'light', 'dark']).default('street'),
  type: z.enum(['user', 'community', 'gov', 'professional', 'atlas', 'user-generated']).optional().nullable(),
  custom_slug: z.string().regex(/^[a-z0-9-]+$/).min(3).max(100).optional().nullable(),
  tags: z.array(z.object({
    emoji: z.string(),
    text: z.string(),
  })).max(20).default([]),
  meta: z.record(z.unknown()).default({}),
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
        
        // Verify user session is loaded
        const { data: { user: supabaseUser }, error: userError } = await supabase.auth.getUser();
        if (userError || !supabaseUser || supabaseUser.id !== userId) {
          return createErrorResponse('Authentication failed', 401);
        }
        
        // Validate request body
        const validation = await validateRequestBody(req, createMapSchema, REQUEST_SIZE_LIMITS.json);
        if (!validation.success) {
          return validation.error;
        }
        
        const {
          title,
          description,
          visibility,
          map_style,
          type,
          custom_slug,
          tags,
          meta,
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

        // Check if user has pro plan (required for map creation)
        const { data: account } = await supabase
          .from('accounts')
          .select('plan')
          .eq('id', finalAccountId)
          .single();

        const accountData = account as { plan: string } | null;
        if (accountData?.plan !== 'pro' && accountData?.plan !== 'plus') {
          return createErrorResponse('Map creation is only available for Pro subscribers. Upgrade to Pro to create maps.', 403);
        }

        // Validate custom_slug if provided (already validated in schema, but check uniqueness)
        if (custom_slug) {
          // Check if slug is already taken
          const { data: existingMap } = await supabase
            .from('map')
            .select('id')
            .eq('custom_slug', custom_slug)
            .maybeSingle();

          if (existingMap) {
            return createErrorResponse('Custom slug is already taken', 409);
          }
        }

        const insertData: Database['public']['Tables']['map']['Insert'] = {
          account_id: finalAccountId,
          title: title.trim(),
          description: description?.trim() || null,
          visibility,
          map_style: map_style as 'street' | 'satellite',
          type: type || null,
          custom_slug: custom_slug?.trim() || null,
          tags: tags || [],
          meta: meta || {},
        };

        const { data: map, error } = await supabase
          .from('map')
          .insert(insertData as any)
          .select(`
            id,
            account_id,
            title,
            description,
            visibility,
            map_style,
            type,
            custom_slug,
            tags,
            meta,
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

