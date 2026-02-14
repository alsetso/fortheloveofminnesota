import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabaseServer';
import { withSecurity } from '@/lib/security/middleware';

/**
 * GET /api/accounts/[id]
 * Get account by ID (public fields only)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withSecurity(
    request,
    async (req) => {
      try {
        const { id } = await params;
        const supabase = await createServerClient();

        const { data: account, error } = await supabase
          .from('accounts')
          .select('id, username, first_name, last_name, image_url, bio, created_at')
          .eq('id', id)
          .single();

        if (error || !account) {
          return NextResponse.json(
            { error: 'Account not found' },
            { status: 404 }
          );
        }

        return NextResponse.json({ account });
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.error('Error in GET /api/accounts/[id]:', error);
        }
        return NextResponse.json(
          { error: 'Internal server error' },
          { status: 500 }
        );
      }
    },
    {
      rateLimit: 'public',
      requireAuth: false,
    }
  );
}
