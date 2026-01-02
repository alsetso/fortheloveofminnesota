import { NextRequest, NextResponse } from 'next/server';
import { createServerClientWithAuth, createServiceClient } from '@/lib/supabaseServer';
import { cookies } from 'next/headers';
import { getGeneratedIdFromArticleId } from '@/features/news/services/newsCommentService';
import { handleApiError } from '@/lib/apiErrorHandler';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const articleId = params.id; // This is article_id (TEXT), not the UUID id
    const supabase = createServiceClient();

    // Get generated_id from article_id
    const generatedId = await getGeneratedIdFromArticleId(articleId);

    if (!generatedId) {
      return NextResponse.json({
        success: true,
        data: [], // No article found, return empty comments
      });
    }

    // Fetch comments using generated_id
    const { data: comments, error } = await (supabase as any)
      .schema('news')
      .from('comments')
      .select('*')
      .eq('generated_id', generatedId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching comments:', error);
      return NextResponse.json(
        { error: 'Failed to fetch comments', details: error.message },
        { status: 500 }
      );
    }

    // Fetch all unique account IDs
    const accountIds = [...new Set((comments || []).map((c: any) => c.account_id))];
    
    // Use RPC function to fetch accounts (bypasses RLS via SECURITY DEFINER)
    const { data: allAccounts, error: accountsError } = await (supabase as any)
      .rpc('get_accounts_for_comments', { p_account_ids: accountIds });
    
    if (accountsError) {
      console.error('Error fetching accounts:', accountsError);
    }
    
    // Create a map for quick lookup
    const accountMap = new Map((allAccounts || []).map((acc: any) => [acc.id, acc]));
    
    // Attach account data to each comment
    const commentsWithAccounts = (comments || []).map((comment: any) => ({
      ...comment,
      accounts: accountMap.get(comment.account_id) || null,
    }));

    return NextResponse.json({
      success: true,
      data: commentsWithAccounts || [],
    });
  } catch (error) {
    return handleApiError(error, 'Error in GET /api/article/[id]/comments');
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const articleId = params.id;
    const supabase = await createServerClientWithAuth(cookies());
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { error: 'You must be signed in to comment' },
        { status: 401 }
      );
    }

    // Get account
    const { data: accounts } = await supabase
      .from('accounts')
      .select('id')
      .eq('user_id', user.id)
      .limit(1);

    if (!accounts || accounts.length === 0) {
      return NextResponse.json(
        { error: 'Account not found' },
        { status: 404 }
      );
    }

    const accountId = (accounts[0] as { id: string }).id;
    const body = await request.json();
    const { content, parent_comment_id } = body;

    if (!content || !content.trim()) {
      return NextResponse.json(
        { error: 'Comment content is required' },
        { status: 400 }
      );
    }

    if (content.length > 2000) {
      return NextResponse.json(
        { error: 'Comment must be 2000 characters or less' },
        { status: 400 }
      );
    }

    // Get generated_id from article_id
    const generatedId = await getGeneratedIdFromArticleId(articleId);

    if (!generatedId) {
      return NextResponse.json(
        { error: 'Article not found' },
        { status: 404 }
      );
    }

    // Insert comment into news.comments using generated_id
    const { data: comment, error } = await (supabase as any)
      .schema('news')
      .from('comments')
      .insert({
        generated_id: generatedId,
        account_id: accountId,
        content: content.trim(),
        parent_comment_id: parent_comment_id || null,
      })
      .select('*')
      .single();

    if (error) {
      console.error('Error creating comment:', error);
      return NextResponse.json(
        { error: 'Failed to create comment', details: error.message },
        { status: 500 }
      );
    }

    // Fetch account info using RPC function (bypasses RLS)
    const { data: accountData, error: accountsError } = await (supabase as any)
      .rpc('get_accounts_for_comments', { p_account_ids: [accountId] });

    if (accountsError) {
      console.error('Error fetching account:', accountsError);
    }

    const account = accountData && accountData.length > 0 ? accountData[0] : null;

    const data = {
      ...comment,
      accounts: account || null,
    };

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    return handleApiError(error, 'Error in POST /api/article/[id]/comments');
  }
}

