import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClientWithAuth } from '@/lib/supabaseServer';

/**
 * GET /api/accounts
 * List all accounts for the current authenticated user
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClientWithAuth(cookies());
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    // Fetch accounts for current user only
    const { data: accounts, error } = await supabase
      .from('accounts')
      .select(`
        id,
        user_id,
        username,
        first_name,
        last_name,
        email,
        phone,
        image_url,
        role,
        onboarded,
        created_at,
        updated_at,
        last_visit
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('[Accounts API] Error fetching accounts:', error);
      return NextResponse.json(
        { error: error.message || 'Failed to fetch accounts' },
        { status: 500 }
      );
    }

    // Get total count for current user
    const { count, error: countError } = await supabase
      .from('accounts')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id);

    if (countError) {
      console.error('[Accounts API] Error counting accounts:', countError);
    }

    return NextResponse.json({
      accounts: accounts || [],
      total: count || 0,
      limit,
      offset,
    });
  } catch (error) {
    console.error('[Accounts API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/accounts
 * Create a new account for the current authenticated user
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClientWithAuth(cookies());
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const {
      username,
      first_name,
      last_name,
      phone,
    } = body;

    // Create account for current user (user_id is set from auth context)
    const { data: account, error: accountError } = await supabase
      .from('accounts')
      .insert({
        user_id: user.id,
        username: username || null,
        first_name: first_name || null,
        last_name: last_name || null,
        phone: phone || null,
        role: 'general', // Users can only create general accounts
      })
      .select()
      .single();

    if (accountError) {
      console.error('[Accounts API] Error creating account:', accountError);
      return NextResponse.json(
        { error: accountError.message || 'Failed to create account' },
        { status: 500 }
      );
    }

    return NextResponse.json(account, { status: 201 });
  } catch (error) {
    console.error('[Accounts API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

