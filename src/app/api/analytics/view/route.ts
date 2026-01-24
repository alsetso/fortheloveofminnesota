import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { Database } from '@/types/supabase';
import { withSecurity, REQUEST_SIZE_LIMITS } from '@/lib/security/middleware';
import { validateRequestBody } from '@/lib/security/validation';
import { z } from 'zod';

/**
 * POST /api/analytics/view
 * Records a page view using the simplified page_url system
 * 
 * Security:
 * - Rate limited: 100 requests/minute (public) - high traffic endpoint
 * - Request size limit: 1MB
 * - Input validation with Zod
 * - Optional authentication (tracks anonymous views)
 */
const pageViewSchema = z.object({
  page_url: z.string()
    .min(1)
    .max(2000)
    .refine(
      (val) => val.startsWith('/') || z.string().url().safeParse(val).success,
      'page_url must be a path (starting with /) or a valid URL'
    ),
  referrer_url: z.string()
    .url()
    .max(2000)
    .optional()
    .nullable()
    .or(z.literal('').transform(() => null)),
  session_id: z.string().max(200).optional().nullable(),
  user_agent: z.string().max(500).optional().nullable(),
  account_id: z.string().uuid().optional().nullable(), // Admin impersonation
});

export async function POST(request: NextRequest) {
  return withSecurity(
    request,
    async (req, { userId, accountId }) => {
      try {
        // Validate request body
        const validation = await validateRequestBody(req, pageViewSchema, REQUEST_SIZE_LIMITS.json);
        if (!validation.success) {
          return validation.error;
        }
        
        const { page_url, referrer_url, session_id, user_agent, account_id } = validation.data;

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    const cookieStore = await cookies();
    const supabase = createServerClient<Database>(
      supabaseUrl,
      supabaseAnonKey,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll() {
            // Route handlers can set cookies - no-op for read operations
          },
        },
      }
    );

        // Determine account ID for tracking
        // Priority: 1) Provided account_id (admin impersonation), 2) Security context accountId, 3) Fetch from auth
        let finalAccountId: string | null = null;
        
        // If account_id is provided (admin impersonation), verify admin access
        if (account_id) {
          // Verify requester is admin
          const { data: requesterAccount } = await supabase
            .from('accounts')
            .select('role')
            .eq('id', accountId || '')
            .maybeSingle() as { data: { role: string } | null; error: any };
          
          if (requesterAccount?.role !== 'admin') {
            return NextResponse.json(
              { error: 'Admin access required for account impersonation' },
              { status: 403 }
            );
          }
          
          // Verify target account exists
          const { data: targetAccount } = await supabase
            .from('accounts')
            .select('id')
            .eq('id', account_id)
            .maybeSingle() as { data: { id: string } | null; error: any };
          
          if (!targetAccount) {
            return NextResponse.json(
              { error: 'Target account not found' },
              { status: 404 }
            );
          }
          
          finalAccountId = account_id;
        } else {
          // Use accountId from security context if available, otherwise fetch
          finalAccountId = accountId || null;
          if (!finalAccountId) {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
              const { data: account } = await supabase
                .from('accounts')
                .select('id')
                .eq('user_id', user.id)
                .maybeSingle() as { data: { id: string } | null; error: any };
              finalAccountId = (account as { id: string } | null)?.id || null;
            }
          }
        }

        // Record URL visit using the unified function
        const { data, error } = await supabase.rpc('record_url_visit', {
          p_url: page_url,
          p_account_id: finalAccountId,
          p_user_agent: user_agent || null,
          p_referrer_url: referrer_url || null,
          p_session_id: session_id || null,
        } as any) as { data: string | null; error: any };

        if (error) {
          if (process.env.NODE_ENV === 'development') {
            console.error('Error recording page view:', error);
          }
          return NextResponse.json(
            { error: 'Failed to record page view' },
            { status: 500 }
          );
        }

        return NextResponse.json({ 
          success: true,
          view_id: data 
        });
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.error('Error in POST /api/analytics/view:', error);
        }
        return NextResponse.json(
          { error: 'Internal server error' },
          { status: 500 }
        );
      }
    },
    {
      rateLimit: 'public', // High traffic, allow anonymous views
      requireAuth: false, // Optional auth for tracking
      maxRequestSize: REQUEST_SIZE_LIMITS.json,
    }
  );
}






