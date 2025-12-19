import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { Database } from '@/types/supabase';

/**
 * POST /api/analytics/pin-view
 * Records a pin view using the simplified pin_views system
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { pin_id, referrer_url, session_id, user_agent } = body;

    if (!pin_id || typeof pin_id !== 'string') {
      return NextResponse.json(
        { error: 'pin_id is required' },
        { status: 400 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    const cookieStore = await cookies();
    const supabase = createServerClient<Database>(
      supabaseUrl,
      supabaseAnonKey,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll() {
            // Route handlers can set cookies - no-op for read operations
          },
        },
      }
    );

    // Get current user account (optional - for authenticated users)
    let accountId: string | null = null;
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: account } = await supabase
        .from('accounts')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();
      accountId = account?.id || null;
    }

    // Record pin view using the new simplified function
    const { data, error } = await supabase.rpc('record_pin_view', {
      p_pin_id: pin_id,
      p_account_id: accountId,
      p_user_agent: user_agent || null,
      p_referrer_url: referrer_url || null,
      p_session_id: session_id || null,
    });

    if (error) {
      console.error('Error recording pin view:', error);
      return NextResponse.json(
        { error: 'Failed to record pin view', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      success: true,
      view_id: data 
    });
  } catch (error) {
    console.error('Error in POST /api/analytics/pin-view:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

