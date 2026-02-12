import { NextRequest, NextResponse } from 'next/server';
import { createServerClientWithAuth } from '@/lib/supabaseServer';
import { withSecurity } from '@/lib/security/middleware';
import { validateRequestBody } from '@/lib/security/validation';
import { REQUEST_SIZE_LIMITS } from '@/lib/security/middleware';
import { z } from 'zod';
import { cookies } from 'next/headers';
import { parseAndResolveUsernames } from '@/lib/posts/parseUsernames';

/**
 * GET /api/posts
 * List posts (feed posts only)
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
        const mention_time = searchParams.get('mention_time') as '24h' | '7d' | 'all' | null;
        const mention_type_id = searchParams.get('mention_type_id');
        const limit = parseInt(searchParams.get('limit') || '20', 10);
        const offset = parseInt(searchParams.get('offset') || '0', 10);

        const map_id = searchParams.get('map_id');

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
            background_color,
            shared_post_id,
            created_at,
            updated_at
          `)
          .order('created_at', { ascending: false })
          .range(offset, offset + limit - 1);

        // Note: group_id is not filtered - posts with or without group_id are returned
        // Apply visibility filtering
        // For anonymous users, only show public posts
        if (!accountId) {
          query = query.eq('visibility', 'public');
          // Filter by account if specified (only public posts)
          if (account_id) {
            query = query.eq('account_id', account_id);
          }
        } else {
          // For authenticated users
          if (account_id) {
            // Filtering by a specific account
            if (account_id === accountId) {
              // Viewing own account: show all posts (public + drafts)
              query = query.eq('account_id', accountId);
            } else {
              // Viewing another account: only show public posts
              query = query.eq('account_id', account_id).eq('visibility', 'public');
            }
          } else {
            // General feed: show public posts and own posts (including drafts)
            query = query.or(`visibility.eq.public,account_id.eq.${accountId}`);
          }
        }

        // Filter by mention_type_id
        if (mention_type_id) {
          query = query.eq('mention_type_id', mention_type_id);
        }

        // Filter by map_id
        if (map_id) {
          query = query.eq('map_id', map_id);
        }

        const { data: posts, error } = await query;

        if (error) {
          console.error('[Posts API] Error fetching posts:', error);
          return NextResponse.json(
            { error: 'Failed to fetch posts' },
            { status: 500 }
          );
        }

        // Fetch related data separately (cross-schema joins not supported)
        const accountIds = [...new Set((posts || []).map((p: any) => p.account_id).filter(Boolean))];
        const mapIds = [...new Set((posts || []).map((p: any) => p.map_id).filter(Boolean))];
        const mentionTypeIds = [...new Set((posts || []).map((p: any) => p.mention_type_id).filter(Boolean))];

        // Fetch accounts
        const accountsMap = new Map();
        if (accountIds.length > 0) {
          const { data: accounts } = await supabase
            .from('accounts')
            .select('id, username, first_name, last_name, image_url, plan')
            .in('id', accountIds);
          
          if (accounts) {
            accounts.forEach((acc: any) => {
              accountsMap.set(acc.id, acc);
            });
          }
        }

        // Fetch maps
        const mapsMap = new Map();
        if (mapIds.length > 0) {
          const { data: maps } = await supabase
            .schema('maps')
            .from('maps')
            .select('id, name, slug, visibility')
            .in('id', mapIds);
          
          if (maps) {
            maps.forEach((map: any) => {
              mapsMap.set(map.id, map);
            });
          }
        }

        // Fetch mention types
        const mentionTypesMap = new Map();
        if (mentionTypeIds.length > 0) {
          const { data: mentionTypes } = await supabase
            .from('mention_types')
            .select('id, emoji, name')
            .in('id', mentionTypeIds);
          
          if (mentionTypes) {
            mentionTypes.forEach((mt: any) => {
              mentionTypesMap.set(mt.id, mt);
            });
          }
        }

        // Fetch tagged accounts for all posts
        const allTaggedAccountIds = [...new Set(
          (posts || [])
            .filter((p: any) => p.tagged_account_ids && Array.isArray(p.tagged_account_ids) && p.tagged_account_ids.length > 0)
            .flatMap((p: any) => p.tagged_account_ids as string[])
        )];
        
        const taggedAccountsMap = new Map();
        if (allTaggedAccountIds.length > 0) {
          const { data: taggedAccounts } = await supabase
            .from('accounts')
            .select('id, username, first_name, last_name, image_url')
            .in('id', allTaggedAccountIds);
          
          if (taggedAccounts) {
            taggedAccounts.forEach((acc: any) => {
              taggedAccountsMap.set(acc.id, acc);
            });
          }
        }

        // Fetch shared posts if any posts have shared_post_id
        const sharedPostIds = [...new Set((posts || []).map((p: any) => p.shared_post_id).filter(Boolean))];
        const sharedPostsMap = new Map();
        if (sharedPostIds.length > 0) {
          const { data: sharedPosts } = await supabase
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
            .in('id', sharedPostIds)
            .eq('visibility', 'public'); // Only fetch public shared posts
          
          if (sharedPosts) {
            // Fetch accounts for shared posts
            const sharedPostAccountIds = [...new Set(sharedPosts.map((sp: any) => sp.account_id).filter(Boolean))];
            const sharedPostAccountsMap = new Map();
            if (sharedPostAccountIds.length > 0) {
              const { data: sharedPostAccounts } = await supabase
                .from('accounts')
                .select('id, username, first_name, last_name, image_url, plan')
                .in('id', sharedPostAccountIds);
              
              if (sharedPostAccounts) {
                sharedPostAccounts.forEach((acc: any) => {
                  sharedPostAccountsMap.set(acc.id, acc);
                });
              }
            }
            
            // Attach account info to shared posts
            sharedPosts.forEach((sp: any) => {
              sharedPostsMap.set(sp.id, {
                ...sp,
                account: sharedPostAccountsMap.get(sp.account_id) || null,
              });
            });
          }
        }

        // Merge related data into posts
        const postsWithRelations = (posts || []).map((post: any) => ({
          ...post,
          account: accountsMap.get(post.account_id) || null,
          map: post.map_id ? (mapsMap.get(post.map_id) || null) : null,
          mention_type: post.mention_type_id ? (mentionTypesMap.get(post.mention_type_id) || null) : null,
          tagged_accounts: post.tagged_account_ids && Array.isArray(post.tagged_account_ids)
            ? post.tagged_account_ids.map((id: string) => taggedAccountsMap.get(id)).filter(Boolean)
            : [],
          shared_post: post.shared_post_id ? (sharedPostsMap.get(post.shared_post_id) || null) : null,
        }));

        // If mention_time filter is set, filter posts by mention creation time
        let filteredPosts: any[] = postsWithRelations;
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
            
            // Fetch mentions that match the time filter (now map_pins)
            const { data: filteredMentions } = await supabase
              .schema('maps')
              .from('pins')
              .select('id')
              .in('id', uniqueMentionIds)
              .eq('is_active', true)
              .eq('archived', false)
              .gte('created_at', cutoffDate.toISOString());

            const validMentionIds = new Set((filteredMentions || []).map((m: any) => m.id));

            // Filter posts to only include those with mentions in the time range
            filteredPosts = postsWithRelations.filter((post: any) => {
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
              .schema('maps')
              .from('pins')
              .select(`
                id,
                lat,
                lng,
                body,
                image_url,
                author_account_id,
                tag_id,
                created_at
              `)
              .in('id', uniqueMentionIds)
              .eq('is_active', true)
              .eq('archived', false);

            // Fetch mention types separately
            const mentionTypeIds = [...new Set((mentions || []).map((m: any) => m.tag_id).filter(Boolean))];
            const mentionTypesMap = new Map();
            
            if (mentionTypeIds.length > 0) {
              const { data: mentionTypes } = await supabase
                .from('mention_types')
                .select('id, emoji, name')
                .in('id', mentionTypeIds);
              
              if (mentionTypes) {
                mentionTypes.forEach((mt: any) => {
                  mentionTypesMap.set(mt.id, mt);
                });
              }
            }

            // Map mentions to expected format
            const mentionsMap = new Map(
              (mentions || []).map((m: any) => [
                m.id,
                {
                  id: m.id,
                  lat: m.lat,
                  lng: m.lng,
                  description: m.body,
                  image_url: m.image_url,
                  account_id: m.author_account_id,
                  created_at: m.created_at,
                  mention_type: m.tag_id ? (mentionTypesMap.get(m.tag_id) || null) : null,
                }
              ])
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
  mention_type_id: z.string().uuid().optional().nullable(),
  mention_ids: z.array(z.string().uuid()).optional().nullable(),
  map_id: z.string().uuid().optional().nullable(),
  shared_post_id: z.string().uuid().optional().nullable(),
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
  background_color: z.enum(['black', 'red', 'blue']).optional().nullable(),
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

        const { title, content, visibility, mention_type_id, mention_ids, map_id, shared_post_id, images, map_data, background_color } = validation.data;

        // Validate map_id if provided
        if (map_id) {
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
            .eq('id', map_id)
            .eq('is_active', true)
            .maybeSingle();

          if (mapError || !map) {
            return NextResponse.json(
              { error: 'Map not found or inactive' },
              { status: 400 }
            );
          }

          // Check if user is map owner
          const mapAccountId = map && typeof map === 'object' && 'account_id' in map ? (map as { account_id: string }).account_id : null;
          const isMapOwner = mapAccountId === accountId;

          // Check if user is map member (for private maps)
          let isMapMember = false;
          let userRole: string | null = null;
          if (!isMapOwner) {
            const { data: membership } = await supabase
              .from('map_members')
              .select('role')
              .eq('map_id', map_id)
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
              { error: 'You do not have permission to create posts on this map' },
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

        // Validate shared_post_id if provided
        if (shared_post_id) {
          const { data: sharedPost, error: sharedPostError } = await supabase
            .schema('content')
            .from('posts')
            .select('id, visibility')
            .eq('id', shared_post_id)
            .maybeSingle();

          if (sharedPostError || !sharedPost) {
            return NextResponse.json(
              { error: 'Shared post not found' },
              { status: 400 }
            );
          }

          // Only allow sharing public posts
          if (sharedPost.visibility !== 'public') {
            return NextResponse.json(
              { error: 'Cannot share non-public posts' },
              { status: 403 }
            );
          }
        }

        // Validate mention IDs if provided (now map_pins)
        if (mention_ids && mention_ids.length > 0) {
          const { data: mentions } = await (supabase as any)
            .schema('maps')
            .from('pins')
            .select('id')
            .in('id', mention_ids)
            .eq('is_active', true)
            .eq('archived', false);

          if (!mentions || mentions.length !== mention_ids.length) {
            return NextResponse.json(
              { error: 'One or more mention IDs are invalid' },
              { status: 400 }
            );
          }
        }

        // Parse @username patterns from content and resolve to account IDs
        const trimmedContent = content.trim();
        const taggedAccountIds = await parseAndResolveUsernames(supabase, trimmedContent);

        // Create post
        const { data: post, error } = await supabase
          .schema('content')
          .from('posts')
          .insert({
            account_id: accountId,
            title: title?.trim() || null,
            content: trimmedContent,
            visibility,
            mention_type_id: mention_type_id || null,
            mention_ids: mention_ids && mention_ids.length > 0 ? mention_ids : null,
            tagged_account_ids: taggedAccountIds.length > 0 ? taggedAccountIds : null,
            map_id: map_id || null,
            shared_post_id: shared_post_id || null,
            images: images && images.length > 0 ? images : null,
            map_data: map_data || null,
            background_color: background_color || null,
          } as any)
          .select(`
            id,
            account_id,
            title,
            content,
            visibility,
            mention_ids,
            tagged_account_ids,
            map_id,
            images,
            map_data,
            background_color,
            created_at,
            updated_at
          `)
          .single();

        if (error) {
          console.error('[Posts API] Error creating post:', error);
          return NextResponse.json(
            { error: 'Failed to create post' },
            { status: 500 }
          );
        }

        // Fetch related data separately (cross-schema joins not supported)
        const postData = post as any;
        
        // Fetch account
        if (postData.account_id) {
          const { data: account } = await supabase
            .from('accounts')
            .select('id, username, first_name, last_name, image_url, plan')
            .eq('id', postData.account_id)
            .single();
          postData.account = account || null;
        }

        // Fetch map
        if (postData.map_id) {
          const { data: map } = await supabase
            .schema('maps')
            .from('maps')
            .select('id, name, slug, visibility')
            .eq('id', postData.map_id)
            .single();
          postData.map = map || null;
        }

        // Fetch mentions if referenced (now map_pins)
        if (postData && postData.mention_ids && Array.isArray(postData.mention_ids) && postData.mention_ids.length > 0) {
          const { data: mentions } = await (supabase as any)
            .schema('maps')
            .from('pins')
            .select(`
              id,
              lat,
              lng,
              body,
              image_url,
              author_account_id,
              tag_id
            `)
            .eq('is_active', true)
            .eq('archived', false)
            .in('id', postData.mention_ids);

          // Fetch mention types for mentions separately
          if (mentions && mentions.length > 0) {
            const mentionTypeIds = [...new Set(mentions.map((m: any) => m.tag_id).filter(Boolean))];
            const mentionTypesMap = new Map();
            
            if (mentionTypeIds.length > 0) {
              const { data: mentionTypes } = await supabase
                .from('mention_types')
                .select('id, emoji, name')
                .in('id', mentionTypeIds);
              
              if (mentionTypes) {
                mentionTypes.forEach((mt: any) => {
                  mentionTypesMap.set(mt.id, mt);
                });
              }
            }

            // Merge mention types into mentions and map columns
            postData.mentions = mentions.map((m: any) => ({
              id: m.id,
              lat: m.lat,
              lng: m.lng,
              description: m.body,
              image_url: m.image_url,
              account_id: m.author_account_id,
              mention_type: m.tag_id ? (mentionTypesMap.get(m.tag_id) || null) : null,
            }));
          } else {
            postData.mentions = [];
          }
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
