import { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient, createServerClientWithAuth } from '@/lib/supabaseServer';
import { createErrorResponse, createSuccessResponse } from '@/lib/server/apiError';
import { withSecurity, REQUEST_SIZE_LIMITS } from '@/lib/security/middleware';
import { validatePathParams, validateRequestBody } from '@/lib/security/validation';
import { z } from 'zod';

/**
 * GET /api/maps/[id]/categories
 * List categories for a map
 * 
 * Security:
 * - Rate limited: 200 requests/minute (authenticated) or 100/min (public)
 * - Optional authentication
 */
const mapIdPathSchema = z.object({
  id: z.string().min(1).max(200),
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
        
        const pathValidation = validatePathParams({ id }, mapIdPathSchema);
        if (!pathValidation.success) {
          return pathValidation.error;
        }
        
        const { id: identifier } = pathValidation.data;
        const supabase = accountId 
          ? await createServerClientWithAuth(cookies())
          : await createServerClient();

        // Resolve identifier to map_id
        let mapId: string;
        if (isUUID(identifier)) {
          mapId = identifier;
        } else {
          const { data: map } = await supabase
            .from('map')
            .select('id')
            .eq('slug', identifier)
            .single();
          
          if (!map) {
            return createErrorResponse('Map not found', 404);
          }
          mapId = (map as any).id;
        }

        // Fetch categories
        const { data: categories, error } = await supabase
          .from('map_categories')
          .select('id, map_id, category')
          .eq('map_id', mapId);

        if (error) {
          if (process.env.NODE_ENV === 'development') {
            console.error('[Maps API] Error fetching categories:', error);
          }
          return createErrorResponse('Failed to fetch categories', 500);
        }

        return createSuccessResponse({ 
          categories: (categories || []).map((c: any) => c.category) 
        });
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
 * POST /api/maps/[id]/categories
 * Add a category to a map
 * 
 * Security:
 * - Rate limited: 200 requests/minute (authenticated)
 * - Requires authentication
 * - Only owner/manager can add categories
 */
const addCategorySchema = z.object({
  category: z.enum(['community', 'professional', 'government', 'atlas', 'user']),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withSecurity(
    request,
    async (req, { userId, accountId }) => {
      try {
        const { id } = await params;
        
        if (!userId || !accountId) {
          return createErrorResponse('Unauthorized - authentication required', 401);
        }

        const pathValidation = validatePathParams({ id }, mapIdPathSchema);
        if (!pathValidation.success) {
          return pathValidation.error;
        }
        
        const { id: identifier } = pathValidation.data;
        const supabase = await createServerClientWithAuth(cookies());

        // Validate request body
        const validation = await validateRequestBody(req, addCategorySchema, REQUEST_SIZE_LIMITS.json);
        if (!validation.success) {
          return validation.error;
        }
        
        const { category } = validation.data;

        // Resolve identifier to map_id
        let mapQuery = supabase
          .from('map')
          .select('id, account_id');
        
        if (isUUID(identifier)) {
          mapQuery = mapQuery.eq('id', identifier);
        } else {
          mapQuery = mapQuery.eq('slug', identifier);
        }

        const { data: map } = await mapQuery.single();
        if (!map) {
          return createErrorResponse('Map not found', 404);
        }

        const mapData = map as { account_id: string; id: string };
        const mapId = mapData.id;

        // Check if user is owner or manager
        const { data: member } = await supabase
          .from('map_members')
          .select('role')
          .eq('map_id', mapId)
          .eq('account_id', accountId)
          .maybeSingle();

        const isOwner = mapData.account_id === accountId;
        const memberRole = member && typeof member === 'object' && 'role' in member ? (member as { role: string }).role : null;
        const isManager = memberRole === 'manager' || memberRole === 'owner';
        const canManage = isOwner || isManager;

        if (!canManage) {
          return createErrorResponse('Forbidden - only owners and managers can manage categories', 403);
        }

        // Check if category already exists
        const { data: existing } = await supabase
          .from('map_categories')
          .select('id')
          .eq('map_id', mapId)
          .eq('category', category)
          .maybeSingle();

        if (existing) {
          return createErrorResponse('Category already exists for this map', 409);
        }

        // Add category
        const { data: newCategory, error } = await supabase
          .from('map_categories')
          .insert({
            map_id: mapId,
            category,
          } as any)
          .select('id, map_id, category')
          .single();

        if (error) {
          if (process.env.NODE_ENV === 'development') {
            console.error('[Maps API] Error adding category:', error);
          }
          return createErrorResponse('Failed to add category', 500);
        }

        return createSuccessResponse(newCategory, 201);
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
 * DELETE /api/maps/[id]/categories?category=...
 * Remove a category from a map
 * 
 * Security:
 * - Rate limited: 200 requests/minute (authenticated)
 * - Requires authentication
 * - Only owner/manager can remove categories
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
        
        if (!userId || !accountId) {
          return createErrorResponse('Unauthorized - authentication required', 401);
        }

        const pathValidation = validatePathParams({ id }, mapIdPathSchema);
        if (!pathValidation.success) {
          return pathValidation.error;
        }
        
        const { id: identifier } = pathValidation.data;
        const supabase = await createServerClientWithAuth(cookies());

        // Get category from query params
        const url = new URL(req.url);
        const category = url.searchParams.get('category');
        
        if (!category) {
          return createErrorResponse('Category parameter is required', 400);
        }

        const categoryValidation = z.enum(['community', 'professional', 'government', 'atlas', 'user']).safeParse(category);
        if (!categoryValidation.success) {
          return createErrorResponse('Invalid category', 400);
        }

        const validCategory = categoryValidation.data;

        // Resolve identifier to map_id
        let mapQuery = supabase
          .from('map')
          .select('id, account_id');
        
        if (isUUID(identifier)) {
          mapQuery = mapQuery.eq('id', identifier);
        } else {
          mapQuery = mapQuery.eq('slug', identifier);
        }

        const { data: map } = await mapQuery.single();
        if (!map) {
          return createErrorResponse('Map not found', 404);
        }

        const mapData = map as { account_id: string; id: string };
        const mapId = mapData.id;

        // Check if user is owner or manager
        const { data: member } = await supabase
          .from('map_members')
          .select('role')
          .eq('map_id', mapId)
          .eq('account_id', accountId)
          .maybeSingle();

        const isOwner = mapData.account_id === accountId;
        const memberRole = member && typeof member === 'object' && 'role' in member ? (member as { role: string }).role : null;
        const isManager = memberRole === 'manager' || memberRole === 'owner';
        const canManage = isOwner || isManager;

        if (!canManage) {
          return createErrorResponse('Forbidden - only owners and managers can manage categories', 403);
        }

        // Remove category
        const { error } = await supabase
          .from('map_categories')
          .delete()
          .eq('map_id', mapId)
          .eq('category', validCategory);

        if (error) {
          if (process.env.NODE_ENV === 'development') {
            console.error('[Maps API] Error removing category:', error);
          }
          return createErrorResponse('Failed to remove category', 500);
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
