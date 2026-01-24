import { NextRequest, NextResponse } from 'next/server';
import { createServerClientWithAuth } from '@/lib/supabaseServer';
import { withSecurity } from '@/lib/security/middleware';
import { validateRequestBody } from '@/lib/security/validation';
import { REQUEST_SIZE_LIMITS } from '@/lib/security/middleware';
import { z } from 'zod';
import { cookies } from 'next/headers';

/**
 * GET /api/posts
 * List posts (feed posts and group posts)
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
        
        const account_id = searchParams.get('account_id');
        const group_id = searchParams.get('group_id');
        const mention_time = searchParams.get('mention_time') as '24h' | '7d' | 'all' | null;
        const limit = parseInt(searchParams.get('limit') || '20', 10);
        const offset = parseInt(searchParams.get('offset') || '0', 10);

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
              image_url,
              plan
            ),
            mention_type:mention_types(
              id,
              emoji,
              name
            ),
            group:groups!posts_group_id_fkey(
              id,
              name,
              slug,
              image_url
            )
          `)
          .order('created_at', { ascending: false })
          .range(offset, offset + limit - 1);

        // Filter by group_id or exclude group posts
        if (group_id) {
          query = query.eq('group_id', group_id);
          // For group posts, visibility is handled by RLS policies (group members can see all group posts)
          // No additional visibility filtering needed here
        } else {
          // Default: only show feed posts (no group_id)
          query = query.is('group_id', null);
          
          // For feed posts, apply visibility filtering
          // For anonymous users, only show public posts
          if (!accountId) {
            query = query.eq('visibility', 'public');
          } else {
            // For authenticated users, show public posts and their own posts (including drafts)
            query = query.or(`visibility.eq.public,account_id.eq.${accountId}`);
          }
        }

        // Filter by account
        if (account_id) {
          query = query.eq('account_id', account_id);
        }

        const { data: posts, error } = await query;

        if (error) {
          console.error('[Posts API] Error fetching posts:', error);
          return NextResponse.json(
            { error: 'Failed to fetch posts' },
            { status: 500 }
          );
        }

        // If mention_time filter is set, filter posts by mention creation time
        let filteredPosts: any[] = posts || [];
        if (mention_time && mention_time !== 'all' && posts && posts.length > 0) {
          // Calculate cutoff date
          const now = new Date();
          let cutoffDate: Date;
          if (mention_time === '24h') {
            cutoffDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          } else if (mention_time === '7d') {
            cutoffDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          } else {
            cutoffDate = now;
          }

          // Get all mention IDs from posts
          const allMentionIds = posts
            .filter((p: any) => p.mention_ids && Array.isArray(p.mention_ids) && p.mention_ids.length > 0)
            .flatMap((p: any) => p.mention_ids as string[]);

          if (allMentionIds.length > 0) {
            const uniqueMentionIds = [...new Set(allMentionIds)];
            
            // Fetch mentions that match the time filter
            const { data: filteredMentions } = await supabase
              .from('mentions')
              .select('id')
              .in('id', uniqueMentionIds)
              .gte('created_at', cutoffDate.toISOString());

            const validMentionIds = new Set((filteredMentions || []).map((m: any) => m.id));

            // Filter posts to only include those with mentions in the time range
            filteredPosts = posts.filter((post: any) => {
              // If post has no mentions, exclude it when filtering by mention time
              if (!post.mention_ids || !Array.isArray(post.mention_ids) || post.mention_ids.length === 0) {
                return false;
              }
              // Include post if at least one of its mentions is in the valid set
              return post.mention_ids.some((id: string) => validMentionIds.has(id));
            });
          } else {
            // No mentions in any posts, so filter out all posts when filtering by mention time
            filteredPosts = [];
          }
        }

        // Fetch mentions for the filtered posts
        if (filteredPosts && filteredPosts.length > 0) {
          const allMentionIds = filteredPosts
            .filter((p: any) => p.mention_ids && Array.isArray(p.mention_ids) && p.mention_ids.length > 0)
            .flatMap((p: any) => p.mention_ids as string[]);

          if (allMentionIds.length > 0) {
            const uniqueMentionIds = [...new Set(allMentionIds)];
            const { data: mentions } = await supabase
              .from('mentions')
              .select(`
                id,
                lat,
                lng,
                description,
                image_url,
                account_id,
                created_at,
                mention_type:mention_types(
                  emoji,
                  name
                )
              `)
              .in('id', uniqueMentionIds);

            const mentionsMap = new Map(
              (mentions || []).map((m: any) => [m.id, m])
            );

            filteredPosts.forEach((post: any) => {
              if (post.mention_ids && Array.isArray(post.mention_ids)) {
                post.mentions = post.mention_ids
                  .map((id: string) => mentionsMap.get(id))
                  .filter(Boolean) as any[];
              }
            });
          }
        }

        return NextResponse.json({ posts: filteredPosts || [] });
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
 * POST /api/posts
 * Create a new post
 * 
 * Security:
 * - Rate limited: 60 requests/minute
 * - Requires authentication
 */
const createPostSchema = z.object({
  title: z.string().max(200).optional().nullable(),
  content: z.string().min(1).max(10000),
  visibility: z.enum(['public', 'draft']).default('public'),
  group_id: z.string().uuid().optional().nullable(),
  mention_type_id: z.string().uuid().optional().nullable(),
  mention_ids: z.array(z.string().uuid()).optional().nullable(),
  images: z.array(z.object({
    url: z.string().url(),
    alt: z.string().optional(),
    width: z.number().optional(),
    height: z.number().optional(),
  })).optional().nullable(),
  map_data: z.object({
    lat: z.number(),
    lng: z.number(),
    type: z.enum(['pin', 'area', 'both']).optional(),
    geometry: z.any().optional(), // GeoJSON geometry
    screenshot: z.string().optional(), // Base64 encoded image
    address: z.string().optional(),
    place_name: z.string().optional(),
  }).optional().nullable(),
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

        // Validate request body
        const validation = await validateRequestBody(req, createPostSchema, REQUEST_SIZE_LIMITS.json);
        if (!validation.success) {
          return validation.error;
        }

        const { title, content, visibility, group_id, mention_type_id, mention_ids, images, map_data } = validation.data;

        // If posting to a group, verify user is a member
        if (group_id) {
          const { data: membership } = await supabase
            .from('group_members')
            .select('id')
            .eq('group_id', group_id)
            .eq('account_id', accountId)
            .maybeSingle();

          if (!membership) {
            return NextResponse.json(
              { error: 'You must be a member of the group to post' },
              { status: 403 }
            );
          }
        }

        // Validate mention_type_id if provided
        if (mention_type_id) {
          const { data: mentionType } = await supabase
            .from('mention_types')
            .select('id')
            .eq('id', mention_type_id)
            .maybeSingle();

          if (!mentionType) {
            return NextResponse.json(
              { error: 'Invalid mention_type_id' },
              { status: 400 }
            );
          }
        }

        // Validate mention IDs if provided
        if (mention_ids && mention_ids.length > 0) {
          const { data: mentions } = await supabase
            .from('mentions')
            .select('id')
            .in('id', mention_ids);

          if (!mentions || mentions.length !== mention_ids.length) {
            return NextResponse.json(
              { error: 'One or more mention IDs are invalid' },
              { status: 400 }
            );
          }
        }

        // Create post
        const { data: post, error } = await supabase
          .from('posts')
          .insert({
            account_id: accountId,
            title: title?.trim() || null,
            content: content.trim(),
            visibility,
            group_id: group_id || null,
            mention_type_id: mention_type_id || null,
            mention_ids: mention_ids && mention_ids.length > 0 ? mention_ids : null,
            images: images && images.length > 0 ? images : null,
            map_data: map_data || null,
          } as any)
          .select(`
            id,
            account_id,
            title,
            content,
            visibility,
            group_id,
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
              image_url,
              plan
            ),
            group:groups!posts_group_id_fkey(
              id,
              name,
              slug,
              image_url
            )
          `)
          .single();

        if (error) {
          console.error('[Posts API] Error creating post:', error);
          return NextResponse.json(
            { error: 'Failed to create post' },
            { status: 500 }
          );
        }

        // Fetch mentions if referenced
        const postData = post as any;
        if (postData && postData.mention_ids && Array.isArray(postData.mention_ids) && postData.mention_ids.length > 0) {
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
            .in('id', postData.mention_ids);

          postData.mentions = mentions || [];
        }

        return NextResponse.json({ post: postData }, { status: 201 });
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
