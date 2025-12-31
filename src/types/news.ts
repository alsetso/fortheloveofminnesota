/**
 * Consolidated news-related types
 * Single source of truth for news article and comment types
 */

export interface NewsSource {
  url: string;
  name: string;
  logoUrl: string | null;
  faviconUrl: string | null;
  publicationId: string;
}

export interface NewsArticle {
  id: string;
  article_id: string;
  title: string;
  link: string;
  snippet: string;
  photoUrl: string | null;
  thumbnailUrl: string | null;
  publishedAt: string;
  published_date?: string;
  authors: string[];
  source: NewsSource;
  relatedTopics: string[] | Array<{ topic_id?: string; topic_name?: string; [key: string]: any }>;
}

export interface NewsArticleRaw {
  article_id: string;
  title: string;
  link: string;
  snippet: string;
  photo_url: string | null;
  thumbnail_url: string | null;
  published_datetime_utc: string;
  authors: string[];
  source_url: string;
  source_name: string;
  source_logo_url: string | null;
  source_favicon_url: string | null;
  source_publication_id: string;
  related_topics: string[];
}

export interface NewsResponse {
  status: string;
  request_id: string;
  data: NewsArticleRaw[];
}

export interface ArticleComment {
  id: string;
  generated_id: string;
  account_id: string;
  parent_comment_id: string | null;
  content: string;
  created_at: string;
  updated_at: string;
  accounts?: {
    id: string;
    username: string | null;
    first_name: string | null;
    image_url: string | null;
  };
}

export interface NewsApiParams {
  query: string;
  limit?: string;
  timePublished?: string;
  source?: string;
  country?: string;
  lang?: string;
}

