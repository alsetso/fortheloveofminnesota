import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { createErrorResponse, createSuccessResponse } from '@/lib/server/apiError';
import { withSecurity, REQUEST_SIZE_LIMITS } from '@/lib/security/middleware';
import { validateRequestBody } from '@/lib/security/validation';
import { z } from 'zod';

const usernameCheckSchema = z.object({
  username: z.string().regex(/^[a-zA-Z0-9_-]+$/, 'Username can only contain letters, numbers, hyphens, and underscores').min(3).max(30),
});

/**
 * POST /api/accounts/username/check
 * Check username availability
 * 
 * Security:
 * - Rate limited: 200 requests/minute (authenticated)
 * - Request size limit: 1MB
 * - Input validation with Zod
 * - Requires authentication
 */
export async function POST(request: NextRequest) {
  return withSecurity(
    request,
    async (req, { userId, accountId }) => {
      try {
        if (!userId || !accountId) {
          return createErrorResponse('Not authenticated', 401);
        }

        // Validate request body
        const validation = await validateRequestBody(req, usernameCheckSchema, REQUEST_SIZE_LIMITS.json);
        if (!validation.success) {
          return validation.error;
        }
        
        const { username } = validation.data;

        const cookieStore = await cookies();
        const supabase = createServerClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          {
            cookies: {
              get(name: string) {
                return cookieStore.get(name)?.value;
              },
            },
          }
        );

        // Get current account
        const { data: currentAccount } = await supabase
          .from('accounts')
          .select('id, username')
          .eq('id', accountId)
          .limit(1)
          .single();

        if (!currentAccount) {
          return createErrorResponse('Account not found', 404);
        }

        // If username matches current account username, it's available (no change)
        if (currentAccount.username === username) {
          return createSuccessResponse({ available: true });
        }

        // Check if username exists for another account
        const { data: existing, error } = await supabase
          .from('accounts')
          .select('id')
          .eq('username', username)
          .limit(1)
          .single();

        // If username exists for another account, it's not available
        if (existing && !error) {
          return createSuccessResponse({ available: false });
        }

        // Username is available
        return createSuccessResponse({ available: true });
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.error('Error checking username:', error);
        }
        return createErrorResponse('Failed to check username availability', 500);
      }
    },
    {
      rateLimit: 'authenticated',
      requireAuth: true,
      maxRequestSize: REQUEST_SIZE_LIMITS.json,
    }
  );
}
