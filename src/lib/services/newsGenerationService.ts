/**
 * News Generation Service
 * 
 * Simple service for generating news articles via RapidAPI.
 * Ready for account use but currently dormant.
 * 
 * NOTE: This is a server-side only service. It must be called from
 * an API route or server component, not from client components.
 * 
 * This service calls the RapidAPI news endpoint with a prompt
 * and saves the response to news.prompt table via Supabase RPC.
 * The database trigger automatically extracts articles to news.generated.
 */

import { createClient } from '@supabase/supabase-js';
import { getApiKey } from '@/lib/security/apiKeys';

const RAPIDAPI_HOST = 'real-time-news-data.p.rapidapi.com';
const RAPIDAPI_BASE_URL = 'https://real-time-news-data.p.rapidapi.com/search';

export interface NewsGenerationOptions {
  query: string;
  timePublished?: string; // e.g., '1d', '7d', '30d'
  country?: string; // e.g., 'US'
  lang?: string; // e.g., 'en'
}

export interface NewsGenerationResult {
  success: boolean;
  promptId?: string;
  error?: string;
}

/**
 * Generate news articles from RapidAPI
 * 
 * @param accountId - UUID of the account generating the news
 * @param options - News generation options (query, timePublished, country, lang)
 * @returns Result with prompt ID if successful
 */
export async function generateNews(
  accountId: string,
  options: NewsGenerationOptions
): Promise<NewsGenerationResult> {
  try {
    // Get API key
    const apiKey = getApiKey('RAPIDAPI');
    if (!apiKey) {
      return {
        success: false,
        error: 'RapidAPI key not configured',
      };
    }

    // Build query parameters
    const params = new URLSearchParams({
      query: options.query,
      time_published: options.timePublished || '1d',
      country: options.country || 'US',
      lang: options.lang || 'en',
    });

    // Call RapidAPI
    const response = await fetch(`${RAPIDAPI_BASE_URL}?${params.toString()}`, {
      method: 'GET',
      headers: {
        'X-RapidAPI-Host': RAPIDAPI_HOST,
        'X-RapidAPI-Key': apiKey,
      },
    });

    if (!response.ok) {
      return {
        success: false,
        error: `API request failed: ${response.status} ${response.statusText}`,
      };
    }

    const data = await response.json();

    // Check API response status
    if (data.status !== 'OK') {
      return {
        success: false,
        error: `API returned non-OK status: ${data.status}`,
      };
    }

    // Build API response object for database
    const apiResponse = {
      requestId: data.request_id || null,
      articles: data.data || [],
      count: Array.isArray(data.data) ? data.data.length : 0,
      query: options.query,
      timePublished: options.timePublished || '1d',
      country: options.country || 'US',
      lang: options.lang || 'en',
      generatedAt: new Date().toISOString(),
    };

    // Save to database via Supabase RPC
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return {
        success: false,
        error: 'Supabase configuration missing',
      };
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    const { data: promptData, error: dbError } = await supabase.rpc(
      'insert_prompt',
      {
        p_account_id: accountId,
        p_user_input: options.query,
        p_api_response: apiResponse,
      }
    );

    if (dbError) {
      return {
        success: false,
        error: `Database error: ${dbError.message}`,
      };
    }

    if (!promptData || promptData.length === 0) {
      return {
        success: false,
        error: 'Failed to save prompt to database',
      };
    }

    return {
      success: true,
      promptId: promptData[0].id,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
