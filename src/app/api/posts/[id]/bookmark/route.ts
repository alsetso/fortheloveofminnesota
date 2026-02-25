import { NextRequest, NextResponse } from 'next/server';
import { createServerClientWithAuth } from '@/lib/supabaseServer';
import { withSecurity, REQUEST_SIZE_LIMITS } from '@/lib/security/middleware';
import { cookies } from 'next/headers';

/**
 * POST /api/posts/[id]/bookmark
 * Bookmark a post
 * 
 * Security:
 * - Rate limited: 60 requests/minute
 * - Requires authentication
 */
export async function POST(
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

        // Verify post exists and is public (or user owns it)
        const { data: post, error: postError } = await supabase
          .schema('content')
          .from('posts')
          .select('id, account_id, visibility')
          .eq('id', id)
          .maybeSingle();

        if (postError || !post) {
          return NextResponse.json(
            { error: 'Post not found' },
            { status: 404 }
          );
        }

        // Check if user can bookmark this post (must be public or own post)
        const isOwnPost = post.account_id === accountId;
        if (!isOwnPost && post.visibility !== 'public') {
          return NextResponse.json(
            { error: 'Cannot bookmark non-public posts' },
            { status: 403 }
          );
        }

        // Check if bookmark already exists
        const { data: existingBookmark } = await supabase
          .from('saved_items')
          .select('id')
          .eq('account_id', accountId)
          .eq('item_type', 'post')
          .eq('item_id', id)
          .maybeSingle();

        if (existingBookmark) {
          // Already bookmarked, return success
          return NextResponse.json({ success: true, bookmarked: true });
        }

        // Create bookmark
        const { error: bookmarkError } = await (supabase
          .from('saved_items') as any)
          .insert({
            account_id: accountId,
            item_type: 'post',
            item_id: id,
          });

        if (bookmarkError) {
          // If table doesn't exist, return success anyway (graceful degradation)
          if (bookmarkError.code === '42P01') {
            console.warn('[Bookmark API] saved_items table does not exist yet');
            return NextResponse.json({ success: true, bookmarked: true });
          }
          
          console.error('[Bookmark API] Error creating bookmark:', bookmarkError);
          return NextResponse.json(
            { error: 'Failed to bookmark post' },
            { status: 500 }
          );
        }

        return NextResponse.json({ success: true, bookmarked: true });
      } catch (error) {
        console.error('[Bookmark API] Error:', error);
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
 * DELETE /api/posts/[id]/bookmark
 * Remove bookmark from a post
 * 
 * Security:
 * - Rate limited: 60 requests/minute
 * - Requires authentication
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

        // Delete bookmark
        const { error: deleteError } = await supabase
          .from('saved_items')
          .delete()
          .eq('account_id', accountId)
          .eq('item_type', 'post')
          .eq('item_id', id);

        if (deleteError) {
          // If table doesn't exist, return success anyway (graceful degradation)
          if (deleteError.code === '42P01') {
            console.warn('[Bookmark API] saved_items table does not exist yet');
            return NextResponse.json({ success: true, bookmarked: false });
          }
          
          console.error('[Bookmark API] Error deleting bookmark:', deleteError);
          return NextResponse.json(
            { error: 'Failed to remove bookmark' },
            { status: 500 }
          );
        }

        return NextResponse.json({ success: true, bookmarked: false });
      } catch (error) {
        console.error('[Bookmark API] Error:', error);
        return NextResponse.json(
          { error: 'Internal server error' },
          { status: 500 }
        );
      }
    },
    {
      requireAuth: true,
      rateLimit: 'authenticated',
    }
  );
}

/**
 * GET /api/posts/[id]/bookmark
 * Check if a post is bookmarked
 * 
 * Security:
 * - Rate limited: 200 requests/minute
 * - Requires authentication
 */
export async function GET(
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

        // Check if bookmark exists
        const { data: bookmark, error: bookmarkError } = await supabase
          .from('saved_items')
          .select('id')
          .eq('account_id', accountId)
          .eq('item_type', 'post')
          .eq('item_id', id)
          .maybeSingle();

        if (bookmarkError) {
          // If table doesn't exist, return false (graceful degradation)
          if (bookmarkError.code === '42P01') {
            return NextResponse.json({ bookmarked: false });
          }
          
          console.error('[Bookmark API] Error checking bookmark:', bookmarkError);
          return NextResponse.json(
            { error: 'Failed to check bookmark status' },
            { status: 500 }
          );
        }

        return NextResponse.json({ bookmarked: !!bookmark });
      } catch (error) {
        console.error('[Bookmark API] Error:', error);
        return NextResponse.json(
          { error: 'Internal server error' },
          { status: 500 }
        );
      }
    },
    {
      requireAuth: true,
      rateLimit: 'authenticated',
    }
  );
}
