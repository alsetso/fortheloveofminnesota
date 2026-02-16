import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseClient } from '@/lib/supabase/unified';
import { withSecurity } from '@/lib/security/middleware';

/**
 * GET /api/admin/emails/users
 * Lists all auth.users via Supabase admin API (service role).
 */
export async function GET(request: NextRequest) {
  return withSecurity(
    request,
    async () => {
      try {
        const supabase = await createSupabaseClient({ service: true });

        const allUsers: Array<{
          id: string;
          email: string | undefined;
          created_at: string;
          last_sign_in_at: string | null;
        }> = [];

        let page = 1;
        const perPage = 1000;

        // Paginate through all users
        while (true) {
          const { data, error } = await supabase.auth.admin.listUsers({
            page,
            perPage,
          });

          if (error) {
            console.error('[Admin Emails] Error listing users:', error);
            return NextResponse.json(
              { error: 'Failed to list users' },
              { status: 500 }
            );
          }

          for (const user of data.users) {
            allUsers.push({
              id: user.id,
              email: user.email,
              created_at: user.created_at,
              last_sign_in_at: user.last_sign_in_at ?? null,
            });
          }

          if (data.users.length < perPage) break;
          page++;
        }

        return NextResponse.json({ users: allUsers });
      } catch (error) {
        console.error('[Admin Emails] Error:', error);
        return NextResponse.json(
          { error: 'Internal server error' },
          { status: 500 }
        );
      }
    },
    {
      requireAdmin: true,
      rateLimit: 'admin',
    }
  );
}
