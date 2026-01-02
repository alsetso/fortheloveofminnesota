import { createServerClientWithAuth, createServiceClient, createServerClient } from '@/lib/supabaseServer';
import { cookies } from 'next/headers';

// Types for news schema
export interface NewsPrompt {
  id: string;
  account_id: string;
  user_input: string;
  api_response: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

/**
 * Get the latest news prompt from the database
 * Returns the most recent prompt record
 * Uses service client to bypass RLS since this is public data
 */
export async function getLatestPrompt(): Promise<NewsPrompt | null> {
  // Use anon client - RPC function is SECURITY DEFINER and granted to anon
  // This works in production without requiring service role key
  let supabase;
  
  try {
    supabase = createServerClient();
  } catch (error) {
    console.error('[getLatestPrompt] Error creating server client:', error);
    // Fallback to service client if available (for admin operations)
    try {
      supabase = createServiceClient();
    } catch (fallbackError) {
      console.error('[getLatestPrompt] Error creating fallback client:', fallbackError);
      return null;
    }
  }

  if (!supabase) {
    console.error('[getLatestPrompt] No Supabase client available');
    return null;
  }

  // Use RPC function to query news.prompt
  let data: any = null;
  let error: any = null;
  
  try {
    const result = await supabase.rpc('get_latest_prompt');
    data = result.data;
    error = result.error;
  } catch (rpcError) {
    console.error('[getLatestPrompt] RPC call failed:', rpcError);
    error = rpcError;
  }

  if (error) {
    console.error('[getLatestPrompt] Error fetching latest prompt:', {
      error,
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
    });
    return null;
  }

  // RPC returns array, get first result
  return (data && Array.isArray(data) && data.length > 0) ? (data[0] as NewsPrompt) : null;
}

/**
 * Check if news was generated within the last 24 hours
 * Returns true if there's a prompt record created in the last 24 hours
 */
export async function hasNewsGeneratedRecently(): Promise<boolean> {
  const supabase = createServiceClient();

  // Use RPC function to check news.prompt
  const { data, error } = await supabase.rpc('has_news_generated_recently');

  if (error) {
    console.error('Error checking if news generated recently:', error);
    return false;
  }

  return data === true;
}

/**
 * Save news prompt to database
 * Requires admin role (enforced by RLS)
 * Saves to news.prompt table
 * Trigger automatically extracts articles to news.generated
 */
export async function savePrompt(
  accountId: string,
  userInput: string,
  apiResponse: unknown
): Promise<{ prompt: NewsPrompt | null; error: string | null }> {
  const supabase = await createServerClientWithAuth(cookies());

  console.log('[savePrompt] Inserting into news.prompt:', {
    account_id: accountId,
    user_input: userInput,
  });

  // Use RPC function to insert into news.prompt
  const { data, error } = await (supabase.rpc as any)('insert_prompt', {
    p_account_id: accountId,
    p_user_input: userInput,
    p_api_response: apiResponse as Record<string, unknown>,
  });

  if (error) {
    console.error('[savePrompt] Error saving to news.prompt:', {
      error,
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
    });
    return {
      prompt: null,
      error: error.message || 'Failed to save prompt to database',
    };
  }

  // RPC returns array, get first result
  const result = (data && Array.isArray(data) && data.length > 0) ? (data[0] as NewsPrompt) : null;
  if (result) {
    console.log('[savePrompt] Successfully saved:', result.id);
  } else {
    console.warn('[savePrompt] RPC returned no data');
  }
  return { prompt: result, error: null };
}

/**
 * Save news prompt using service client (for cron jobs)
 * Bypasses RLS for automated processes
 */
export async function savePromptWithService(
  accountId: string,
  userInput: string,
  apiResponse: unknown
): Promise<{ prompt: NewsPrompt | null; error: string | null }> {
  const supabase = createServiceClient();

  console.log('[savePromptWithService] Inserting into news.prompt:', {
    account_id: accountId,
    user_input: userInput,
  });

  // Use RPC function to insert into news.prompt
  const { data, error } = await (supabase.rpc as any)('insert_prompt', {
    p_account_id: accountId,
    p_user_input: userInput,
    p_api_response: apiResponse as Record<string, unknown>,
    });

  if (error) {
    console.error('[savePromptWithService] Error:', {
      error,
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
    });
    return {
      prompt: null,
      error: error.message || 'Failed to save prompt to database',
    };
  }

  // RPC returns array, get first result
  const result = (data && Array.isArray(data) && data.length > 0) ? (data[0] as NewsPrompt) : null;
  if (result) {
    console.log('[savePromptWithService] Successfully saved:', result.id);
  } else {
    console.warn('[savePromptWithService] RPC returned no data');
  }
  return { prompt: result, error: null };
}


