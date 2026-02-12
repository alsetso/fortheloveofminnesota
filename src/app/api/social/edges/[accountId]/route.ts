import { NextRequest, NextResponse } from 'next/server';
import { createServerClientWithAuth } from '@/lib/supabaseServer';
import { withSecurity } from '@/lib/security/middleware';
import { cookies } from 'next/headers';

/**
 * GET /api/social/edges/[accountId]
 * Get all edges for a specific account (both incoming and outgoing)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ accountId: string }> }
) {
  return withSecurity(
    request,
    async (req, { userId, accountId: currentAccountId }) => {
      try {
        const { accountId } = await params;
        const supabase = await createServerClientWithAuth(cookies());

        // Get edges where account is either source or target
        const { data: edges, error } = await supabase
          .schema('social_graph')
          .from('edges')
          .select('*')
          .or(`from_account_id.eq.${accountId},to_account_id.eq.${accountId}`)
          .order('created_at', { ascending: false });

        if (error) {
          return NextResponse.json(
            { error: error.message },
            { status: 500 }
          );
        }

        return NextResponse.json({ edges: edges || [] });
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.error('Error in GET /api/social/edges/[accountId]:', error);
        }
        return NextResponse.json(
          { error: 'Internal server error' },
          { status: 500 }
        );
      }
    },
    {
      rateLimit: 'authenticated',
      requireAuth: true,
    }
  );
}
