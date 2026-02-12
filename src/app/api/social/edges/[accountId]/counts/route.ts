import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabaseServer';
import { withSecurity } from '@/lib/security/middleware';

/**
 * GET /api/social/edges/[accountId]/counts
 * Public: returns followers_count and following_count for profile display.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ accountId: string }> }
) {
  return withSecurity(
    request,
    async () => {
      const { accountId } = await params;
      const supabase = await createServiceClient();

      const [followersRes, followingRes] = await Promise.all([
        supabase
          .schema('social_graph')
          .from('edges')
          .select('id', { count: 'exact', head: true })
          .eq('to_account_id', accountId)
          .eq('relationship', 'follow')
          .eq('status', 'accepted'),
        supabase
          .schema('social_graph')
          .from('edges')
          .select('id', { count: 'exact', head: true })
          .eq('from_account_id', accountId)
          .eq('relationship', 'follow')
          .eq('status', 'accepted'),
      ]);

      return NextResponse.json({
        followers_count: followersRes.count ?? 0,
        following_count: followingRes.count ?? 0,
      });
    },
    { rateLimit: 'public', requireAuth: false }
  );
}
