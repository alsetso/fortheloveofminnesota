import { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClientWithAuth } from '@/lib/supabaseServer';
import { createErrorResponse, createSuccessResponse } from '@/lib/server/apiError';
import { withSecurity, REQUEST_SIZE_LIMITS } from '@/lib/security/middleware';
import { validatePathParams } from '@/lib/security/validation';
import { z } from 'zod';
import { commonSchemas } from '@/lib/security/validation';
import { getEffectiveMemberLimit } from '@/lib/maps/memberLimits';
import type { MapSettings } from '@/types/map';

/**
 * PUT /api/maps/[id]/membership-requests/[requestId]
 * Approve a membership request
 * 
 * Security:
 * - Rate limited: 200 requests/minute (authenticated)
 * - Requires authentication
 * - Only owner/manager can approve requests
 * - Uses active_account_id cookie to determine which account is performing the action
 */
const pathSchema = z.object({
  id: z.string().min(1).max(200),
  requestId: commonSchemas.uuid,
});

// Helper to check if string is a valid UUID
function isUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; requestId: string }> }
) {
  return withSecurity(
    request,
    async (req, { userId, accountId }) => {
      try {
        const { id, requestId } = await params;
        
        if (!userId || !accountId) {
          return createErrorResponse('Unauthorized - authentication required', 401);
        }

        const pathValidation = validatePathParams({ id, requestId }, pathSchema);
        if (!pathValidation.success) {
          return pathValidation.error;
        }
        
        const { id: identifier } = pathValidation.data;
        const supabase = await createServerClientWithAuth(cookies());

        // Resolve identifier to map_id
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

        const mapData = map as { account_id: string; id: string; settings: MapSettings; member_count: number };
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
        const canApprove = isOwner || isManager;

        if (!canApprove) {
          return createErrorResponse('Forbidden - only owners and managers can approve requests', 403);
        }

        // Get request
        const { data: request } = await supabase
          .from('map_membership_requests')
          .select('id, account_id, status')
          .eq('id', requestId)
          .eq('map_id', mapId)
          .maybeSingle();

        if (!request || typeof request !== 'object' || !('status' in request)) {
          return createErrorResponse('Membership request not found', 404);
        }

        const requestStatus = (request as { status: string }).status;

        if (requestStatus !== 'pending') {
          return createErrorResponse('Request has already been processed', 409);
        }

        // Check if already a member
        const { data: existingMember } = await supabase
          .from('map_members')
          .select('id')
          .eq('map_id', mapId)
          .eq('account_id', (request as any).account_id)
          .maybeSingle();

        if (existingMember) {
          // Update request status anyway
          await ((supabase
            .from('map_membership_requests') as any)
            .update({ status: 'approved', reviewed_at: new Date().toISOString(), reviewed_by_account_id: accountId })
            .eq('id', requestId));
          
          return createErrorResponse('User is already a member', 409);
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

        // Add as member
        const requestAccountId = (request as { account_id: string }).account_id;
        const { data: newMember, error: memberError } = await ((supabase
          .from('map_members') as any)
          .insert({
            map_id: mapId,
            account_id: requestAccountId,
            role: 'editor',
          })
          .select(`
            id,
            map_id,
            account_id,
            role,
            joined_at
          `)
          .single());

        if (memberError) {
          if (process.env.NODE_ENV === 'development') {
            console.error('[Maps API] Error adding member:', memberError);
          }
          return createErrorResponse('Failed to add member', 500);
        }

        // Update request status to approved
        const { error: updateError } = await ((supabase
          .from('map_membership_requests') as any)
          .update({ 
            status: 'approved', 
            reviewed_at: new Date().toISOString(), 
            reviewed_by_account_id: accountId 
          })
          .eq('id', requestId));

        if (updateError) {
          if (process.env.NODE_ENV === 'development') {
            console.error('[Maps API] Error updating request status:', updateError);
          }
          // Member was added successfully, but status update failed
          // This is not critical, but log it for debugging
          // The request will still show as pending until manually fixed
        }

        return createSuccessResponse({ 
          member: newMember,
          requestUpdated: !updateError 
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
      requireAuth: true,
      maxRequestSize: REQUEST_SIZE_LIMITS.json,
    }
  );
}

/**
 * DELETE /api/maps/[id]/membership-requests/[requestId]
 * Reject a membership request
 * 
 * Security:
 * - Rate limited: 200 requests/minute (authenticated)
 * - Requires authentication
 * - Only owner/manager can reject requests
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; requestId: string }> }
) {
  return withSecurity(
    request,
    async (req, { userId, accountId }) => {
      try {
        const { id, requestId } = await params;
        
        if (!userId || !accountId) {
          return createErrorResponse('Unauthorized - authentication required', 401);
        }

        const pathValidation = validatePathParams({ id, requestId }, pathSchema);
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
        const canReject = isOwner || isManager;

        if (!canReject) {
          return createErrorResponse('Forbidden - only owners and managers can reject requests', 403);
        }

        // Get request
        const { data: request } = await supabase
          .from('map_membership_requests')
          .select('id, status')
          .eq('id', requestId)
          .eq('map_id', mapId)
          .maybeSingle();

        if (!request || typeof request !== 'object' || !('status' in request)) {
          return createErrorResponse('Membership request not found', 404);
        }

        const requestStatus = (request as { status: string }).status;

        if (requestStatus !== 'pending') {
          return createErrorResponse('Request has already been processed', 409);
        }

        // Update request status to rejected
        const { error } = await ((supabase
          .from('map_membership_requests') as any)
          .update({ status: 'rejected', reviewed_at: new Date().toISOString(), reviewed_by_account_id: accountId })
          .eq('id', requestId));

        if (error) {
          if (process.env.NODE_ENV === 'development') {
            console.error('[Maps API] Error rejecting request:', error);
          }
          return createErrorResponse('Failed to reject request', 500);
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
