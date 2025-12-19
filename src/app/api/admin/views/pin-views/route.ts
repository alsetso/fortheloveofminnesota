import { NextRequest, NextResponse } from 'next/server';
import { requireAdminApiAccess } from '@/lib/adminHelpers';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
  const { auth, response } = await requireAdminApiAccess(request);
  if (response) return response;

  const cookieStore = await cookies();
  const searchParams = request.nextUrl.searchParams;
  const limit = parseInt(searchParams.get('limit') || '100', 10);

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {
          // Server components can't set cookies - no-op
        },
      },
    }
  );

  try {
    // Fetch pin views
    const { data: pinViewsData, error: pinViewsError } = await supabase
      .from('pin_views')
      .select('*')
      .order('viewed_at', { ascending: false })
      .limit(limit);

    if (pinViewsError) {
      console.error('Error fetching pin views:', pinViewsError);
      return NextResponse.json(
        { error: 'Failed to fetch pin views', details: pinViewsError.message },
        { status: 500 }
      );
    }

    // Fetch related data separately
    const pinIds = [...new Set((pinViewsData || []).map(v => v.pin_id).filter(Boolean))];
    const accountIds = [...new Set((pinViewsData || []).map(v => v.account_id).filter(Boolean))];
    
    const pinsMap: Record<string, any> = {};
    const accountsMap: Record<string, any> = {};
    
    if (pinIds.length > 0) {
      const { data: pins, error: pinsError } = await supabase
        .from('pins')
        .select('id, name')
        .in('id', pinIds);
      
      if (pinsError) {
        console.error('Error fetching pins:', pinsError);
      } else {
        (pins || []).forEach(pin => {
          pinsMap[pin.id] = pin;
        });
      }
    }

    if (accountIds.length > 0) {
      const { data: accounts, error: accountsError } = await supabase
        .from('accounts')
        .select('id, username, first_name, last_name')
        .in('id', accountIds);
      
      if (accountsError) {
        console.error('Error fetching accounts:', accountsError);
      } else {
        (accounts || []).forEach(acc => {
          accountsMap[acc.id] = acc;
        });
      }
    }

    // Enrich pin views with related data
    const enrichedData = (pinViewsData || []).map(view => ({
      ...view,
      pin: view.pin_id ? pinsMap[view.pin_id] || null : null,
      account: view.account_id ? accountsMap[view.account_id] || null : null,
    }));

    return NextResponse.json({ data: enrichedData });
  } catch (error: any) {
    console.error('Error in GET /api/admin/views/pin-views:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error?.message },
      { status: 500 }
    );
  }
}

