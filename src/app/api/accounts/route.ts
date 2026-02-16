import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClientWithAuth } from '@/lib/supabaseServer';
import type { Database } from '@/types/supabase';
import { withSecurity, REQUEST_SIZE_LIMITS } from '@/lib/security/middleware';
import { validateQueryParams } from '@/lib/security/validation';
import { z } from 'zod';
import { commonSchemas } from '@/lib/security/validation';

/**
 * GET /api/accounts
 * List all accounts for the current authenticated user
 * 
 * Security:
 * - Rate limited: 200 requests/minute (authenticated)
 * - Query parameter validation
 * - Requires authentication
 */
const accountsQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).default(50),
  offset: z.coerce.number().int().nonnegative().default(0),
});

export async function GET(request: NextRequest) {
  return withSecurity(
    request,
    async (req, { userId, accountId }) => {
      try {
        const supabase = await createServerClientWithAuth(cookies());
        
        // userId is guaranteed from security middleware
        // Validate query parameters
        const url = new URL(req.url);
        const validation = validateQueryParams(url.searchParams, accountsQuerySchema);
        if (!validation.success) {
          return validation.error;
        }
        
        const { limit, offset } = validation.data;

    // Fetch accounts for current user only
    const { data: accounts, error } = await supabase
      .from('accounts')
      .select(`
        id,
        user_id,
        username,
        first_name,
        last_name,
        email,
        phone,
        image_url,
        role,
        onboarded,
        created_at,
        updated_at,
        last_visit
      `)
      .eq('user_id', userId!)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('[Accounts API] Error fetching accounts:', error);
      return NextResponse.json(
        { error: error.message || 'Failed to fetch accounts' },
        { status: 500 }
      );
    }

    // Get total count for current user
    const { count, error: countError } = await supabase
      .from('accounts')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId!);

    if (countError) {
      console.error('[Accounts API] Error counting accounts:', countError);
    }

        return NextResponse.json({
          accounts: accounts || [],
          total: count || 0,
          limit,
          offset,
        });
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.error('[Accounts API] Error:', error);
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

/**
 * POST /api/accounts
 * Create a new account for the current authenticated user.
 *
 * Used by: (1) Onboarding after first sign-up (CreateAccountClient → POST /api/accounts),
 *          (2) Settings → Accounts admin "Add account" (AccountsSettingsClient → POST /api/accounts).
 * Same handler and same DB automation: trigger add_new_account_to_live_map() adds the new
 * account to the live map (maps.maps slug=live) via maps.memberships.
 *
 * Security:
 * - Rate limited: 60 requests/minute (strict) - prevent account spam
 * - Input validation with Zod
 * - Requires authentication
 */
const createAccountSchema = z.object({
  username: z.string().min(3).max(50).regex(/^[a-z0-9_-]+$/i, 'Username can only contain letters, numbers, underscores, and hyphens').optional().nullable(),
  first_name: z.string().max(100).optional().nullable(),
  last_name: z.string().max(100).optional().nullable(),
  phone: z.string().max(20).regex(/^\+?[\d\s()-]+$/, 'Invalid phone number format').optional().nullable(),
});

export async function POST(request: NextRequest) {
  return withSecurity(
    request,
    async (req, { userId, accountId }) => {
      try {
        const supabase = await createServerClientWithAuth(cookies());
        
        // userId is guaranteed from security middleware
        // Validate request body
        const { validateRequestBody } = await import('@/lib/security/validation');
        const validation = await validateRequestBody(req, createAccountSchema, REQUEST_SIZE_LIMITS.json);
        if (!validation.success) {
          return validation.error;
        }
        
        const {
          username,
          first_name,
          last_name,
          phone,
        } = validation.data;

    // Create account for current user (user_id is set from auth context)
    type AccountsInsert = Database['public']['Tables']['accounts']['Insert'];
    const insertData: AccountsInsert = {
      user_id: userId,
      username: username || null,
      first_name: first_name || null,
      last_name: last_name || null,
      phone: phone || null,
      role: 'general', // Users can only create general accounts
    };
    
    // Type assertion needed due to generic index signature in Database type
    const { data: account, error: accountError } = await supabase
      .from('accounts')
      .insert(insertData as any)
      .select()
      .single();

    if (accountError) {
      console.error('[Accounts API] Error creating account:', accountError);
      return NextResponse.json(
        { error: accountError.message || 'Failed to create account' },
        { status: 500 }
      );
    }

        return NextResponse.json(account, { status: 201 });
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.error('[Accounts API] Error:', error);
        }
        return NextResponse.json(
          { error: 'Internal server error' },
          { status: 500 }
        );
      }
    },
    {
      rateLimit: 'strict', // 10 requests/minute - prevent account spam
      requireAuth: true,
      maxRequestSize: REQUEST_SIZE_LIMITS.json,
    }
  );
}

