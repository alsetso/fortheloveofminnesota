import { NextRequest, NextResponse } from 'next/server';
import { createServerClientWithAuth } from '@/lib/supabaseServer';
import { withSecurity } from '@/lib/security/middleware';
import { validateRequestBody } from '@/lib/security/validation';
import { REQUEST_SIZE_LIMITS } from '@/lib/security/middleware';
import { z } from 'zod';
import { cookies } from 'next/headers';

/**
 * PATCH /api/groups/[slug]/requests/[id]
 * Approve or deny a join request (admin only)
 * 
 * Security:
 * - Rate limited: 60 requests/minute
 * - Requires authentication
 * - Requires group admin access
 */
const updateRequestSchema = z.object({
  status: z.enum(['approved', 'denied']),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  return withSecurity(
    request,
    async (req, { userId, accountId }) => {
      try {
        if (!userId || !accountId) {
          return NextResponse.json(
            { error: 'Unauthorized' },
            { status: 401 }
          );
        }

        const { slug, id } = await params;
        const supabase = await createServerClientWithAuth(cookies());

        // Validate request body
        const validation = await validateRequestBody(req, updateRequestSchema, REQUEST_SIZE_LIMITS.json);
        if (!validation.success) {
          return validation.error;
        }

        const { status } = validation.data;

        // Get group
        const { data: group } = await supabase
          .from('groups')
          .select('id')
          .eq('slug', slug)
          .eq('is_active', true)
          .single();

        if (!group) {
          return NextResponse.json(
            { error: 'Group not found' },
            { status: 404 }
          );
        }

        // Check if user is admin
        const { data: membership } = await supabase
          .from('group_members')
          .select('is_admin')
          .eq('group_id', group.id)
          .eq('account_id', accountId)
          .single();

        if (!membership || !membership.is_admin) {
          return NextResponse.json(
            { error: 'Only group admins can approve/deny requests' },
            { status: 403 }
          );
        }

        // Get the request
        const { data: requestData } = await supabase
          .from('group_requests')
          .select('id, status, group_id')
          .eq('id', id)
          .eq('group_id', group.id)
          .single();

        if (!requestData) {
          return NextResponse.json(
            { error: 'Request not found' },
            { status: 404 }
          );
        }

        if (requestData.status !== 'pending') {
          return NextResponse.json(
            { error: 'Request has already been processed' },
            { status: 400 }
          );
        }

        // Update request
        const { data: updatedRequest, error } = await supabase
          .from('group_requests')
          .update({
            status,
            processed_by_account_id: accountId,
          })
          .eq('id', id)
          .select(`
            id,
            group_id,
            account_id,
            status,
            message,
            processed_by_account_id,
            created_at,
            updated_at,
            account:accounts!group_requests_account_id_fkey(
              id,
              username,
              first_name,
              last_name,
              image_url
            )
          `)
          .single();

        if (error) {
          console.error('[Groups API] Error updating request:', error);
          return NextResponse.json(
            { error: 'Failed to update request' },
            { status: 500 }
          );
        }

        return NextResponse.json({ request: updatedRequest });
      } catch (error) {
        console.error('[Groups API] Error:', error);
        return NextResponse.json(
          { error: 'Internal server error' },
          { status: 500 }
        );
      }
    },
    {
      requireAuth: true,
      rateLimit: 'authenticated',
      maxRequestSize: REQUEST_SIZE_LIMITS.json,
    }
  );
}
