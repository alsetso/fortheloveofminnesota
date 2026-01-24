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
import { generateUUID } from '@/lib/utils/uuid';

const RAPIDAPI_HOST = 'real-time-news-data.p.rapidapi.com';
const RAPIDAPI_BASE_URL = 'https://real-time-news-data.p.rapidapi.com/search';

export interface NewsGenerationOptions {
  query: string;
  timePublished?: string; // e.g., '1d', '7d', '30d'
  country?: string; // e.g., 'US'
  lang?: string; // e.g., 'en'
}

export interface ParsedArticle {
  article_id: string;
  title: string;
  link: string;
  snippet: string | null;
  photo_url: string | null;
  thumbnail_url: string | null;
  published_at: string;
  published_date: string;
  authors: string[];
  source_url: string | null;
  source_name: string | null;
  source_logo_url: string | null;
  source_favicon_url: string | null;
  source_publication_id: string | null;
  related_topics: string[];
}

export interface NewsGenerationResult {
  success: boolean;
  promptId?: string;
  articles?: ParsedArticle[];
  articlesExtracted?: boolean;
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

    const apiUrl = `${RAPIDAPI_BASE_URL}?${params.toString()}`;

    // Call RapidAPI
    const response = await fetch(apiUrl, {
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

    // Parse articles from API response
    const rawArticles = data.data || [];
    const parsedArticles: ParsedArticle[] = [];
    const now = new Date();

    for (const article of rawArticles) {
      try {
        let publishedAt: Date;
        try {
          publishedAt = article.publishedAt 
            ? new Date(article.publishedAt) 
            : now;
        } catch {
          publishedAt = now;
        }

        // Convert to Central Time for published_date
        const centralTime = new Date(publishedAt.toLocaleString('en-US', { timeZone: 'America/Chicago' }));
        const publishedDate = centralTime.toISOString().split('T')[0];

        parsedArticles.push({
          article_id: article.id || generateUUID(),
          title: article.title || 'Untitled',
          link: article.link || '',
          snippet: article.snippet || null,
          photo_url: article.photoUrl || null,
          thumbnail_url: article.thumbnailUrl || null,
          published_at: publishedAt.toISOString(),
          published_date: publishedDate,
          authors: Array.isArray(article.authors) ? article.authors : [],
          source_url: article.source?.url || null,
          source_name: article.source?.name || null,
          source_logo_url: article.source?.logoUrl || null,
          source_favicon_url: article.source?.faviconUrl || null,
          source_publication_id: article.source?.publicationId || null,
          related_topics: Array.isArray(article.relatedTopics) ? article.relatedTopics : [],
        });
      } catch (err) {
        // Skip invalid articles
        continue;
      }
    }

    // Build API response object for database
    const apiResponse = {
      requestId: data.request_id || null,
      articles: rawArticles,
      count: parsedArticles.length,
      query: options.query,
      timePublished: options.timePublished || '1d',
      country: options.country || 'US',
      lang: options.lang || 'en',
      generatedAt: new Date().toISOString(),
    };

    // Save prompt to database (without extracting articles yet)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return {
        success: false,
        error: 'Supabase configuration missing',
      };
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    // Verify the account exists
    const { data: accountData, error: accountError } = await supabase
      .from('accounts')
      .select('id, role')
      .eq('id', accountId)
      .maybeSingle();

    if (accountError) {
      return {
        success: false,
        error: `Account lookup error: ${accountError.message}`,
      };
    }

    if (!accountData) {
      return {
        success: false,
        error: `Account not found: ${accountId}`,
      };
    }

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

    const promptId = promptData[0].id;

    return {
      success: true,
      promptId,
      articles: parsedArticles,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
