import { NextRequest, NextResponse } from 'next/server';
import { createServerClientWithAuth } from '@/lib/supabaseServer';
import { getAccountIdForUser } from '@/lib/server/getAccountId';
import { getServerAuth } from '@/lib/authServer';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const auth = await getServerAuth();
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = await createServerClientWithAuth();
    const accountId = await getAccountIdForUser(auth, supabase);

    if (!accountId) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');

    // Fetch analytics events using RPC function (analytics.events not directly accessible via PostgREST)
    const { data: events, error: eventsError } = await supabase.rpc('get_user_analytics_events', {
      p_account_id: accountId,
      p_limit: limit,
      p_offset: offset,
    } as any) as { data: Array<{ id: string; entity_type: string; entity_id: string | null; url: string; viewed_at: string; referrer_url: string | null }> | null; error: any };

    if (eventsError) {
      console.error('Error fetching analytics events:', eventsError);
      return NextResponse.json(
        { error: 'Failed to fetch history' },
        { status: 500 }
      );
    }

    // Get total count using RPC function
    const { data: totalCount, error: countError } = await supabase.rpc('count_user_analytics_events', {
      p_account_id: accountId,
    } as any) as { data: number | null; error: any };

    if (countError) {
      console.error('Error counting analytics events:', countError);
    }

    // Format the response (entity_type is already extracted, no need to parse URL)
    const history = (events || []).map((event) => ({
      id: event.id,
      type: event.entity_type || 'other',
      description: formatEntityDescription(event.entity_type, event.entity_id, event.url),
      url: event.url,
      created_at: event.viewed_at,
      referrer_url: event.referrer_url,
    }));

    return NextResponse.json({
      history,
      total: totalCount || 0,
      limit,
      offset,
    });
  } catch (error) {
    console.error('Error fetching account history:', error);
    return NextResponse.json(
      { error: 'Failed to fetch history' },
      { status: 500 }
    );
  }
}

function formatEntityDescription(entityType: string | null, entityId: string | null, url: string): string {
  // Use entity_type and entity_id for better descriptions when available
  if (entityType === 'profile' && entityId) {
    // Could fetch username, but for now use URL fallback
    const path = url.split('?')[0];
    const username = path.replace('/profile/', '').replace(/^\//, '');
    return username ? `Profile: @${username}` : 'Profile';
  }
  
  if (entityType === 'map' && entityId) {
    return `Map: ${entityId.substring(0, 8)}...`;
  }
  
  if (entityType === 'pin' && entityId) {
    return `Pin: ${entityId.substring(0, 8)}...`;
  }
  
  if (entityType === 'post' && entityId) {
    return `Post: ${entityId.substring(0, 8)}...`;
  }
  
  if (entityType === 'page') {
    // Format page URLs nicely
    const path = url.split('?')[0];
    if (path === '/') return 'Home';
    if (path.startsWith('/feed')) return 'Feed';
    if (path.startsWith('/explore')) return 'Explore';
    if (path.startsWith('/settings')) return 'Settings';
    if (path.startsWith('/analytics')) return 'Analytics';
    return path.charAt(1).toUpperCase() + path.slice(2) || 'Page';
  }
  
  // Fallback to URL parsing for 'other' type
  const path = url.split('?')[0];
  return path.charAt(1).toUpperCase() + path.slice(2) || 'Other';
}
