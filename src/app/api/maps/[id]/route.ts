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
 * Get a single map with point count
 * 
 * Security:
 * - Rate limited: 200 requests/minute (authenticated) or 100/min (public)
 * - Path parameter validation
 * - Optional authentication (RLS handles permissions)
 */
const mapIdPathSchema = z.object({
  id: commonSchemas.uuid,
});

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
        
        const { id: validatedId } = pathValidation.data;
        
        const auth = await getServerAuth();
        const supabase = auth 
          ? await createServerClientWithAuth(cookies())
          : createServerClient();

        // Fetch map (RLS will filter based on permissions)
        const { data: map, error } = await supabase
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
          .eq('id', validatedId)
          .single();

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
  type: z.enum(['user', 'community', 'gov', 'professional', 'user-generated']).optional().nullable(),
  custom_slug: z.string().regex(/^[a-z0-9-]+$/).min(3).max(100).optional().nullable(),
  tags: z.array(z.object({
    emoji: z.string(),
    text: z.string(),
  })).max(20).optional(),
  meta: z.record(z.string(), z.unknown()).optional(),
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
        
        const { id: validatedId } = pathValidation.data;
        
        if (!userId || !accountId) {
          return createErrorResponse('Unauthorized - authentication required', 401);
        }

        const supabase = await createServerClientWithAuth(cookies());
        
        // Validate request body
        const validation = await validateRequestBody(req, updateMapSchema, REQUEST_SIZE_LIMITS.json);
        if (!validation.success) {
          return validation.error;
        }
        
        const body = validation.data;

        // Check if user owns the map
        const { data: map, error: mapError } = await supabase
          .from('map')
          .select('account_id')
          .eq('id', validatedId)
          .single();

        if (mapError || !map) {
          return createErrorResponse('Map not found', 404);
        }

        const mapData = map as { id: string; account_id: string };
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

        if (body.type !== undefined) {
          updateData.type = body.type || null;
        }

        if (body.custom_slug !== undefined) {
          // Check if user has pro account for custom_slug
          const { data: account } = await supabase
            .from('accounts')
            .select('plan')
            .eq('id', accountId)
            .single();

          const accountData = account as { plan: string } | null;
          if (body.custom_slug && accountData?.plan !== 'pro' && accountData?.plan !== 'plus') {
            return createErrorResponse('Custom slugs are only available for pro accounts', 403);
          }

          if (body.custom_slug) {
            // Check if slug is already taken
            const { data: existingMap } = await supabase
              .from('map')
              .select('id')
              .eq('custom_slug', body.custom_slug)
              .neq('id', validatedId)
              .single();

            if (existingMap) {
              return createErrorResponse('Custom slug is already taken', 409);
            }
          }
          updateData.custom_slug = body.custom_slug?.trim() || null;
        }

        if (body.tags !== undefined) {
          updateData.tags = body.tags;
        }

        const { data: updatedMap, error: updateError } = await (supabase
          .from('map') as any)
          .update(updateData)
          .eq('id', validatedId)
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
        
        const { id: validatedId } = pathValidation.data;
        
        if (!userId || !accountId) {
          return createErrorResponse('Unauthorized - authentication required', 401);
        }

        const supabase = await createServerClientWithAuth(cookies());

        // Check if user owns the map
        const { data: map, error: mapError } = await supabase
          .from('map')
          .select('account_id')
          .eq('id', validatedId)
          .single();

        if (mapError || !map) {
          return createErrorResponse('Map not found', 404);
        }

        const mapDataDelete = map as { id: string; account_id: string };
        if (accountId !== mapDataDelete.account_id) {
          return createErrorResponse('Forbidden - you do not own this map', 403);
        }

        // Delete map
        const { error: deleteError } = await supabase
          .from('map')
          .delete()
          .eq('id', validatedId);

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

