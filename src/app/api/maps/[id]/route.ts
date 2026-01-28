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

        // Check if identifier is a UUID or a slug
        if (isUUID(identifier)) {
          query = query.eq('id', identifier);
        } else {
          // Assume it's a slug
          query = query.eq('slug', identifier);
        }

        // If authenticated, also get user's member role
        if (accountId) {
          query = query.select(`
            *,
            current_user_member:map_members!left(
              role
            )
          `);
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
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional().nullable(),
  visibility: z.enum(['public', 'private']).optional(),
  slug: z.string().regex(/^[a-z0-9-]+$/).min(3).max(100).optional().nullable(),
  boundary: z.enum(['statewide', 'county', 'city', 'town', 'district']).optional(),
  boundary_data: z.record(z.string(), z.unknown()).nullable().optional(),
  settings: z.object({
    appearance: z.object({
      map_style: z.enum(['street', 'satellite', 'light', 'dark']).optional(),
      map_layers: z.record(z.string(), z.boolean()).optional(),
      meta: z.record(z.string(), z.unknown()).optional(),
      map_filters: z.object({
        angle: z.number().min(0).max(60).optional(),
        map_styles: z.boolean().optional(),
        global_layers: z.boolean().optional(),
      }).optional(),
    }).optional(),
    collaboration: z.object({
      allow_pins: z.boolean().optional(),
      allow_areas: z.boolean().optional(),
      allow_posts: z.boolean().optional(),
      allow_clicks: z.boolean().optional(),
      pin_permissions: z.object({
        required_plan: z.enum(['hobby', 'contributor', 'professional', 'business']).nullable().optional(),
      }).optional(),
      area_permissions: z.object({
        required_plan: z.enum(['hobby', 'contributor', 'professional', 'business']).nullable().optional(),
      }).optional(),
      post_permissions: z.object({
        required_plan: z.enum(['hobby', 'contributor', 'professional', 'business']).nullable().optional(),
      }).optional(),
      click_permissions: z.object({
        required_plan: z.enum(['hobby', 'contributor', 'professional', 'business']).nullable().optional(),
      }).optional(),
      role_overrides: z.object({
        managers_can_edit: z.boolean().optional(),
        editors_can_edit: z.boolean().optional(),
      }).optional(),
    }).optional(),
    presentation: z.object({
      hide_creator: z.boolean().optional(),
      is_featured: z.boolean().optional(),
      emoji: z.string().nullable().optional(),
      show_map_filters_icon: z.boolean().optional(),
    }).optional(),
    membership: z.object({
      max_members: z.number().int().positive().optional().nullable(),
    }).optional(),
    colors: z.object({
      owner: z.string().optional(),
      manager: z.string().optional(),
      editor: z.string().optional(),
      'non-member': z.string().optional(),
    }).optional(),
  }).optional(),
  auto_approve_members: z.boolean().optional(),
  membership_rules: z.string().optional().nullable(),
  membership_questions: z.array(z.object({
    id: z.number(),
    question: z.string(),
  })).max(5).optional(),
  tags: z.array(z.object({
    emoji: z.string(),
    text: z.string(),
  })).max(20).optional(),
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
          .select('id, account_id, settings');
        
        if (isUUID(identifier)) {
          mapQuery = mapQuery.eq('id', identifier);
        } else {
          mapQuery = mapQuery.eq('slug', identifier);
        }

        const { data: map, error: mapError } = await mapQuery.single();

        if (mapError || !map) {
          return createErrorResponse('Map not found', 404);
        }

        const mapData = map as { account_id: string; id: string; settings: any };
        mapId = mapData.id;

        // Check member role (owner/manager can update, editor cannot)
        const { data: member } = await supabase
          .from('map_members')
          .select('role')
          .eq('map_id', mapId)
          .eq('account_id', accountId)
          .maybeSingle();

        const memberRole = (member as { role?: string } | null)?.role;
        const isOwner = mapData.account_id === accountId;
        const isManager = memberRole === 'manager' || memberRole === 'owner';
        const canUpdate = isOwner || isManager;

        if (!canUpdate) {
          return createErrorResponse('Forbidden - you do not have permission to update this map', 403);
        }

        // Build update data
        const updateData: Partial<Database['public']['Tables']['map']['Update']> = {};
        const currentSettings = (mapData.settings || {}) as any;

        if (body.name !== undefined) {
          updateData.name = body.name.trim();
        }

        if (body.description !== undefined) {
          updateData.description = body.description?.trim() || null;
        }

        if (body.visibility !== undefined) {
          updateData.visibility = body.visibility;
        }

        if (body.slug !== undefined) {
          // Check if user is admin or has pro/plus plan
          const { data: account } = await supabase
            .from('accounts')
            .select('plan, role')
            .eq('id', accountId)
            .single();

          const accountData = account as { plan: string; role: string } | null;
          const isAdmin = accountData?.role === 'admin';
          
          // Non-admins need pro/plus plan for custom slug
          if (body.slug && !isAdmin && accountData?.plan !== 'pro' && accountData?.plan !== 'plus') {
            return createErrorResponse('Custom slugs are only available for pro/plus accounts or admins', 403);
          }

          if (body.slug) {
            // Check if slug is already taken (excluding current map)
            const { data: existingMap } = await supabase
              .from('map')
              .select('id')
              .eq('slug', body.slug)
              .neq('id', mapId)
              .maybeSingle();

            if (existingMap) {
              return createErrorResponse('Slug is already taken', 409);
            }
          }
          updateData.slug = body.slug?.trim() || null;
        }

        // Update settings (merge with existing)
        if (body.settings !== undefined) {
          const newSettings = {
            ...currentSettings,
            ...(body.settings.appearance && {
              appearance: {
                ...currentSettings.appearance,
                ...body.settings.appearance,
                // Deep merge nested objects
                ...(body.settings.appearance.map_filters && {
                  map_filters: {
                    ...(currentSettings.appearance?.map_filters || {}),
                    ...body.settings.appearance.map_filters,
                  },
                }),
                ...(body.settings.appearance.meta && {
                  meta: {
                    ...(currentSettings.appearance?.meta || {}),
                    ...body.settings.appearance.meta,
                  },
                }),
                ...(body.settings.appearance.map_layers && {
                  map_layers: {
                    ...(currentSettings.appearance?.map_layers || {}),
                    ...body.settings.appearance.map_layers,
                  },
                }),
              },
            }),
            ...(body.settings.collaboration && {
              collaboration: {
                ...currentSettings.collaboration,
                ...body.settings.collaboration,
              },
            }),
            ...(body.settings.presentation && {
              presentation: {
                ...currentSettings.presentation,
                ...body.settings.presentation,
              },
            }),
            ...(body.settings.membership && {
              membership: {
                ...currentSettings.membership,
                ...body.settings.membership,
              },
            }),
            ...(body.settings.colors && {
              colors: {
                ...currentSettings.colors,
                ...body.settings.colors,
              },
            }),
          };
          updateData.settings = newSettings;
        }

        if (body.auto_approve_members !== undefined) {
          updateData.auto_approve_members = body.auto_approve_members;
        }

        if (body.membership_rules !== undefined) {
          updateData.membership_rules = body.membership_rules?.trim() || null;
        }

        if (body.membership_questions !== undefined) {
          updateData.membership_questions = body.membership_questions;
        }

        if (body.tags !== undefined) {
          updateData.tags = body.tags;
        }

        if (body.boundary !== undefined) {
          updateData.boundary = body.boundary;
        }

        if (body.boundary_data !== undefined) {
          updateData.boundary_data = body.boundary_data;
        }

        const { data: updatedMap, error: updateError } = await (supabase
          .from('map') as any)
          .update(updateData)
          .eq('id', mapId)
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
          mapQuery = mapQuery.eq('slug', identifier);
        }

        const { data: map, error: mapError } = await mapQuery.single();

        if (mapError || !map) {
          return createErrorResponse('Map not found', 404);
        }

        const mapDataDelete = map as { account_id: string; id: string };
        mapId = mapDataDelete.id;
        
        // Only owner can delete (not manager)
        if (accountId !== mapDataDelete.account_id) {
          return createErrorResponse('Forbidden - only the map owner can delete this map', 403);
        }

        // Soft delete: set is_active = false
        const { error: deleteError } = await ((supabase
          .from('map') as any)
          .update({ is_active: false })
          .eq('id', mapId));

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

