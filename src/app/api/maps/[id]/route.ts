import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient, createServerClientWithAuth } from '@/lib/supabaseServer';
import { getServerAuth } from '@/lib/authServer';
import { getAccountIdForUser } from '@/lib/server/getAccountId';
import { createErrorResponse, createSuccessResponse } from '@/lib/server/apiError';
import { Database } from '@/types/supabase';
import { withSecurity, REQUEST_SIZE_LIMITS } from '@/lib/security/middleware';
import { validatePathParams, validateRequestBody } from '@/lib/security/validation';
import { z } from 'zod';
import { commonSchemas } from '@/lib/security/validation';

/**
 * GET /api/maps/[id]
 * Get a single map by ID or custom_slug
 * 
 * Security:
 * - Rate limited: 200 requests/minute (authenticated) or 100/min (public)
 * - Path parameter validation
 * - Optional authentication (RLS handles permissions)
 * - Supports both UUID and custom_slug lookup
 */
const mapIdPathSchema = z.object({
  id: z.string().min(1).max(200), // Accept both UUID and slug
});

// Helper to check if string is a valid UUID
function isUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withSecurity(
    request,
    async (req, { userId, accountId }) => {
      try {
        const { id } = await params;
        
        // Validate path parameters
        const pathValidation = validatePathParams({ id }, mapIdPathSchema);
        if (!pathValidation.success) {
          return pathValidation.error;
        }
        
        const { id: identifier } = pathValidation.data;
        
        const auth = await getServerAuth();
        const supabase = auth 
          ? await createServerClientWithAuth(cookies())
          : createServerClient();

        // Build query - try slug first if not UUID, otherwise try id
        let query = supabase
          .from('map')
          .select(`
            id,
            account_id,
            title,
            description,
            visibility,
            map_style,
            map_layers,
            type,
            collection_type,
            custom_slug,
            is_primary,
            hide_creator,
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
          `);

        // Check if identifier is a UUID or a slug
        if (isUUID(identifier)) {
          query = query.eq('id', identifier);
        } else {
          // Assume it's a custom_slug
          query = query.eq('custom_slug', identifier);
        }

        const { data: map, error } = await query.single();

        if (error || !map) {
          // Check if it's a permission error (RLS blocked access)
          if (error?.code === 'PGRST116' || error?.message?.includes('row-level security')) {
            return createErrorResponse('You do not have access to this map', 403);
          }
          return createErrorResponse('Map not found', 404);
        }

        // RLS already handles permission checks, so if we get here, user has access
        return createSuccessResponse(map);
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.error('[Maps API] Error:', error);
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

/**
 * PUT /api/maps/[id]
 * Update a map (owner only)
 * 
 * Security:
 * - Rate limited: 200 requests/minute (authenticated)
 * - Request size limit: 1MB
 * - Input validation with Zod
 * - Requires authentication
 * - Ownership check required
 */
const updateMapSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional().nullable(),
  visibility: z.enum(['public', 'private', 'shared']).optional(),
  map_style: z.enum(['street', 'satellite', 'light', 'dark']).optional(),
  type: z.enum(['user', 'community', 'gov', 'professional', 'atlas', 'user-generated']).optional().nullable(),
  collection_type: z.enum(['community', 'professional', 'user', 'atlas', 'gov']).optional().nullable(),
  custom_slug: z.string().regex(/^[a-z0-9-]+$/).min(3).max(100).optional().nullable(),
  is_primary: z.boolean().optional(),
  hide_creator: z.boolean().optional(),
  tags: z.array(z.object({
    emoji: z.string(),
    text: z.string(),
  })).max(20).optional(),
  meta: z.record(z.string(), z.unknown()).optional(),
  map_layers: z.record(z.string(), z.boolean()).optional(),
});

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withSecurity(
    request,
    async (req, { userId, accountId }) => {
      try {
        const { id } = await params;
        
        // Validate path parameters
        const pathValidation = validatePathParams({ id }, mapIdPathSchema);
        if (!pathValidation.success) {
          return pathValidation.error;
        }
        
        const { id: identifier } = pathValidation.data;
        
        if (!userId || !accountId) {
          if (process.env.NODE_ENV === 'development') {
            console.error('[Maps API PUT] Missing auth:', { userId: !!userId, accountId: !!accountId });
          }
          return createErrorResponse('Unauthorized - authentication required', 401);
        }

        const cookieStore = await cookies();
        const supabase = await createServerClientWithAuth(cookieStore);
        
        // Validate request body
        const validation = await validateRequestBody(req, updateMapSchema, REQUEST_SIZE_LIMITS.json);
        if (!validation.success) {
          return validation.error;
        }
        
        const body = validation.data;

        // Resolve identifier to map_id (handle both UUID and slug)
        let mapId: string;
        let mapQuery = supabase
          .from('map')
          .select('id, account_id');
        
        if (isUUID(identifier)) {
          mapQuery = mapQuery.eq('id', identifier);
        } else {
          mapQuery = mapQuery.eq('custom_slug', identifier);
        }

        // Check if user owns the map
        const { data: map, error: mapError } = await mapQuery.single();

        if (mapError || !map) {
          return createErrorResponse('Map not found', 404);
        }

        const mapData = map as { account_id: string; id: string };
        mapId = mapData.id;
        
        if (accountId !== mapData.account_id) {
          return createErrorResponse('Forbidden - you do not own this map', 403);
        }

        // Build update data
        const updateData: Partial<Database['public']['Tables']['map']['Update']> = {};

        if (body.title !== undefined) {
          updateData.title = body.title.trim();
        }

        if (body.description !== undefined) {
          updateData.description = body.description?.trim() || null;
        }

        if (body.visibility !== undefined) {
          updateData.visibility = body.visibility;
        }

        if (body.map_style !== undefined) {
          updateData.map_style = body.map_style;
        }

        if (body.meta !== undefined) {
          updateData.meta = body.meta;
        }

        if (body.map_layers !== undefined) {
          updateData.map_layers = body.map_layers as any;
        }

        // Get admin status once if needed for type or collection_type validation
        let isAdminForCollection = false;
        if (body.type !== undefined || body.collection_type !== undefined) {
          const { data: accountRow } = await supabase
            .from('accounts')
            .select('role')
            .eq('id', accountId)
            .single();
          const role = (accountRow as { role?: string } | null)?.role;
          isAdminForCollection = role === 'admin';
        }

        if (body.type !== undefined) {
          const nextType = body.type || null;

          // Non-admins may only keep/default to 'community'
          if (!isAdminForCollection && nextType && nextType !== 'community') {
            return createErrorResponse('Only admins can change collection type', 403);
          }

          updateData.type = nextType || 'community';
        }

        if (body.collection_type !== undefined) {
          // Non-admins can only set collection_type to 'community' or null
          if (!isAdminForCollection && body.collection_type && body.collection_type !== 'community') {
            return createErrorResponse('Only admins can set collection_type to values other than "community"', 403);
          }

          updateData.collection_type = body.collection_type || null;
        }

        if (body.custom_slug !== undefined) {
          // Check if user is admin (admins can set custom_slug without pro plan)
          const { data: account } = await supabase
            .from('accounts')
            .select('plan, role')
            .eq('id', accountId)
            .single();

          const accountData = account as { plan: string; role: string } | null;
          const isAdmin = accountData?.role === 'admin';
          
          // Non-admins need pro/plus plan for custom_slug
          if (body.custom_slug && !isAdmin && accountData?.plan !== 'pro' && accountData?.plan !== 'plus') {
            return createErrorResponse('Custom slugs are only available for pro accounts or admins', 403);
          }

          if (body.custom_slug) {
            // Check if slug is already taken (excluding current map)
            const { data: existingMap } = await supabase
              .from('map')
              .select('id')
              .eq('custom_slug', body.custom_slug)
              .neq('id', mapId)
              .maybeSingle();

            if (existingMap) {
              return createErrorResponse('Custom slug is already taken', 409);
            }
          }
          updateData.custom_slug = body.custom_slug?.trim() || null;
        }

        if (body.is_primary !== undefined || body.hide_creator !== undefined) {
          // Get admin status for is_primary and hide_creator
          const { data: accountRow } = await supabase
            .from('accounts')
            .select('role')
            .eq('id', accountId)
            .single();

          const role = (accountRow as { role?: string } | null)?.role;
          const isAdmin = role === 'admin';

          if (!isAdmin) {
            return createErrorResponse('Admin role required to set is_primary or hide_creator', 403);
          }

          if (body.is_primary !== undefined) {
            updateData.is_primary = body.is_primary;
          }

          if (body.hide_creator !== undefined) {
            updateData.hide_creator = body.hide_creator;
          }
        }

        if (body.tags !== undefined) {
          updateData.tags = body.tags;
        }

        const { data: updatedMap, error: updateError } = await (supabase
          .from('map') as any)
          .update(updateData)
          .eq('id', mapId)
          .select(`
            id,
            account_id,
            title,
            description,
            visibility,
            map_style,
            map_layers,
            type,
            collection_type,
            custom_slug,
            is_primary,
            hide_creator,
            tags,
            meta,
            created_at,
            updated_at
          `)
          .single();

        if (updateError) {
          if (process.env.NODE_ENV === 'development') {
            console.error('[Maps API] Error updating map:', updateError);
          }
          return createErrorResponse('Failed to update map', 500);
        }

        return createSuccessResponse(updatedMap);
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

/**
 * DELETE /api/maps/[id]
 * Delete a map (owner only)
 * 
 * Security:
 * - Rate limited: 200 requests/minute (authenticated)
 * - Path parameter validation
 * - Requires authentication
 * - Ownership check required
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withSecurity(
    request,
    async (req, { userId, accountId }) => {
      try {
        const { id } = await params;
        
        // Validate path parameters
        const pathValidation = validatePathParams({ id }, mapIdPathSchema);
        if (!pathValidation.success) {
          return pathValidation.error;
        }
        
        const { id: identifier } = pathValidation.data;
        
        if (!userId || !accountId) {
          return createErrorResponse('Unauthorized - authentication required', 401);
        }

        const supabase = await createServerClientWithAuth(cookies());

        // Resolve identifier to map_id (handle both UUID and slug)
        let mapId: string;
        let mapQuery = supabase
          .from('map')
          .select('account_id, id');
        
        if (isUUID(identifier)) {
          mapQuery = mapQuery.eq('id', identifier);
        } else {
          mapQuery = mapQuery.eq('custom_slug', identifier);
        }

        // Check if user owns the map
        const { data: map, error: mapError } = await mapQuery.single();

        if (mapError || !map) {
          return createErrorResponse('Map not found', 404);
        }

        const mapDataDelete = map as { account_id: string; id: string };
        mapId = mapDataDelete.id;
        
        if (accountId !== mapDataDelete.account_id) {
          return createErrorResponse('Forbidden - you do not own this map', 403);
        }

        // Delete map
        const { error: deleteError } = await supabase
          .from('map')
          .delete()
          .eq('id', mapId);

        if (deleteError) {
          if (process.env.NODE_ENV === 'development') {
            console.error('[Maps API] Error deleting map:', deleteError);
          }
          return createErrorResponse('Failed to delete map', 500);
        }

        return createSuccessResponse({ success: true });
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

