import { NextRequest, NextResponse } from 'next/server';
import { createServerClientWithAuth } from '@/lib/supabaseServer';
import { withSecurity } from '@/lib/security/middleware';
import { validateRequestBody } from '@/lib/security/validation';
import { REQUEST_SIZE_LIMITS } from '@/lib/security/middleware';
import { z } from 'zod';
import { cookies } from 'next/headers';

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
          .from('posts')
          .select(`
            id,
            account_id,
            title,
            content,
            visibility,
            group_id,
            mention_type_id,
            mention_ids,
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
            group:groups!posts_group_id_fkey(
              id,
              name,
              slug,
              image_url
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

        // Fetch mentions if referenced
        const postData = post as any;
        if (postData.mention_ids && Array.isArray(postData.mention_ids) && postData.mention_ids.length > 0) {
          const { data: mentions } = await supabase
            .from('mentions')
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
            .in('id', postData.mention_ids);

          postData.mentions = mentions || [];
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
  group_id: z.string().uuid().optional().nullable(),
  mention_type_id: z.string().uuid().optional().nullable(),
  mention_ids: z.array(z.string().uuid()).optional().nullable(),
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
          .from('posts')
          .select('id, account_id, group_id')
          .eq('id', id)
          .single();

        if (!post) {
          return NextResponse.json(
            { error: 'Post not found' },
            { status: 404 }
          );
        }

        if (post.account_id !== accountId) {
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
        if (validation.data.content !== undefined) updateData.content = validation.data.content.trim();
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
        if (validation.data.group_id !== undefined) {
          updateData.group_id = validation.data.group_id || null;
          
          // If changing group, verify user is a member of new group
          if (validation.data.group_id) {
            const { data: membership } = await supabase
              .from('group_members')
              .select('id')
              .eq('group_id', validation.data.group_id)
              .eq('account_id', accountId)
              .maybeSingle();

            if (!membership) {
              return NextResponse.json(
                { error: 'You must be a member of the group to post' },
                { status: 403 }
              );
            }
          }
        }
        if (validation.data.mention_ids !== undefined) {
          updateData.mention_ids = validation.data.mention_ids && validation.data.mention_ids.length > 0 
            ? validation.data.mention_ids 
            : null;

          // Validate mention IDs if provided
          if (validation.data.mention_ids && validation.data.mention_ids.length > 0) {
            const { data: mentions } = await supabase
              .from('mentions')
              .select('id')
              .in('id', validation.data.mention_ids);

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

        // Update post
        const { data: updatedPost, error } = await supabase
          .from('posts')
          .update(updateData)
          .eq('id', id)
          .select(`
            id,
            account_id,
            title,
            content,
            visibility,
            group_id,
            mention_type_id,
            mention_ids,
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
            group:groups!posts_group_id_fkey(
              id,
              name,
              slug,
              image_url
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

        // Fetch mentions if referenced
        if (updatedPost && updatedPost.mention_ids && Array.isArray(updatedPost.mention_ids) && updatedPost.mention_ids.length > 0) {
          const { data: mentions } = await supabase
            .from('mentions')
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
            .in('id', updatedPost.mention_ids);

          updatedPost.mentions = mentions || [];
        }

        return NextResponse.json({ post: updatedPost });
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

        // Get post and verify ownership
        const { data: post } = await supabase
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

        if (post.account_id !== accountId) {
          return NextResponse.json(
            { error: 'You can only delete your own posts' },
            { status: 403 }
          );
        }

        // Delete post
        const { error } = await supabase
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
