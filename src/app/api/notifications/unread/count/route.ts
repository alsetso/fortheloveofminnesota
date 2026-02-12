/**
 * GET /api/notifications/unread/count
 * Get unread notification count for the authenticated user's account
 */

import { NextRequest, NextResponse } from 'next/server';
import { withSecurity } from '@/lib/security/middleware';
import { createServerClientWithAuth } from '@/lib/supabaseServer';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
  return withSecurity(
    request,
    async (req, { userId, accountId }) => {
      try {
        const supabase = await createServerClientWithAuth(cookies());

        const { count, error } = await supabase
          .schema('notifications')
          .from('alerts')
          .select('*', { count: 'exact', head: true })
          .eq('account_id', accountId!)
          .eq('read', false)
          .eq('archived', false);

        if (error) {
          return NextResponse.json(
            { error: error.message },
            { status: 500 }
          );
        }

        return NextResponse.json({ count: count || 0 });
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.error('Error in GET /api/notifications/unread/count:', error);
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
