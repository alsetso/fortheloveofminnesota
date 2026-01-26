import { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient, createServerClientWithAuth } from '@/lib/supabaseServer';
import { getServerAuth } from '@/lib/authServer';
import { createErrorResponse, createSuccessResponse } from '@/lib/server/apiError';
import { withSecurity, REQUEST_SIZE_LIMITS } from '@/lib/security/middleware';
import { validatePathParams, validateRequestBody } from '@/lib/security/validation';
import { z } from 'zod';
import { commonSchemas } from '@/lib/security/validation';

/**
 * GET /api/maps/[id]/pins
 * List pins on a map (supports both UUID and custom_slug)
 * 
 * Security:
 * - Rate limited: 200 requests/minute (authenticated) or 100/min (public)
 * - Path parameter validation
 * - Optional authentication (RLS handles permissions)
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

        // Resolve identifier to map_id (handle both UUID and slug)
        let mapId: string;
        if (isUUID(identifier)) {
          mapId = identifier;
        } else {
          // Look up map by slug
          const { data: map, error: mapError } = await supabase
            .from('map')
            .select('id')
            .eq('slug', identifier)
            .single();
          
          if (mapError || !map) {
            return createErrorResponse('Map not found', 404);
          }
          mapId = (map as any).id;
        }

        // Fetch pins (RLS will filter based on permissions)
        const { data: pins, error } = await supabase
          .from('map_pins')
          .select('*')
          .eq('map_id', mapId)
          .eq('is_active', true)
          .order('created_at', { ascending: false });

        if (error) {
          if (process.env.NODE_ENV === 'development') {
            console.error('[Maps API] Error fetching pins:', error);
          }
          return createErrorResponse('Failed to fetch pins', 500);
        }

        return createSuccessResponse({ pins: pins || [] });
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
 * POST /api/maps/[id]/pins
 * Create a pin on a map
 * 
 * Security:
 * - Rate limited: 200 requests/minute (authenticated)
 * - Request size limit: 1MB
 * - Input validation with Zod
 * - Requires authentication
 * - Ownership/access check required
 */
const createPinSchema = z.object({
  emoji: z.string().nullable().optional(),
  caption: z.string().nullable().optional(),
  image_url: z.string().url().nullable().optional(),
  video_url: z.string().url().nullable().optional(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
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
          .select('id, account_id, visibility, settings');
        
        if (isUUID(identifier)) {
          mapQuery = mapQuery.eq('id', identifier);
        } else {
          mapQuery = mapQuery.eq('slug', identifier);
        }
        
        const { data: map, error: mapError } = await mapQuery.single();

        if (mapError || !map) {
          return createErrorResponse('Map not found', 404);
        }

        const mapData = map as { account_id: string; id: string; visibility: string; settings: any };
        mapId = mapData.id;

        // Check member role
        const { data: member } = await supabase
          .from('map_members')
          .select('role')
          .eq('map_id', mapId)
          .eq('account_id', accountId)
          .maybeSingle();

        const memberRole = (member as { role?: string } | null)?.role;
        const isOwner = mapData.account_id === accountId;
        const isManager = memberRole === 'manager' || memberRole === 'owner';
        const isEditor = memberRole === 'editor';
        const isMember = isOwner || isManager || isEditor;

        // Check collaboration settings
        const settings = mapData.settings || {};
        const collaboration = settings.collaboration || {};
        const allowPins = collaboration.allow_pins === true;
        const isPublic = mapData.visibility === 'public';

        // Access check: owner/manager/editor OR (public map with allow_pins enabled)
        const canAddPins = isMember || (isPublic && allowPins);
        
        if (!canAddPins) {
          if (!isPublic) {
            return createErrorResponse('Forbidden - you do not have access to this map', 403);
          }
          return createErrorResponse('Forbidden - this map does not allow others to add pins', 403);
        }
        
        // NEW: Check plan-based permissions
        if (!isOwner && !isManager) {
          // Get user's account to check plan
          const { data: userAccount } = await supabase
            .from('accounts')
            .select('plan, subscription_status')
            .eq('id', accountId)
            .single();
          
          if (userAccount && typeof userAccount === 'object' && 'plan' in userAccount) {
            const pinPermissions = collaboration.pin_permissions;
            const requiredPlan = pinPermissions?.required_plan;
            
            // If plan requirement exists, check it
            if (requiredPlan !== null && requiredPlan !== undefined) {
              const PLAN_ORDER: Record<string, number> = {
                hobby: 1,
                contributor: 2,
                professional: 3,
                business: 4,
              };
              
              const typedAccount = userAccount as { plan: string | null; subscription_status: string | null };
              const userPlan = (typedAccount.plan || 'hobby') as string;
              const userPlanOrder = PLAN_ORDER[userPlan] || 0;
              const requiredPlanOrder = PLAN_ORDER[requiredPlan] || 0;
              
              // Check subscription status
              const isActive = typedAccount.subscription_status === 'active' || typedAccount.subscription_status === 'trialing';
              
              if (!isActive) {
                return createErrorResponse(
                  `Your subscription is not active. Please activate your ${userPlan} plan to add pins.`,
                  403,
                  { reason: 'subscription_inactive', requiredPlan, currentPlan: userPlan }
                );
              }
              
              if (userPlanOrder < requiredPlanOrder) {
                return createErrorResponse(
                  `This map requires a ${requiredPlan} plan to add pins.`,
                  403,
                  { reason: 'plan_required', requiredPlan, currentPlan: userPlan }
                );
              }
            }
          }
        }
        
        // Validate request body
        const validation = await validateRequestBody(req, createPinSchema, REQUEST_SIZE_LIMITS.json);
        if (!validation.success) {
          return validation.error;
        }
        
        const body = validation.data;

        // Create pin
        const { data: pin, error: pinError } = await supabase
          .from('map_pins')
          .insert({
            map_id: (map as any).id,
            emoji: body.emoji || null,
            caption: body.caption || null,
            image_url: body.image_url || null,
            video_url: body.video_url || null,
            lat: body.lat,
            lng: body.lng,
          } as any)
          .select()
          .single();

        if (pinError) {
          if (process.env.NODE_ENV === 'development') {
            console.error('[Maps API] Error creating pin:', pinError);
          }
          return createErrorResponse('Failed to create pin', 500);
        }

        return createSuccessResponse(pin, 201);
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
