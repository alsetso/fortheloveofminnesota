import { NextRequest, NextResponse } from 'next/server';
import { createServerClientWithAuth } from '@/lib/supabaseServer';
import { withSecurity } from '@/lib/security/middleware';
import { validateRequestBody } from '@/lib/security/validation';
import { REQUEST_SIZE_LIMITS } from '@/lib/security/middleware';
import { z } from 'zod';
import { cookies } from 'next/headers';

/**
 * HEAD /api/groups/[slug]
 * Check if a group exists by slug (for availability checks)
 * 
 * Security:
 * - Rate limited: 200 requests/minute
 * - Optional authentication
 */
export async function HEAD(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  return withSecurity(
    request,
    async (req, { userId, accountId }) => {
      try {
        const { slug } = await params;
        const supabase = await createServerClientWithAuth(cookies());

        const { data: group, error } = await supabase
          .from('groups')
          .select('id')
          .eq('slug', slug)
          .eq('is_active', true)
          .maybeSingle();

        if (error || !group) {
          return new NextResponse(null, { status: 404 });
        }

        return new NextResponse(null, { status: 200 });
      } catch (error) {
        console.error('[Groups API] Error:', error);
        return new NextResponse(null, { status: 500 });
      }
    },
    {
      rateLimit: 'public',
      maxRequestSize: REQUEST_SIZE_LIMITS.json,
    }
  );
}

/**
 * GET /api/groups/[slug]
 * Get a single group by slug
 * 
 * Security:
 * - Rate limited: 200 requests/minute
 * - Optional authentication
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  return withSecurity(
    request,
    async (req, { userId, accountId }) => {
      try {
        const { slug } = await params;
        const supabase = await createServerClientWithAuth(cookies());

        const { data: group, error } = await supabase
          .from('groups')
          .select(`
            id,
            name,
            slug,
            description,
            cover_image_url,
            image_url,
            visibility,
            is_active,
            created_by_account_id,
            member_count,
            post_count,
            created_at,
            updated_at,
            created_by:accounts!groups_created_by_account_id_fkey(
              id,
              username,
              first_name,
              last_name,
              image_url
            )
          `)
          .eq('slug', slug)
          .eq('is_active', true)
          .single();

        if (error || !group) {
          return NextResponse.json(
            { error: 'Group not found' },
            { status: 404 }
          );
        }

        // Check membership and admin status for authenticated users
        if (accountId) {
          const { data: membership } = await supabase
            .from('group_members')
            .select('is_admin')
            .eq('group_id', group.id)
            .eq('account_id', accountId)
            .maybeSingle();

          group.is_member = !!membership;
          group.is_admin = membership?.is_admin || false;
        } else {
          group.is_member = false;
          group.is_admin = false;
        }

        return NextResponse.json({ group });
      } catch (error) {
        console.error('[Groups API] Error:', error);
        return NextResponse.json(
          { error: 'Internal server error' },
          { status: 500 }
        );
      }
    },
    {
      rateLimit: 'public',
      maxRequestSize: REQUEST_SIZE_LIMITS.json,
    }
  );
}

/**
 * PATCH /api/groups/[slug]
 * Update a group (admin only)
 * 
 * Security:
 * - Rate limited: 60 requests/minute
 * - Requires authentication
 * - Requires group admin access
 */
const updateGroupSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(1000).optional().nullable(),
  cover_image_url: z.string().url().optional().nullable(),
  image_url: z.string().url().optional().nullable(),
  visibility: z.enum(['public', 'private']).optional(),
});

export async function PATCH(
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
            { error: 'Only group admins can update groups' },
            { status: 403 }
          );
        }

        // Validate request body
        const validation = await validateRequestBody(req, updateGroupSchema, REQUEST_SIZE_LIMITS.json);
        if (!validation.success) {
          return validation.error;
        }

        const updateData: Record<string, any> = {};
        if (validation.data.name !== undefined) updateData.name = validation.data.name.trim();
        if (validation.data.description !== undefined) updateData.description = validation.data.description?.trim() || null;
        if (validation.data.cover_image_url !== undefined) updateData.cover_image_url = validation.data.cover_image_url || null;
        if (validation.data.image_url !== undefined) updateData.image_url = validation.data.image_url || null;
        if (validation.data.visibility !== undefined) updateData.visibility = validation.data.visibility;

        // Update group
        const { data: updatedGroup, error } = await supabase
          .from('groups')
          .update(updateData)
          .eq('id', group.id)
          .select(`
            id,
            name,
            slug,
            description,
            cover_image_url,
            image_url,
            visibility,
            is_active,
            created_by_account_id,
            member_count,
            post_count,
            created_at,
            updated_at,
            created_by:accounts!groups_created_by_account_id_fkey(
              id,
              username,
              first_name,
              last_name,
              image_url
            )
          `)
          .single();

        if (error) {
          console.error('[Groups API] Error updating group:', error);
          return NextResponse.json(
            { error: 'Failed to update group' },
            { status: 500 }
          );
        }

        if (updatedGroup) {
          updatedGroup.is_member = true;
          updatedGroup.is_admin = true;
        }

        return NextResponse.json({ group: updatedGroup });
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
 * DELETE /api/groups/[slug]
 * Delete a group (admin only, soft delete via is_active)
 * 
 * Security:
 * - Rate limited: 10 requests/minute
 * - Requires authentication
 * - Requires group admin access
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
            { error: 'Only group admins can delete groups' },
            { status: 403 }
          );
        }

        // Soft delete
        const { error } = await supabase
          .from('groups')
          .update({ is_active: false })
          .eq('id', group.id);

        if (error) {
          console.error('[Groups API] Error deleting group:', error);
          return NextResponse.json(
            { error: 'Failed to delete group' },
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
      rateLimit: 'strict',
      maxRequestSize: REQUEST_SIZE_LIMITS.json,
    }
  );
}
