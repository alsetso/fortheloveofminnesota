import { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClientWithAuth } from '@/lib/supabaseServer';
import { createErrorResponse, createSuccessResponse } from '@/lib/server/apiError';
import { withSecurity, REQUEST_SIZE_LIMITS } from '@/lib/security/middleware';
import { validatePathParams, validateRequestBody } from '@/lib/security/validation';
import { z } from 'zod';
import { getEffectiveMemberLimit } from '@/lib/maps/memberLimits';
import type { MapSettings } from '@/types/map';

/**
 * GET /api/maps/[id]/membership-requests
 * List membership requests for a map
 * 
 * Security:
 * - Rate limited: 200 requests/minute (authenticated)
 * - Requires authentication
 * - Only owner/manager can view requests
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
        
        if (!userId || !accountId) {
          return createErrorResponse('Unauthorized - authentication required', 401);
        }

        const pathValidation = validatePathParams({ id }, mapIdPathSchema);
        if (!pathValidation.success) {
          return pathValidation.error;
        }
        
        const { id: identifier } = pathValidation.data;
        const supabase = await createServerClientWithAuth(cookies());

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
        const canView = isOwner || isManager;

        if (!canView) {
          return createErrorResponse('Forbidden - only owners and managers can view membership requests', 403);
        }

        // Fetch pending requests
        const { data: requests, error } = await supabase
          .from('map_membership_requests')
          .select(`
            id,
            map_id,
            account_id,
            answers,
            status,
            created_at,
            reviewed_at,
            reviewed_by_account_id,
            account:accounts!map_membership_requests_account_id_fkey(
              id,
              username,
              first_name,
              last_name,
              image_url
            )
          `)
          .eq('map_id', mapId)
          .eq('status', 'pending')
          .order('created_at', { ascending: false });

        if (error) {
          if (process.env.NODE_ENV === 'development') {
            console.error('[Maps API] Error fetching membership requests:', error);
          }
          return createErrorResponse('Failed to fetch membership requests', 500);
        }

        return createSuccessResponse({ requests: requests || [] });
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
 * POST /api/maps/[id]/membership-requests
 * Create a membership request
 * 
 * Security:
 * - Rate limited: 200 requests/minute (authenticated)
 * - Requires authentication
 * - Public maps with auto_approve can skip request
 */
const createRequestSchema = z.object({
  answers: z.array(z.object({
    question_id: z.number(),
    answer: z.string(),
  })).default([]),
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
        const validation = await validateRequestBody(req, createRequestSchema, REQUEST_SIZE_LIMITS.json);
        if (!validation.success) {
          return validation.error;
        }
        
        const { answers } = validation.data;

        // Resolve identifier to map_id
        let mapQuery = supabase
          .from('map')
          .select('id, account_id, visibility, auto_approve_members, settings, member_count');
        
        if (isUUID(identifier)) {
          mapQuery = mapQuery.eq('id', identifier);
        } else {
          mapQuery = mapQuery.eq('slug', identifier);
        }

        const { data: map } = await mapQuery.single();
        if (!map) {
          return createErrorResponse('Map not found', 404);
        }

        const mapData = map as { 
          account_id: string; 
          id: string; 
          visibility: string; 
          auto_approve_members: boolean;
          settings: MapSettings;
          member_count: number;
        };
        const mapId = mapData.id;

        // Check if already a member
        const { data: existingMember } = await supabase
          .from('map_members')
          .select('id')
          .eq('map_id', mapId)
          .eq('account_id', accountId)
          .maybeSingle();

        if (existingMember) {
          return createErrorResponse('You are already a member of this map', 409);
        }

        // Check if already has pending request
        const { data: existingRequest } = await supabase
          .from('map_membership_requests')
          .select('id')
          .eq('map_id', mapId)
          .eq('account_id', accountId)
          .eq('status', 'pending')
          .maybeSingle();

        if (existingRequest) {
          return createErrorResponse('You already have a pending request for this map', 409);
        }

        // Check member limit before proceeding
        const limitCheck = await getEffectiveMemberLimit(
          mapData.account_id,
          mapData.settings,
          mapData.member_count
        );

        if (!limitCheck.canAddMember) {
          return createErrorResponse(
            limitCheck.reason || 'Map has reached the maximum member limit',
            403
          );
        }

        // If auto_approve is enabled, add as member directly using RPC function
        // This bypasses RLS while still validating all security conditions
        if (mapData.auto_approve_members && mapData.visibility === 'public') {
          const { data: newMember, error: memberError } = await supabase
            .rpc('join_map_auto_approve', {
              p_map_id: mapId,
              p_account_id: accountId,
            } as any);

          // Always check map_members after RPC: RPC can return PGRST116 (0 rows) even when INSERT succeeded
          const { data: existingMember } = await supabase
            .from('map_members')
            .select('id, role')
            .eq('map_id', mapId)
            .eq('account_id', accountId)
            .maybeSingle();

          if (existingMember) {
            return createSuccessResponse({ member: existingMember, auto_approved: true }, 201);
          }

          if (memberError) {
            if (process.env.NODE_ENV === 'development') {
              console.error('[Maps API] Error auto-adding member:', memberError);
            }
            if (memberError.message?.includes('Already a member')) {
              return createErrorResponse('You are already a member of this map', 409);
            }
            if (memberError.message?.includes('Not authenticated')) {
              return createErrorResponse('Authentication required', 401);
            }
            if (memberError.message?.includes('Account does not belong to user')) {
              return createErrorResponse('Invalid account', 403);
            }
            if (memberError.message?.includes('maximum member limit')) {
              return createErrorResponse(memberError.message, 403);
            }
            return createErrorResponse('Failed to join map', 500);
          }

          // Handle case where RPC returns array (should be single item)
          const member = Array.isArray(newMember) ? newMember[0] : newMember;
          if (member) {
            return createSuccessResponse({ member, auto_approved: true }, 201);
          }

          return createErrorResponse('Failed to join map', 500);
        }

        // Create membership request
        const { data: newRequest, error } = await supabase
          .from('map_membership_requests')
          .insert({
            map_id: mapId,
            account_id: accountId,
            answers,
          } as any)
          .select(`
            id,
            map_id,
            account_id,
            answers,
            status,
            created_at,
            account:accounts!map_membership_requests_account_id_fkey(
              id,
              username,
              first_name,
              last_name,
              image_url
            )
          `)
          .single();

        if (error) {
          if (process.env.NODE_ENV === 'development') {
            console.error('[Maps API] Error creating membership request:', error);
          }
          return createErrorResponse('Failed to create membership request', 500);
        }

        return createSuccessResponse(newRequest, 201);
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
