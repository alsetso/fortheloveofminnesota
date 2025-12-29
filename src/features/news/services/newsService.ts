import { createServerClientWithAuth, createServiceClient } from '@/lib/supabaseServer';
import { cookies } from 'next/headers';
import type { Database } from '@/types/supabase';

type NewsGen = Database['public']['Tables']['news_gen']['Row'];
type NewsGenInsert = Database['public']['Tables']['news_gen']['Insert'];

/**
 * Get the latest news generation from the database
 * Returns the most recent news_gen record (for all users to view)
 * Uses service client to bypass RLS since this is public data
 * Falls back to anon client if service role key is not available (e.g., during build)
 */
export async function getLatestNewsGen(): Promise<NewsGen | null> {
  let supabase;
  
  try {
    supabase = createServiceClient();
  } catch (error) {
    // Fallback to anon client if service role key is not available (e.g., during build)
    const { createServerClient } = require('@/lib/supabaseServer');
    supabase = createServerClient();
  }

  const { data, error } = await supabase
    .from('news_gen')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('Error fetching latest news_gen:', error);
    return null;
  }

  return data;
}

/**
 * Check if news was generated within the last 24 hours
 * Returns true if there's a news_gen record created in the last 24 hours
 * Uses service client to bypass RLS
 */
export async function hasNewsGeneratedRecently(): Promise<boolean> {
  const supabase = createServiceClient();

  // Check for records in the last 24 hours
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('news_gen')
    .select('id')
    .gte('created_at', twentyFourHoursAgo)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('Error checking if news generated recently:', error);
    return false;
  }

  return !!data;
}

/**
 * Save news generation to database
 * Requires admin role (enforced by RLS)
 * Saves to public.news_gen table
 */
export async function saveNewsGen(
  accountId: string,
  userInput: string,
  apiResponse: unknown
): Promise<NewsGen | null> {
  const supabase = await createServerClientWithAuth(cookies());

  const insertData: NewsGenInsert = {
    account_id: accountId,
    user_input: userInput,
    api_response: apiResponse as Record<string, unknown>,
  };

  console.log('[saveNewsGen] Inserting into public.news_gen:', {
    account_id: accountId,
    user_input: userInput,
    api_response_keys: Object.keys(apiResponse as Record<string, unknown>),
  });

  const { data, error } = await (supabase as any)
    .from('news_gen')
    .insert(insertData)
    .select()
    .single();

  if (error) {
    console.error('[saveNewsGen] Error saving to public.news_gen:', error);
    console.error('[saveNewsGen] Error details:', {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
    });
    return null;
  }

  console.log('[saveNewsGen] Successfully saved to public.news_gen:', data?.id);
  return data;
}

