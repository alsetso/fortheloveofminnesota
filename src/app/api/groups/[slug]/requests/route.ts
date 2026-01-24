import { NextRequest, NextResponse } from 'next/server';
import { createServerClientWithAuth } from '@/lib/supabaseServer';
import { withSecurity } from '@/lib/security/middleware';
import { validateRequestBody } from '@/lib/security/validation';
import { REQUEST_SIZE_LIMITS } from '@/lib/security/middleware';
import { z } from 'zod';
import { cookies } from 'next/headers';

/**
 * GET /api/groups/[slug]/requests
 * Get join requests for a group (admin only)
 * 
 * Security:
 * - Rate limited: 60 requests/minute
 * - Requires authentication
 * - Requires group admin access
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
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

        const { slug } = await params;
        const { searchParams } = new URL(req.url);
        const status = searchParams.get('status') as 'pending' | 'approved' | 'denied' | null;
        const limit = parseInt(searchParams.get('limit') || '50', 10);
        const offset = parseInt(searchParams.get('offset') || '0', 10);

        const supabase = await createServerClientWithAuth(cookies());

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
            { error: 'Only group admins can view join requests' },
            { status: 403 }
          );
        }

        // Get requests
        let query = supabase
          .from('group_requests')
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
          .eq('group_id', group.id)
          .order('created_at', { ascending: false })
          .range(offset, offset + limit - 1);

        if (status) {
          query = query.eq('status', status);
        }

        const { data: requests, error } = await query;

        if (error) {
          console.error('[Groups API] Error fetching requests:', error);
          return NextResponse.json(
            { error: 'Failed to fetch requests' },
            { status: 500 }
          );
        }

        return NextResponse.json({ requests: requests || [] });
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

/**
 * POST /api/groups/[slug]/requests
 * Create a join request for a private group
 * 
 * Security:
 * - Rate limited: 60 requests/minute
 * - Requires authentication
 */
const createRequestSchema = z.object({
  message: z.string().max(500).optional().nullable(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
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

        const { slug } = await params;
        const supabase = await createServerClientWithAuth(cookies());

        // Validate request body
        const validation = await validateRequestBody(req, createRequestSchema, REQUEST_SIZE_LIMITS.json);
        if (!validation.success) {
          return validation.error;
        }

        const { message } = validation.data;

        // Get group
        const { data: group } = await supabase
          .from('groups')
          .select('id, visibility')
          .eq('slug', slug)
          .eq('is_active', true)
          .single();

        if (!group) {
          return NextResponse.json(
            { error: 'Group not found' },
            { status: 404 }
          );
        }

        // Only allow requests for private groups
        if (group.visibility !== 'private') {
          return NextResponse.json(
            { error: 'Join requests are only for private groups. Public groups can be joined directly.' },
            { status: 400 }
          );
        }

        // Check if already a member
        const { data: existingMember } = await supabase
          .from('group_members')
          .select('id')
          .eq('group_id', group.id)
          .eq('account_id', accountId)
          .maybeSingle();

        if (existingMember) {
          return NextResponse.json(
            { error: 'You are already a member of this group' },
            { status: 409 }
          );
        }

        // Check if already has a pending request
        const { data: existingRequest } = await supabase
          .from('group_requests')
          .select('id, status')
          .eq('group_id', group.id)
          .eq('account_id', accountId)
          .eq('status', 'pending')
          .maybeSingle();

        if (existingRequest) {
          return NextResponse.json(
            { error: 'You already have a pending request for this group' },
            { status: 409 }
          );
        }

        // Create request
        const { data: request, error } = await supabase
          .from('group_requests')
          .insert({
            group_id: group.id,
            account_id: accountId,
            message: message?.trim() || null,
            status: 'pending',
          })
          .select(`
            id,
            group_id,
            account_id,
            status,
            message,
            created_at,
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
          console.error('[Groups API] Error creating request:', error);
          return NextResponse.json(
            { error: 'Failed to create join request' },
            { status: 500 }
          );
        }

        return NextResponse.json({ request }, { status: 201 });
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
