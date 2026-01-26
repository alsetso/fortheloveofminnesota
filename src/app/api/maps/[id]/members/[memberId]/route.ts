import { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClientWithAuth } from '@/lib/supabaseServer';
import { createErrorResponse, createSuccessResponse } from '@/lib/server/apiError';
import { withSecurity, REQUEST_SIZE_LIMITS } from '@/lib/security/middleware';
import { validatePathParams, validateRequestBody } from '@/lib/security/validation';
import { z } from 'zod';
import { commonSchemas } from '@/lib/security/validation';

/**
 * PUT /api/maps/[id]/members/[memberId]
 * Update a member's role
 * 
 * Security:
 * - Rate limited: 200 requests/minute (authenticated)
 * - Requires authentication
 * - Only owner can update roles
 */
const pathSchema = z.object({
  id: z.string().min(1).max(200),
  memberId: commonSchemas.uuid,
});

const updateMemberSchema = z.object({
  role: z.enum(['manager', 'editor']),
});

// Helper to check if string is a valid UUID
function isUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  return withSecurity(
    request,
    async (req, { userId, accountId }) => {
      try {
        const { id, memberId } = await params;
        
        if (!userId || !accountId) {
          return createErrorResponse('Unauthorized - authentication required', 401);
        }

        const pathValidation = validatePathParams({ id, memberId }, pathSchema);
        if (!pathValidation.success) {
          return pathValidation.error;
        }
        
        const { id: identifier } = pathValidation.data;
        const supabase = await createServerClientWithAuth(cookies());

        // Validate request body
        const validation = await validateRequestBody(req, updateMemberSchema, REQUEST_SIZE_LIMITS.json);
        if (!validation.success) {
          return validation.error;
        }
        
        const { role } = validation.data;

        // Resolve identifier to map_id
        let mapId: string;
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
        mapId = mapData.id;

        // Only owner can update roles
        if (mapData.account_id !== accountId) {
          return createErrorResponse('Forbidden - only the owner can update member roles', 403);
        }

        // Check if member exists
        const { data: member } = await supabase
          .from('map_members')
          .select('id, role')
          .eq('id', memberId)
          .eq('map_id', mapId)
          .maybeSingle();

        if (!member || typeof member !== 'object' || !('role' in member)) {
          return createErrorResponse('Member not found', 404);
        }

        const memberRole = (member as { role: string }).role;

        // Cannot change owner role
        if (memberRole === 'owner') {
          return createErrorResponse('Cannot change owner role', 403);
        }

        // Update role
        const { data: updatedMember, error } = await ((supabase
          .from('map_members') as any)
          .update({ role })
          .eq('id', memberId)
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
          .single());

        if (error) {
          if (process.env.NODE_ENV === 'development') {
            console.error('[Maps API] Error updating member:', error);
          }
          return createErrorResponse('Failed to update member', 500);
        }

        return createSuccessResponse(updatedMember);
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
 * DELETE /api/maps/[id]/members/[memberId]
 * Remove a member from a map
 * 
 * Security:
 * - Rate limited: 200 requests/minute (authenticated)
 * - Requires authentication
 * - Only owner/manager can remove members
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  return withSecurity(
    request,
    async (req, { userId, accountId }) => {
      try {
        const { id, memberId } = await params;
        
        if (!userId || !accountId) {
          return createErrorResponse('Unauthorized - authentication required', 401);
        }

        const pathValidation = validatePathParams({ id, memberId }, pathSchema);
        if (!pathValidation.success) {
          return pathValidation.error;
        }
        
        const { id: identifier } = pathValidation.data;
        const supabase = await createServerClientWithAuth(cookies());

        // Resolve identifier to map_id
        let mapId: string;
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
        mapId = mapData.id;

        // Check if user is owner or manager
        const { data: currentMember } = await supabase
          .from('map_members')
          .select('role')
          .eq('map_id', mapId)
          .eq('account_id', accountId)
          .maybeSingle();

        const isOwner = mapData.account_id === accountId;
        const currentMemberRole = currentMember && typeof currentMember === 'object' && 'role' in currentMember ? (currentMember as { role: string }).role : null;
        const isManager = currentMemberRole === 'manager' || currentMemberRole === 'owner';
        const canRemove = isOwner || isManager;

        if (!canRemove) {
          return createErrorResponse('Forbidden - only owners and managers can remove members', 403);
        }

        // Check if member exists
        const { data: member } = await supabase
          .from('map_members')
          .select('id, role')
          .eq('id', memberId)
          .eq('map_id', mapId)
          .maybeSingle();

        if (!member || typeof member !== 'object' || !('role' in member)) {
          return createErrorResponse('Member not found', 404);
        }

        const memberRole = (member as { role: string }).role;

        // Cannot remove owner
        if (memberRole === 'owner') {
          return createErrorResponse('Cannot remove owner', 403);
        }

        // Remove member
        const { error } = await supabase
          .from('map_members')
          .delete()
          .eq('id', memberId);

        if (error) {
          if (process.env.NODE_ENV === 'development') {
            console.error('[Maps API] Error removing member:', error);
          }
          return createErrorResponse('Failed to remove member', 500);
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
