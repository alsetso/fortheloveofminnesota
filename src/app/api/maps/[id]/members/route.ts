import { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClientWithAuth } from '@/lib/supabaseServer';
import { createErrorResponse, createSuccessResponse } from '@/lib/server/apiError';
import { withSecurity, REQUEST_SIZE_LIMITS } from '@/lib/security/middleware';
import { validatePathParams, validateRequestBody } from '@/lib/security/validation';
import { z } from 'zod';
import { commonSchemas } from '@/lib/security/validation';
import { getEffectiveMemberLimit } from '@/lib/maps/memberLimits';
import type { MapSettings } from '@/types/map';

/**
 * GET /api/maps/[id]/members
 * List all members of a map
 * 
 * Security:
 * - Rate limited: 200 requests/minute (authenticated)
 * - Requires authentication
 * - Only map members (owner/manager/editor) can view members
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

        // Resolve identifier to map_id and get map owner
        let mapId: string;
        let mapOwnerId: string | null = null;
        
        if (isUUID(identifier)) {
          mapId = identifier;
          const { data: map } = await supabase
            .from('map')
            .select('id, account_id')
            .eq('id', identifier)
            .single();
          
          if (!map) {
            return createErrorResponse('Map not found', 404);
          }
          mapOwnerId = (map as any).account_id;
        } else {
          const { data: map } = await supabase
            .from('map')
            .select('id, account_id')
            .eq('slug', identifier)
            .single();
          
          if (!map) {
            return createErrorResponse('Map not found', 404);
          }
          mapId = (map as any).id;
          mapOwnerId = (map as any).account_id;
        }

        // Check if user is the map owner (owners can always view members)
        const isOwner = mapOwnerId === accountId;

        // If not owner, check if user is a member (owner/manager/editor can view members)
        if (!isOwner) {
          const { data: member } = await supabase
            .from('map_members')
            .select('role')
            .eq('map_id', mapId)
            .eq('account_id', accountId)
            .maybeSingle();

          if (!member) {
            return createErrorResponse('Forbidden - you must be a member to view members', 403);
          }
        }

        // Fetch all members
        const { data: members, error } = await supabase
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
          .order('joined_at', { ascending: true });

        if (error) {
          if (process.env.NODE_ENV === 'development') {
            console.error('[Maps API] Error fetching members:', error);
          }
          return createErrorResponse('Failed to fetch members', 500);
        }

        return createSuccessResponse({ members: members || [] });
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
 * POST /api/maps/[id]/members
 * Invite a member to a map
 * 
 * Security:
 * - Rate limited: 200 requests/minute (authenticated)
 * - Requires authentication
 * - Only owner/manager can invite members
 */
const inviteMemberSchema = z.object({
  account_id: commonSchemas.uuid,
  role: z.enum(['manager', 'editor']).default('editor'),
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
        const validation = await validateRequestBody(req, inviteMemberSchema, REQUEST_SIZE_LIMITS.json);
        if (!validation.success) {
          return validation.error;
        }
        
        const { account_id: inviteAccountId, role } = validation.data;

        // Resolve identifier to map_id
        let mapId: string;
        let mapQuery = supabase
          .from('map')
          .select('id, account_id, settings, member_count');
        
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
          settings: MapSettings;
          member_count: number;
        };
        mapId = mapData.id;

        // Check if user is owner or manager
        const { data: currentMember } = await supabase
          .from('map_members')
          .select('role')
          .eq('map_id', mapId)
          .eq('account_id', accountId)
          .maybeSingle();

        const isOwner = mapData.account_id === accountId;
        const memberRole = currentMember && typeof currentMember === 'object' && 'role' in currentMember ? (currentMember as { role: string }).role : null;
        const isManager = memberRole === 'manager' || memberRole === 'owner';
        const canInvite = isOwner || isManager;

        if (!canInvite) {
          return createErrorResponse('Forbidden - only owners and managers can invite members', 403);
        }

        // Check if account exists
        const { data: account } = await supabase
          .from('accounts')
          .select('id')
          .eq('id', inviteAccountId)
          .maybeSingle();

        if (!account) {
          return createErrorResponse('Account not found', 404);
        }

        // Check if already a member
        const { data: existingMember } = await supabase
          .from('map_members')
          .select('id')
          .eq('map_id', mapId)
          .eq('account_id', inviteAccountId)
          .maybeSingle();

        if (existingMember) {
          return createErrorResponse('User is already a member of this map', 409);
        }

        // Check member limit before adding
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

        // Add member
        const { data: newMember, error } = await supabase
          .from('map_members')
          .insert({
            map_id: mapId,
            account_id: inviteAccountId,
            role,
          } as any)
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
          .single();

        if (error) {
          if (process.env.NODE_ENV === 'development') {
            console.error('[Maps API] Error adding member:', error);
          }
          return createErrorResponse('Failed to add member', 500);
        }

        return createSuccessResponse(newMember, 201);
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
