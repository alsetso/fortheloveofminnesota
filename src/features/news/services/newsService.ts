import { createServerClientWithAuth, createServiceClient } from '@/lib/supabaseServer';
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

export interface NewsPromptInsert {
  account_id: string;
  user_input: string;
  api_response: Record<string, unknown>;
}

/**
 * Get the latest news prompt from the database
 * Returns the most recent prompt record
 * Uses service client to bypass RLS since this is public data
 */
export async function getLatestPrompt(): Promise<NewsPrompt | null> {
  let supabase;
  
  try {
    supabase = createServiceClient();
  } catch (error) {
    const { createServerClient } = require('@/lib/supabaseServer');
    supabase = createServerClient();
  }

  // Use RPC function to query news.prompt
  const { data, error } = await supabase.rpc('get_latest_prompt');

  if (error) {
    console.error('Error fetching latest prompt:', error);
    return null;
  }

  // RPC returns array, get first result
  return (data && data.length > 0) ? data[0] : null;
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
): Promise<NewsPrompt | null> {
  const supabase = await createServerClientWithAuth(cookies());

  const insertData: NewsPromptInsert = {
    account_id: accountId,
    user_input: userInput,
    api_response: apiResponse as Record<string, unknown>,
  };

  console.log('[savePrompt] Inserting into news.prompt:', {
    account_id: accountId,
    user_input: userInput,
  });

  // Use RPC function to insert into news.prompt
  const { data, error } = await supabase.rpc('insert_prompt', {
    p_account_id: accountId,
    p_user_input: userInput,
    p_api_response: apiResponse as Record<string, unknown>,
  });

  if (error) {
    console.error('[savePrompt] Error saving to news.prompt:', error);
    return null;
  }

  // RPC returns array, get first result
  const result = (data && data.length > 0) ? data[0] : null;
  console.log('[savePrompt] Successfully saved:', result?.id);
  return result;
}

/**
 * Save news prompt using service client (for cron jobs)
 * Bypasses RLS for automated processes
 */
export async function savePromptWithService(
  accountId: string,
  userInput: string,
  apiResponse: unknown
): Promise<NewsPrompt | null> {
  const supabase = createServiceClient();

  const insertData: NewsPromptInsert = {
    account_id: accountId,
    user_input: userInput,
    api_response: apiResponse as Record<string, unknown>,
  };

  // Use RPC function to insert into news.prompt
  const { data, error } = await supabase.rpc('insert_prompt', {
    p_account_id: accountId,
    p_user_input: userInput,
    p_api_response: apiResponse as Record<string, unknown>,
    });

  if (error) {
    console.error('[savePromptWithService] Error:', error);
    return null;
  }

  // RPC returns array, get first result
  return (data && data.length > 0) ? data[0] : null;
}


