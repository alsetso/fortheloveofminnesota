import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient, createServerClientWithAuth } from '@/lib/supabaseServer';
import { getServerAuth } from '@/lib/authServer';
import { CreateFAQData } from '@/types/faq';

/**
 * GET /api/faqs
 * Returns visible FAQs for public, all FAQs for admins
 * Uses authenticated client if available (for admin access), otherwise anonymous client
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await getServerAuth();
    const isAdmin = auth?.role === 'admin';

    // Use authenticated client if user is authenticated (needed for admin to see all FAQs)
    // Otherwise use anonymous client (RLS will filter to visible FAQs)
    const supabase = auth 
      ? await createServerClientWithAuth(cookies())
      : createServerClient();

    // RLS policies handle visibility:
    // - Anonymous users: only see is_visible=true FAQs
    // - Authenticated users: see their own questions + visible FAQs
    // - Admins: see all FAQs
    // So we don't need to filter here, RLS does it
    const { data, error } = await supabase
      .from('faqs')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching FAQs:', error);
      return NextResponse.json(
        { error: 'Failed to fetch FAQs' },
        { status: 500 }
      );
    }

    return NextResponse.json(data || []);
  } catch (error) {
    console.error('Error in GET /api/faqs:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/faqs
 * Submit a new question (authenticated users only)
 */
export async function POST(request: NextRequest) {
  try {
    // Check authentication first
    const auth = await getServerAuth();
    if (!auth) {
      return NextResponse.json(
        { error: 'Unauthorized - authentication required' },
        { status: 401 }
      );
    }

    // Create authenticated Supabase client
    const supabase = await createServerClientWithAuth(cookies());

    const body: CreateFAQData = await request.json();

    if (!body.question || body.question.trim().length === 0) {
      return NextResponse.json(
        { error: 'Question is required' },
        { status: 400 }
      );
    }

    if (body.question.length > 2000) {
      return NextResponse.json(
        { error: 'Question must be 2000 characters or less' },
        { status: 400 }
      );
    }

    // Get account_id for authenticated user
    const { data: account, error: accountError } = await supabase
      .from('accounts')
      .select('id')
      .eq('user_id', auth.id)
      .maybeSingle();
    
    if (accountError) {
      console.error('Error fetching account:', accountError);
    }
    
    const accountId = account ? (account as { id: string }).id : null;

    const { data, error } = await supabase
      .from('faqs')
      .insert({
        question: body.question.trim(),
        answer: null,
        is_visible: false,
        account_id: accountId,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating FAQ:', error);
      return NextResponse.json(
        { error: 'Failed to submit question', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/faqs:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
