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
    // Fetch page views
    const { data: pageViewsData, error: pageViewsError } = await supabase
      .from('page_views')
      .select('*')
      .order('viewed_at', { ascending: false })
      .limit(limit);

    if (pageViewsError) {
      console.error('Error fetching page views:', pageViewsError);
      return NextResponse.json(
        { error: 'Failed to fetch page views', details: pageViewsError.message },
        { status: 500 }
      );
    }

    // Fetch account data separately
    const accountIds = [...new Set((pageViewsData || []).map(v => v.account_id).filter(Boolean))];
    const accountsMap: Record<string, any> = {};
    
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

    // Enrich page views with account data
    const enrichedData = (pageViewsData || []).map(view => ({
      ...view,
      account: view.account_id ? accountsMap[view.account_id] || null : null,
    }));

    return NextResponse.json({ data: enrichedData });
  } catch (error: any) {
    console.error('Error in GET /api/admin/views/page-views:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error?.message },
      { status: 500 }
    );
  }
}
