import { cache } from 'react';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { Database } from '@/types/supabase';

async function getActiveAccountIdForUser(
  supabase: ReturnType<typeof createServerClient<Database>>,
  cookieStore: Awaited<ReturnType<typeof cookies>>,
  userId: string
): Promise<string | null> {
  const activeAccountId = cookieStore.get('active_account_id')?.value || null;

  if (activeAccountId) {
    const { data: active, error } = await supabase
      .from('accounts')
      .select('id')
      .eq('id', activeAccountId)
      .eq('user_id', userId)
      .maybeSingle();

    if (!error && active && typeof (active as { id?: unknown }).id === 'string') {
      return (active as { id: string }).id;
    }
  }

  const { data: fallback, error: fallbackError } = await supabase
    .from('accounts')
    .select('id')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle();

  if (fallbackError || !fallback || typeof (fallback as { id?: unknown }).id !== 'string') {
    return null;
  }

  return (fallback as { id: string }).id;
}

/**
 * Check if user has access to a specific feature
 * Uses the billing schema as source of truth
 * 
 * @param featureSlug - The feature slug to check (e.g., 'unlimited_maps')
 * @returns true if user has access to the feature, false otherwise
 */
export const hasFeatureAccess = cache(async (featureSlug: string): Promise<boolean> => {
  const cookieStore = await cookies();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseAnonKey) {
    return false;
  }
  
  const supabase = createServerClient<Database>(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {
          // Server components can't set cookies - no-op
        },
      },
    }
  );
  
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  
  if (authError || !user) {
    return false;
  }

  const accountId = await getActiveAccountIdForUser(supabase, cookieStore, user.id);
  if (!accountId) {
    return false;
  }
  
  // Call Supabase function to check feature access
  // Use public schema wrapper for PostgREST compatibility
  const { data, error } = await supabase.rpc('account_has_feature', {
    account_id: accountId,
    feature_slug: featureSlug,
  });
  
  if (error) {
    console.error('Error checking feature access:', error);
    return false;
  }
  
  return data === true;
});

/**
 * Get all features available to current user
 * 
 * @returns Array of feature slugs available to the user
 */
export const getUserFeatures = cache(async (): Promise<string[]> => {
  const cookieStore = await cookies();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseAnonKey) {
    return [];
  }
  
  const supabase = createServerClient<Database>(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {
          // Server components can't set cookies - no-op
        },
      },
    }
  );
  
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  
  if (authError || !user) {
    return [];
  }

  const accountId = await getActiveAccountIdForUser(supabase, cookieStore, user.id);
  if (!accountId) {
    return [];
  }
  
  // Call Supabase function to get user features
  // Use public schema wrapper for PostgREST compatibility
  const { data, error } = await supabase.rpc('get_account_features_with_limits', {
    account_id: accountId,
  });
  
  if (error) {
    console.error('Error getting user features:', error);
    return [];
  }
  
  return (data || []).map((row: { feature_slug: string }) => row.feature_slug);
});

/**
 * Check if user has access to any of the specified features
 * 
 * @param featureSlugs - Array of feature slugs to check
 * @returns true if user has access to at least one feature
 */
export async function hasAnyFeature(featureSlugs: string[]): Promise<boolean> {
  if (featureSlugs.length === 0) return false;
  
  const userFeatures = await getUserFeatures();
  return featureSlugs.some(slug => userFeatures.includes(slug));
}

/**
 * Check if user has access to all of the specified features
 * 
 * @param featureSlugs - Array of feature slugs to check
 * @returns true if user has access to all features
 */
export async function hasAllFeatures(featureSlugs: string[]): Promise<boolean> {
  if (featureSlugs.length === 0) return true;
  
  const userFeatures = await getUserFeatures();
  return featureSlugs.every(slug => userFeatures.includes(slug));
}
