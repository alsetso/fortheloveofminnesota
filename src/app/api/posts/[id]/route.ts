import { NextRequest, NextResponse } from 'next/server';
import { createServerClientWithAuth } from '@/lib/supabaseServer';
import { withSecurity } from '@/lib/security/middleware';
import { validateRequestBody } from '@/lib/security/validation';
import { REQUEST_SIZE_LIMITS } from '@/lib/security/middleware';
import { z } from 'zod';
import { cookies } from 'next/headers';
import { parseAndResolveUsernames } from '@/lib/posts/parseUsernames';

/**
 * GET /api/posts/[id]
 * Get a single post by ID
 * 
 * Security:
 * - Rate limited: 200 requests/minute
 * - Optional authentication
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withSecurity(
    request,
    async (req, { userId, accountId }) => {
      try {
        const { id } = await params;
        const supabase = await createServerClientWithAuth(cookies());

        let query = supabase
          .schema('content')
          .from('posts')
          .select(`
            id,
            account_id,
            title,
            content,
            visibility,
            mention_type_id,
            mention_ids,
            tagged_account_ids,
            map_id,
            images,
            map_data,
            shared_post_id,
            created_at,
            updated_at,
            account:accounts!posts_account_id_fkey(
              id,
              username,
              first_name,
              last_name,
              image_url
            ),
            map:map!posts_map_id_fkey(
              id,
              name,
              slug,
              visibility
            ),
            mention_type:mention_types(
              id,
              emoji,
              name
            )
          `)
          .eq('id', id);

        // For anonymous users, only show public posts
        if (!accountId) {
          query = query.eq('visibility', 'public');
        } else {
          // For authenticated users, show public posts and their own posts (including drafts)
          query = query.or(`visibility.eq.public,account_id.eq.${accountId}`);
        }

        const { data: post, error } = await query.single();

        if (error || !post) {
          return NextResponse.json(
            { error: 'Post not found' },
            { status: 404 }
          );
        }

        // Fetch mentions if referenced (now map_pins)
        const postData = post as any;
        if (postData.mention_ids && Array.isArray(postData.mention_ids) && postData.mention_ids.length > 0) {
          const { data: mentions } = await supabase
            .schema('maps')
            .from('pins')
            .select(`
              id,
              lat,
              lng,
              description,
              image_url,
              account_id,
              mention_type:mention_types(
                emoji,
                name
              ),
              collection:collections(
                emoji,
                title
              )
            `)
            .in('id', postData.mention_ids)
            .eq('is_active', true)
            .eq('archived', false);

          postData.mentions = mentions || [];
        }

        // Fetch tagged accounts if any
        if (postData.tagged_account_ids && Array.isArray(postData.tagged_account_ids) && postData.tagged_account_ids.length > 0) {
          const { data: taggedAccounts } = await supabase
            .from('accounts')
            .select('id, username, first_name, last_name, image_url')
            .in('id', postData.tagged_account_ids);
          
          postData.tagged_accounts = taggedAccounts || [];
        } else {
          postData.tagged_accounts = [];
        }

        // Fetch shared post if exists
        if (postData.shared_post_id) {
          const { data: sharedPost } = await supabase
            .schema('content')
            .from('posts')
            .select(`
              id,
              account_id,
              title,
              content,
              visibility,
              mention_type_id,
              mention_ids,
              tagged_account_ids,
              map_id,
              images,
              map_data,
              background_color,
              created_at,
              updated_at
            `)
            .eq('id', postData.shared_post_id)
            .eq('visibility', 'public')
            .maybeSingle();

          if (sharedPost) {
            // Fetch account for shared post
            const { data: sharedPostAccount } = await supabase
              .from('accounts')
              .select('id, username, first_name, last_name, image_url, plan')
              .eq('id', sharedPost.account_id)
              .maybeSingle();

            postData.shared_post = {
              ...sharedPost,
              account: sharedPostAccount || null,
            };
          } else {
            postData.shared_post = null;
          }
        } else {
          postData.shared_post = null;
        }

        return NextResponse.json({ post: postData });
      } catch (error) {
        console.error('[Posts API] Error:', error);
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
 * PATCH /api/posts/[id]
 * Update a post (owner only)
 * 
 * Security:
 * - Rate limited: 60 requests/minute
 * - Requires authentication
 * - Requires post ownership
 */
const updatePostSchema = z.object({
  title: z.string().max(200).optional().nullable(),
  content: z.string().min(1).max(10000).optional(),
  visibility: z.enum(['public', 'draft']).optional(),
  mention_type_id: z.string().uuid().optional().nullable(),
  mention_ids: z.array(z.string().uuid()).optional().nullable(),
  map_id: z.string().uuid().optional().nullable(),
  map_data: z.object({
    lat: z.number(),
    lng: z.number(),
    type: z.enum(['pin', 'area', 'both']).optional(),
    geometry: z.any().optional(),
    screenshot: z.string().optional(),
    address: z.string().optional(),
    place_name: z.string().optional(),
  }).optional().nullable(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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

        const { id } = await params;
        const supabase = await createServerClientWithAuth(cookies());

        // Get post and verify ownership
        const { data: post } = await supabase
          .schema('content')
          .from('posts')
          .select('id, account_id')
          .eq('id', id)
          .single();

        if (!post) {
          return NextResponse.json(
            { error: 'Post not found' },
            { status: 404 }
          );
        }

        if ((post as any).account_id !== accountId) {
          return NextResponse.json(
            { error: 'You can only update your own posts' },
            { status: 403 }
          );
        }

        // Validate request body
        const validation = await validateRequestBody(req, updatePostSchema, REQUEST_SIZE_LIMITS.json);
        if (!validation.success) {
          return validation.error;
        }

        const updateData: Record<string, any> = {};
        if (validation.data.title !== undefined) updateData.title = validation.data.title?.trim() || null;
        if (validation.data.content !== undefined) {
          const trimmedContent = validation.data.content.trim();
          updateData.content = trimmedContent;
          
          // Parse @username patterns from content and resolve to account IDs
          const taggedAccountIds = await parseAndResolveUsernames(supabase, trimmedContent);
          updateData.tagged_account_ids = taggedAccountIds.length > 0 ? taggedAccountIds : null;
        }
        if (validation.data.visibility !== undefined) updateData.visibility = validation.data.visibility;
        if (validation.data.mention_type_id !== undefined) {
          updateData.mention_type_id = validation.data.mention_type_id || null;
          
          // If setting mention_type_id, validate it exists
          if (validation.data.mention_type_id) {
            const { data: mentionType } = await supabase
              .from('mention_types')
              .select('id')
              .eq('id', validation.data.mention_type_id)
              .maybeSingle();

            if (!mentionType) {
              return NextResponse.json(
                { error: 'Invalid mention_type_id' },
                { status: 400 }
              );
            }
          }
        }
        if (validation.data.mention_ids !== undefined) {
          updateData.mention_ids = validation.data.mention_ids && validation.data.mention_ids.length > 0 
            ? validation.data.mention_ids 
            : null;

          // Validate mention IDs if provided (now map_pins)
          if (validation.data.mention_ids && validation.data.mention_ids.length > 0) {
            const { data: mentions } = await supabase
              .schema('maps')
            .from('pins')
              .select('id')
              .in('id', validation.data.mention_ids)
              .eq('is_active', true)
              .eq('archived', false);

            if (!mentions || mentions.length !== validation.data.mention_ids.length) {
              return NextResponse.json(
                { error: 'One or more mention IDs are invalid' },
                { status: 400 }
              );
            }
          }
        }
        if (validation.data.map_data !== undefined) {
          updateData.map_data = validation.data.map_data;
        }
        if (validation.data.map_id !== undefined) {
          // Validate map_id if provided
          if (validation.data.map_id) {
            // Check if map exists and is active
            const { data: map, error: mapError } = await supabase
              .schema('maps')
              .from('maps')
              .select(`
                id,
                visibility,
                is_active,
                settings,
                account_id
              `)
              .eq('id', validation.data.map_id)
              .eq('is_active', true)
              .maybeSingle();

            if (mapError || !map) {
              return NextResponse.json(
                { error: 'Map not found or inactive' },
                { status: 400 }
              );
            }

            // Check if user has access to the map
            const mapAccountId = map && typeof map === 'object' && 'account_id' in map ? (map as { account_id: string }).account_id : null;
            const isMapOwner = mapAccountId === accountId;
            
            // Check if user is map member (for private maps)
            let isMapMember = false;
            let userRole: string | null = null;
            if (!isMapOwner) {
              const { data: membership } = await supabase
                .from('map_members')
                .select('role')
                .eq('map_id', validation.data.map_id)
                .eq('account_id', accountId)
                .maybeSingle();
              
              isMapMember = !!membership;
              const membershipRole = membership && typeof membership === 'object' && 'role' in membership ? (membership as { role: string }).role : null;
              userRole = membershipRole || null;
            }

            const mapVisibility = map && typeof map === 'object' && 'visibility' in map ? (map as { visibility: string }).visibility : null;
            const isPublicMap = mapVisibility === 'public';
            const mapSettings = map && typeof map === 'object' && 'settings' in map ? (map as { settings: any }).settings : {};
            const collaboration = mapSettings?.collaboration || {};
            const allowPosts = collaboration.allow_posts === true;

            // Check access: owner/manager can always post, or public map with allow_posts, or member with allow_posts
            const isManager = userRole === 'owner' || userRole === 'manager';
            const canPost = isMapOwner || 
              isManager ||
              (isPublicMap && allowPosts) || 
              (isMapMember && allowPosts);

            if (!canPost) {
              return NextResponse.json(
                { error: 'You do not have permission to assign posts to this map' },
                { status: 403 }
              );
            }
          }
          
          updateData.map_id = validation.data.map_id || null;
        }

        // Update post
        const { data: updatedPost, error } = await supabase
          .schema('content')
          .from('posts')
          .update(updateData as never)
          .eq('id', id)
          .select(`
            id,
            account_id,
            title,
            content,
            visibility,
            mention_type_id,
            mention_ids,
            map_id,
            images,
            map_data,
            created_at,
            updated_at,
            account:accounts!posts_account_id_fkey(
              id,
              username,
              first_name,
              last_name,
              image_url
            ),
            map:map!posts_map_id_fkey(
              id,
              name,
              slug,
              visibility
            ),
            mention_type:mention_types(
              id,
              emoji,
              name
            )
          `)
          .single();

        if (error) {
          console.error('[Posts API] Error updating post:', error);
          return NextResponse.json(
            { error: 'Failed to update post' },
            { status: 500 }
          );
        }

        // Fetch mentions if referenced (now map_pins)
        const updatedPostData = updatedPost as any;
        if (updatedPostData && updatedPostData.mention_ids && Array.isArray(updatedPostData.mention_ids) && updatedPostData.mention_ids.length > 0) {
          const { data: mentions } = await supabase
            .schema('maps')
            .from('pins')
            .select(`
              id,
              lat,
              lng,
              description,
              image_url,
              account_id,
              mention_type:mention_types(
                emoji,
                name
              )
            `)
            .in('id', updatedPostData.mention_ids)
            .eq('is_active', true)
            .eq('archived', false);

          updatedPostData.mentions = mentions || [];
        }

        // Fetch tagged accounts if any
        if (updatedPostData.tagged_account_ids && Array.isArray(updatedPostData.tagged_account_ids) && updatedPostData.tagged_account_ids.length > 0) {
          const { data: taggedAccounts } = await supabase
            .from('accounts')
            .select('id, username, first_name, last_name, image_url')
            .in('id', updatedPostData.tagged_account_ids);
          
          updatedPostData.tagged_accounts = taggedAccounts || [];
        } else {
          updatedPostData.tagged_accounts = [];
        }

        return NextResponse.json({ post: updatedPostData });
      } catch (error) {
        console.error('[Posts API] Error:', error);
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
 * DELETE /api/posts/[id]
 * Delete a post (owner only)
 * 
 * Security:
 * - Rate limited: 60 requests/minute
 * - Requires authentication
 * - Requires post ownership
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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

        const { id } = await params;
        const supabase = await createServerClientWithAuth(cookies());

        // Get post and verify ownership or map manager status
        const { data: post } = await supabase
          .schema('content')
          .from('posts')
          .select('id, account_id, map_id')
          .eq('id', id)
          .single();

        if (!post) {
          return NextResponse.json(
            { error: 'Post not found' },
            { status: 404 }
          );
        }

        const isOwner = (post as any).account_id === accountId;
        let isMapManager = false;

        // Check if user is map manager (if post has map_id)
        if ((post as any).map_id && !isOwner) {
          const { data: membership } = await supabase
            .from('map_members')
            .select('role')
            .eq('map_id', (post as any).map_id)
            .eq('account_id', accountId)
            .maybeSingle();
          
          const membershipRole = membership && typeof membership === 'object' && 'role' in membership ? (membership as { role: string }).role : null;
          isMapManager = membershipRole === 'owner' || membershipRole === 'manager';
        }

        if (!isOwner && !isMapManager) {
          return NextResponse.json(
            { error: 'You can only delete your own posts or posts on maps you manage' },
            { status: 403 }
          );
        }

        // Delete post
        const { error } = await supabase
          .schema('content')
          .from('posts')
          .delete()
          .eq('id', id);

        if (error) {
          console.error('[Posts API] Error deleting post:', error);
          return NextResponse.json(
            { error: 'Failed to delete post' },
            { status: 500 }
          );
        }

        return NextResponse.json({ success: true });
      } catch (error) {
        console.error('[Posts API] Error:', error);
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
