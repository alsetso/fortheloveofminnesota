import { NextRequest, NextResponse } from 'next/server';
import { createServerClientWithAuth } from '@/lib/supabaseServer';
import { getAccountIdForUser } from '@/lib/server/getAccountId';
import { getServerAuth } from '@/lib/authServer';

/**
 * GET /api/analytics/recent-activity
 * Returns unique accounts active in the last 24 hours with their activities
 * Admin only
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await getServerAuth();
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = await createServerClientWithAuth();
    const accountId = await getAccountIdForUser(auth, supabase);

    // Check if user is admin
    const { data: account, error: accountError } = await supabase
      .from('accounts')
      .select('role')
      .eq('id', accountId)
      .maybeSingle();

    type AccountRow = { role: string | null };
    const accountData = account as AccountRow | null;
    if (accountError || !accountData || accountData.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden - Admin only' }, { status: 403 });
    }

    // Get events from last 24 hours with account info
    // Use RPC function since analytics.events is not directly accessible via PostgREST
    const { data: events, error: eventsError } = await supabase.rpc('get_recent_account_activity', {
      p_hours: 24,
    } as any) as { 
      data: Array<{
        account_id: string;
        account_username: string | null;
        account_first_name: string | null;
        account_last_name: string | null;
        account_image_url: string | null;
        entity_type: string;
        entity_id: string | null;
        url: string;
        viewed_at: string;
      }> | null; 
      error: any 
    };

    if (eventsError) {
      console.error('Error fetching recent activity:', eventsError);
      return NextResponse.json(
        { error: 'Failed to fetch recent activity' },
        { status: 500 }
      );
    }

    // Group by account and summarize activities
    const accountActivityMap = new Map<string, {
      account: {
        id: string;
        username: string | null;
        first_name: string | null;
        last_name: string | null;
        image_url: string | null;
      };
      activities: Array<{
        entity_type: string;
        entity_id: string | null;
        url: string;
        viewed_at: string;
      }>;
      lastActive: string;
    }>();

    (events || []).forEach((event) => {
      if (!event.account_id) return;

      const accountId = event.account_id;

      if (!accountActivityMap.has(accountId)) {
        accountActivityMap.set(accountId, {
          account: {
            id: event.account_id,
            username: event.account_username,
            first_name: event.account_first_name,
            last_name: event.account_last_name,
            image_url: event.account_image_url,
          },
          activities: [],
          lastActive: event.viewed_at,
        });
      }

      const accountData = accountActivityMap.get(accountId)!;
      accountData.activities.push({
        entity_type: event.entity_type,
        entity_id: event.entity_id,
        url: event.url,
        viewed_at: event.viewed_at,
      });

      // Update last active if this event is more recent
      if (new Date(event.viewed_at) > new Date(accountData.lastActive)) {
        accountData.lastActive = event.viewed_at;
      }
    });

    // Convert to array and sort by last active
    const accountActivities = Array.from(accountActivityMap.values())
      .map((data) => ({
        ...data,
        activityCount: data.activities.length,
      }))
      .sort((a, b) => new Date(b.lastActive).getTime() - new Date(a.lastActive).getTime());

    return NextResponse.json({
      success: true,
      accounts: accountActivities,
      totalUniqueAccounts: accountActivities.length,
    });
  } catch (error) {
    console.error('Error in GET /api/analytics/recent-activity:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
