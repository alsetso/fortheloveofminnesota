import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClientWithAuth } from '@/lib/supabaseServer';
import { withSecurity, REQUEST_SIZE_LIMITS } from '@/lib/security/middleware';
import { validateRequestBody } from '@/lib/security/validation';
import { z } from 'zod';

const batchAccountsSchema = z.object({
  ids: z.array(z.string().uuid()).max(100), // Limit to 100 accounts per batch
});

/**
 * POST /api/accounts/batch
 * Fetch multiple accounts by IDs in a single query
 * Eliminates N+1 problem
 */
export async function POST(request: NextRequest) {
  return withSecurity(
    request,
    async (req) => {
      try {
        const validation = await validateRequestBody(req, batchAccountsSchema);
        
        if (!validation.success) {
          return validation.error;
        }

        const { ids } = validation.data;

        if (ids.length === 0) {
          return NextResponse.json({ accounts: [] });
        }

        const supabase = await createServerClientWithAuth(cookies());

        const { data: accounts, error } = await supabase
          .from('accounts')
          .select('id,username,first_name,last_name,image_url,bio,created_at,plan,traits')
          .in('id', ids)
          .not('username', 'is', null);

        if (error) {
          return NextResponse.json(
            { error: error.message },
            { status: 500 }
          );
        }

        // Return accounts in the same order as requested IDs
        const accountMap = new Map(accounts?.map(acc => [acc.id, acc]) || []);
        const orderedAccounts = ids
          .map(id => accountMap.get(id))
          .filter(Boolean);

        return NextResponse.json({ accounts: orderedAccounts });
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.error('Error in POST /api/accounts/batch:', error);
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
      maxRequestSize: REQUEST_SIZE_LIMITS.json,
    }
  );
}
