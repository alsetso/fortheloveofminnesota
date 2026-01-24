import { NextRequest, NextResponse } from 'next/server';
import { createServerClientWithAuth } from '@/lib/supabaseServer';
import { withSecurity } from '@/lib/security/middleware';
import { validateRequestBody } from '@/lib/security/validation';
import { REQUEST_SIZE_LIMITS } from '@/lib/security/middleware';
import { z } from 'zod';
import { cookies } from 'next/headers';

/**
 * GET /api/groups
 * List groups (public groups visible to all, private groups visible to members)
 * 
 * Security:
 * - Rate limited: 200 requests/minute
 * - Optional authentication
 */
export async function GET(request: NextRequest) {
  return withSecurity(
    request,
    async (req, { userId, accountId }) => {
      try {
        const supabase = await createServerClientWithAuth(cookies());
        const { searchParams } = new URL(req.url);
        
        const visibility = searchParams.get('visibility') as 'public' | 'private' | null;
        const search = searchParams.get('search');
        const limit = parseInt(searchParams.get('limit') || '20', 10);
        const offset = parseInt(searchParams.get('offset') || '0', 10);

        // Build query - show all groups (public + private groups user can see)
        // RLS policies will filter private groups for non-members
        let query = supabase
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
          .eq('is_active', true)
          .order('created_at', { ascending: false })
          .range(offset, offset + limit - 1);

        // Filter by visibility (if specified)
        if (visibility) {
          query = query.eq('visibility', visibility);
        }

        // Search by name or description
        if (search) {
          query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`);
        }

        const { data: groups, error } = await query;

        if (error) {
          console.error('[Groups API] Error fetching groups:', error);
          return NextResponse.json(
            { error: 'Failed to fetch groups' },
            { status: 500 }
          );
        }

        // For authenticated users, check membership and admin status
        if (accountId && groups) {
          const groupIds = (groups as any[]).map((g: any) => g.id);
          const { data: memberships } = await supabase
            .from('group_members')
            .select('group_id, is_admin')
            .eq('account_id', accountId)
            .in('group_id', groupIds)
            .returns<Array<{ group_id: string; is_admin: boolean }>>();

          const membershipMap = new Map(
            (memberships || []).map((m: any) => [m.group_id, { is_member: true, is_admin: m.is_admin }])
          );

          (groups as any[]).forEach((group: any) => {
            const membership = membershipMap.get(group.id);
            group.is_member = membership?.is_member || false;
            group.is_admin = membership?.is_admin || false;
          });
        }

        return NextResponse.json({ groups: groups || [] });
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
 * POST /api/groups
 * Create a new group
 * 
 * Security:
 * - Rate limited: 60 requests/minute
 * - Requires authentication
 * - Requires Contributor plan or higher
 */
const createGroupSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/, 'Slug can only contain lowercase letters, numbers, and hyphens'),
  description: z.string().max(1000).optional().nullable(),
  cover_image_url: z.string().url().optional().nullable(),
  image_url: z.string().url().optional().nullable(),
  visibility: z.enum(['public', 'private']).default('public'),
});

export async function POST(request: NextRequest) {
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

        const supabase = await createServerClientWithAuth(cookies());

        // Check if user has Contributor plan or higher
        const { data: account } = await supabase
          .from('accounts')
          .select('plan, subscription_status')
          .eq('id', accountId)
          .single();

        if (!account) {
          return NextResponse.json(
            { error: 'Account not found' },
            { status: 404 }
          );
        }

        // Check if user has Contributor, Professional, or Business plan
        const hasContributorAccess = 
          (account as any).plan === 'contributor' || 
          (account as any).plan === 'professional' || 
          (account as any).plan === 'business' ||
          (account as any).plan === 'plus'; // Legacy plus plan also has access

        const isActive = 
          (account as any).subscription_status === 'active' || 
          (account as any).subscription_status === 'trialing';

        if (!hasContributorAccess || !isActive) {
          return NextResponse.json(
            { error: 'Group creation requires a Contributor plan or higher with an active subscription. Upgrade to create groups.' },
            { status: 403 }
          );
        }

        // Validate request body
        const validation = await validateRequestBody(req, createGroupSchema, REQUEST_SIZE_LIMITS.json);
        if (!validation.success) {
          return validation.error;
        }

        const { name, slug, description, cover_image_url, image_url, visibility } = validation.data;

        // Check if slug is already taken
        const { data: existingGroup } = await supabase
          .from('groups')
          .select('id')
          .eq('slug', slug)
          .maybeSingle();

        if (existingGroup) {
          return NextResponse.json(
            { error: 'Group slug is already taken' },
            { status: 409 }
          );
        }

        // Create group
        const { data: group, error } = await supabase
          .from('groups')
          .insert({
            name: name.trim(),
            slug: slug.trim().toLowerCase(),
            description: description?.trim() || null,
            cover_image_url: cover_image_url || null,
            image_url: image_url || null,
            visibility,
            created_by_account_id: accountId,
          } as never)
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
          console.error('[Groups API] Error creating group:', error);
          return NextResponse.json(
            { error: 'Failed to create group' },
            { status: 500 }
          );
        }

        // Creator is automatically added as admin by trigger
        // Add membership info
        if (group) {
          (group as any).is_member = true;
          (group as any).is_admin = true;
        }

        return NextResponse.json({ group }, { status: 201 });
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
