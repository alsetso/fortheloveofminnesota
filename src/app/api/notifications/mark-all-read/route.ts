/**
 * POST /api/notifications/mark-all-read
 * Mark all notifications as read for the authenticated user's account
 */

import { NextRequest, NextResponse } from 'next/server';
import { withSecurity } from '@/lib/security/middleware';
import { createServerClientWithAuth } from '@/lib/supabaseServer';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
  return withSecurity(
    request,
    async (req, { userId, accountId }) => {
      try {
        const supabase = await createServerClientWithAuth(cookies());

        const { error } = await supabase
          .schema('notifications')
          .from('alerts')
          .update({
            read: true,
            read_at: new Date().toISOString(),
          })
          .eq('account_id', accountId!)
          .eq('read', false);

        if (error) {
          return NextResponse.json(
            { error: error.message },
            { status: 500 }
          );
        }

        return NextResponse.json({ success: true });
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.error('Error in POST /api/notifications/mark-all-read:', error);
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
