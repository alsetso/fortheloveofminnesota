/**
 * Unified server-side auth + billing data fetcher
 * Uses React cache() for request-level deduplication
 * Returns both auth and billing features in a single call
 */

import { cache } from 'react';
import { cookies } from 'next/headers';
import { getServerAuth } from '@/lib/authServer';
import { createServerClientWithAuth } from '@/lib/supabaseServer';

export interface AuthAndBillingData {
  auth: {
    userId: string | null;
    accountId: string | null;
    role: 'general' | 'admin' | null;
    name: string | null;
  };
  billing: {
    accountId: string | null;
    features: Array<{
      slug: string;
      name: string;
      limit_value: number | null;
      limit_type: 'count' | 'storage_mb' | 'boolean' | 'unlimited' | null;
      is_unlimited: boolean;
      category: string | null;
    }>;
  };
}

/**
 * Get auth and billing data in a single call
 * Uses React cache() to deduplicate within the same request
 */
export const getAuthAndBilling = cache(async (): Promise<AuthAndBillingData> => {
  const auth = await getServerAuth();
  
  // If no auth, return empty data
  if (!auth) {
    return {
      auth: {
        userId: null,
        accountId: null,
        role: null,
        name: null,
      },
      billing: {
        accountId: null,
        features: [],
      },
    };
  }

  // Get active account ID from cookie
  const cookieStore = await cookies();
  const activeAccountIdCookie = cookieStore.get('active_account_id');
  const activeAccountId = activeAccountIdCookie?.value || null;

  let accountId: string | null = null;

  // Determine account ID (active account or first account)
  if (activeAccountId) {
    const supabase = await createServerClientWithAuth(cookieStore);
    const { data: activeAccount } = await supabase
      .from('accounts')
      .select('id')
      .eq('id', activeAccountId)
      .eq('user_id', auth.id)
      .maybeSingle();
    
    if (activeAccount) {
      accountId = (activeAccount as { id: string }).id;
    }
  }

  if (!accountId) {
    const supabase = await createServerClientWithAuth(cookieStore);
    const { data: fallback } = await supabase
      .from('accounts')
      .select('id')
      .eq('user_id', auth.id)
      .limit(1)
      .maybeSingle();
    
    accountId = fallback ? (fallback as { id: string }).id : null;
  }

  // Fetch billing features if we have an account
  let features: AuthAndBillingData['billing']['features'] = [];
  
  if (accountId) {
    try {
      const supabase = await createServerClientWithAuth(cookieStore);
      const { data, error } = await supabase.rpc('get_account_features_with_limits', {
        account_id: accountId,
      } as any);

      if (!error && Array.isArray(data)) {
        features = data.map((row: any) => ({
          slug: row.feature_slug,
          name: row.feature_name,
          limit_value: row.limit_value ?? null,
          limit_type: row.limit_type ?? null,
          is_unlimited: Boolean(row.is_unlimited),
          category: row.category ?? null,
        }));
      }
    } catch (error) {
      // Silently fail - features will be empty array
      console.warn('[getAuthAndBilling] Error fetching features:', error);
    }
  }

  return {
    auth: {
      userId: auth.id,
      accountId,
      role: auth.role,
      name: auth.name,
    },
    billing: {
      accountId,
      features,
    },
  };
});
