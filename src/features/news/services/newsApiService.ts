/**
 * RapidAPI news service
 * Consolidates shared logic for fetching and formatting news from RapidAPI
 */

import type { NewsArticleRaw, NewsResponse, NewsApiParams, NewsArticle } from '@/types/news';
import { getApiKey } from '@/lib/security/apiKeys';

/**
 * Fetch news from RapidAPI
 */
export async function fetchNewsFromRapidAPI(params: NewsApiParams): Promise<NewsResponse> {
  // Get server-only API key
  let apiKey: string;
  try {
    apiKey = getApiKey('RAPIDAPI');
  } catch (error) {
    throw new Error('RapidAPI key not configured');
  }

  const baseUrl = 'https://real-time-news-data.p.rapidapi.com/search';
  const urlParams = new URLSearchParams();
  urlParams.append('query', params.query);
  
  if (params.limit) {
    const limitNum = parseInt(params.limit, 10);
    if (limitNum >= 1 && limitNum <= 500) {
      urlParams.append('limit', params.limit);
    }
  } else {
    urlParams.append('limit', '50'); // Default limit
  }
  
  if (params.timePublished) {
    urlParams.append('time_published', params.timePublished);
  } else {
    urlParams.append('time_published', '1d'); // Default: 24 hours
  }
  
  if (params.source) {
    urlParams.append('source', params.source);
  }
  
  if (params.country) {
    urlParams.append('country', params.country);
  } else {
    urlParams.append('country', 'US'); // Default: US
  }
  
  if (params.lang) {
    urlParams.append('lang', params.lang);
  } else {
    urlParams.append('lang', 'en'); // Default: English
  }

  const url = `${baseUrl}?${urlParams.toString()}`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'GET',
      headers: {
        'x-rapidapi-host': 'real-time-news-data.p.rapidapi.com',
        'x-rapidapi-key': apiKey,
      },
    });
  } catch (fetchError: any) {
    // Handle SSL/certificate errors
    if (fetchError?.code === 'ERR_TLS_CERT_ALTNAME_INVALID' || fetchError?.message?.includes('certificate')) {
      console.error('SSL certificate error with news API endpoint:', fetchError.message);
      throw new Error('SSL certificate validation failed. The news API endpoint may be temporarily unavailable or misconfigured.');
    }
    throw fetchError;
  }

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unable to read error response');
    console.error('RapidAPI error:', response.status, errorText);
    throw new Error(`Failed to fetch news data: ${errorText}`);
  }

  const data: NewsResponse = await response.json();

  // Check if status is OK
  if (data.status !== 'OK') {
    throw new Error(`News API returned non-OK status: ${data.status}`);
  }

  return data;
}

/**
 * Deduplicate articles by article_id
 */
export function deduplicateArticles(articles: NewsArticleRaw[]): NewsArticleRaw[] {
  const articleMap = new Map<string, NewsArticleRaw>();
  articles.forEach((article) => {
    if (!articleMap.has(article.article_id)) {
      articleMap.set(article.article_id, article);
    }
  });
  return Array.from(articleMap.values());
}

/**
 * Format raw API articles to frontend format
 */
export function formatNewsArticles(articles: NewsArticleRaw[]): NewsArticle[] {
  return articles.map((article) => ({
    id: article.article_id,
    article_id: article.article_id,
    title: article.title,
    link: article.link,
    snippet: article.snippet,
    photoUrl: article.photo_url,
    thumbnailUrl: article.thumbnail_url,
    publishedAt: article.published_datetime_utc,
    authors: article.authors || [],
    source: {
      url: article.source_url,
      name: article.source_name,
      logoUrl: article.source_logo_url,
      faviconUrl: article.source_favicon_url,
      publicationId: article.source_publication_id,
    },
    relatedTopics: article.related_topics || [],
  }));
}

