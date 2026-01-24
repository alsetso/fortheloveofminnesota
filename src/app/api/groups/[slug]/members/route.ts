import { NextRequest, NextResponse } from 'next/server';
import { createServerClientWithAuth } from '@/lib/supabaseServer';
import { withSecurity } from '@/lib/security/middleware';
import { REQUEST_SIZE_LIMITS } from '@/lib/security/middleware';
import { cookies } from 'next/headers';

/**
 * GET /api/groups/[slug]/members
 * Get members of a group
 * 
 * Security:
 * - Rate limited: 200 requests/minute
 * - Requires authentication
 * - Only visible to group members
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
        const limit = parseInt(searchParams.get('limit') || '50', 10);
        const offset = parseInt(searchParams.get('offset') || '0', 10);

        const supabase = await createServerClientWithAuth(cookies());

        // Get group
        const { data: group } = await supabase
          .from('groups')
          .select('id, visibility')
          .eq('slug', slug)
          .eq('is_active', true)
          .single()
          .returns<{ id: string; visibility: string }>();

        if (!group) {
          return NextResponse.json(
            { error: 'Group not found' },
            { status: 404 }
          );
        }

        // Check if user is a member
        const { data: membership } = await supabase
          .from('group_members')
          .select('is_admin')
          .eq('group_id', (group as any).id)
          .eq('account_id', accountId)
          .maybeSingle();

        if (!membership) {
          return NextResponse.json(
            { error: 'You must be a member to view group members' },
            { status: 403 }
          );
        }

        // Get members
        const { data: members, error } = await supabase
          .from('group_members')
          .select(`
            id,
            group_id,
            account_id,
            is_admin,
            joined_at,
            account:accounts!group_members_account_id_fkey(
              id,
              username,
              first_name,
              last_name,
              image_url
            )
          `)
          .eq('group_id', (group as any).id)
          .order('is_admin', { ascending: false })
          .order('joined_at', { ascending: true })
          .range(offset, offset + limit - 1);

        if (error) {
          console.error('[Groups API] Error fetching members:', error);
          return NextResponse.json(
            { error: 'Failed to fetch members' },
            { status: 500 }
          );
        }

        return NextResponse.json({ members: members || [] });
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
      rateLimit: 'public',
      maxRequestSize: REQUEST_SIZE_LIMITS.json,
    }
  );
}

/**
 * POST /api/groups/[slug]/members
 * Join a group (public groups) or add a member (private groups, admin only)
 * 
 * Security:
 * - Rate limited: 60 requests/minute
 * - Requires authentication
 */
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

        // Get group
        const { data: group } = await supabase
          .from('groups')
          .select('id, visibility')
          .eq('slug', slug)
          .eq('is_active', true)
          .single()
          .returns<{ id: string; visibility: string }>();

        if (!group) {
          return NextResponse.json(
            { error: 'Group not found' },
            { status: 404 }
          );
        }

        // Check if already a member
        const { data: existingMember } = await supabase
          .from('group_members')
          .select('id')
          .eq('group_id', (group as any).id)
          .eq('account_id', accountId)
          .maybeSingle();

        if (existingMember) {
          return NextResponse.json(
            { error: 'You are already a member of this group' },
            { status: 409 }
          );
        }

        // For private groups, check if user is admin (to add others)
        // For now, we'll only allow joining public groups directly
        // Private group joining will require admin invitation (future feature)
        if ((group as any).visibility === 'private') {
          return NextResponse.json(
            { error: 'Private groups require an invitation to join' },
            { status: 403 }
          );
        }

        // Join group
        const { data: member, error } = await supabase
          .from('group_members')
          .insert({
            group_id: (group as any).id,
            account_id: accountId,
            is_admin: false,
          } as any)
          .select(`
            id,
            group_id,
            account_id,
            is_admin,
            joined_at,
            account:accounts!group_members_account_id_fkey(
              id,
              username,
              first_name,
              last_name,
              image_url
            )
          `)
          .single();

        if (error) {
          console.error('[Groups API] Error joining group:', error);
          return NextResponse.json(
            { error: 'Failed to join group' },
            { status: 500 }
          );
        }

        return NextResponse.json({ member }, { status: 201 });
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
 * DELETE /api/groups/[slug]/members
 * Leave a group or remove a member (admin only)
 * 
 * Security:
 * - Rate limited: 60 requests/minute
 * - Requires authentication
 */
export async function DELETE(
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
        const memberAccountId = searchParams.get('account_id'); // For admins removing others

        const supabase = await createServerClientWithAuth(cookies());

        // Get group
        const { data: group } = await supabase
          .from('groups')
          .select('id')
          .eq('slug', slug)
          .eq('is_active', true)
          .single()
          .returns<{ id: string }>();

        if (!group) {
          return NextResponse.json(
            { error: 'Group not found' },
            { status: 404 }
          );
        }

        const targetAccountId = memberAccountId || accountId;

        // If removing someone else, check if user is admin
        if (memberAccountId && memberAccountId !== accountId) {
          const { data: membership } = await supabase
            .from('group_members')
            .select('is_admin')
            .eq('group_id', (group as any).id)
            .eq('account_id', accountId)
            .single();

          if (!membership || !(membership as any).is_admin) {
            return NextResponse.json(
              { error: 'Only group admins can remove members' },
              { status: 403 }
            );
          }
        }

        // Remove member
        const { error } = await supabase
          .from('group_members')
          .delete()
          .eq('group_id', group.id)
          .eq('account_id', targetAccountId);

        if (error) {
          console.error('[Groups API] Error leaving group:', error);
          return NextResponse.json(
            { error: 'Failed to leave group' },
            { status: 500 }
          );
        }

        return NextResponse.json({ success: true });
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
