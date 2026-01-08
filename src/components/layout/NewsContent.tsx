'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ClockIcon } from '@heroicons/react/24/outline';
import { getSourceInitials, getSourceColor, formatDate } from '@/features/news/utils/newsHelpers';
import type { NewsArticle } from '@/types/news';

interface NewsResponse {
  success: boolean;
  data?: {
    articles: NewsArticle[];
    pagination: {
      offset: number;
      limit: number;
      total: number;
      hasMore: boolean;
    };
  };
  error?: string;
}

interface NewsContentProps {
  onGenerationComplete?: () => void;
}

export default function NewsContent({ onGenerationComplete }: NewsContentProps = {}) {
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [useBlurStyle, setUseBlurStyle] = useState(() => {
    return typeof window !== 'undefined' && (window as any).__useBlurStyle === true;
  });

  // Listen for blur style changes
  useEffect(() => {
    const handleBlurStyleChange = (e: CustomEvent) => {
      setUseBlurStyle(e.detail.useBlurStyle);
    };
    window.addEventListener('blur-style-change', handleBlurStyleChange as EventListener);
    return () => {
      window.removeEventListener('blur-style-change', handleBlurStyleChange as EventListener);
    };
  }, []);

  const fetchNews = async (currentOffset: number, append: boolean = false) => {
    if (append) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const response = await fetch(`/api/news/all?offset=${currentOffset}&limit=10`);
      const data: NewsResponse = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch news');
      }

      if (data.success && data.data) {
        if (append) {
          setArticles((prev) => [...prev, ...data.data!.articles]);
        } else {
          setArticles(data.data.articles);
        }
        setHasMore(data.data.pagination.hasMore);
        setOffset(currentOffset + data.data.articles.length);
      } else {
        if (!append) {
          setArticles([]);
        }
        setHasMore(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load news');
      if (!append) {
        setArticles([]);
      }
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    fetchNews(0, false);
  }, []);

  // Listen for generate news event
  useEffect(() => {
    const handleGenerateNews = async () => {
      try {
        const response = await fetch('/api/news/generate', {
          method: 'POST',
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to generate news');
        }

        // Refresh the news list after generation
        await fetchNews(0, false);
        
        // Notify parent that generation is complete
        if (onGenerationComplete) {
          onGenerationComplete();
        }
      } catch (err) {
        console.error('Failed to generate news:', err);
      }
    };

    window.addEventListener('generate-news', handleGenerateNews);
    return () => {
      window.removeEventListener('generate-news', handleGenerateNews);
    };
  }, [onGenerationComplete]);

  const handleLoadMore = () => {
    if (!loadingMore && hasMore) {
      fetchNews(offset, true);
    }
  };

  return (
    <div className="space-y-3">
      {/* Loading State */}
      {loading && (
        <div className="px-2 py-1.5">
          <p className={`text-xs ${useBlurStyle ? 'text-white/80' : 'text-gray-600'}`}>Loading news...</p>
        </div>
      )}

      {/* Error State */}
      {!loading && error && (
        <div className="px-2 py-1.5">
          <p className={`text-xs ${useBlurStyle ? 'text-white/80' : 'text-gray-600'}`}>{error}</p>
        </div>
      )}

      {/* No News */}
      {!loading && !error && articles.length === 0 && (
        <div className="px-2 py-1.5">
          <p className={`text-xs ${useBlurStyle ? 'text-white/80' : 'text-gray-600'}`}>No news available.</p>
        </div>
      )}

      {/* Articles */}
      {!loading && articles.length > 0 && (
        <div className="space-y-0.5">
          {articles.map((article) => {
            const sourceColor = getSourceColor(article.source?.name);
            const sourceInitials = getSourceInitials(article.source?.name);

            return (
              <Link
                key={article.id}
                href={`/news/${article.id}`}
                className={`flex items-start gap-2 px-2 py-1.5 rounded text-xs transition-colors ${
                  useBlurStyle
                    ? 'text-white/80 hover:bg-white/10 hover:text-white'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                {/* Source Circle */}
                <div
                  className={`w-5 h-5 rounded-full ${sourceColor.bg} ${sourceColor.text} flex items-center justify-center flex-shrink-0 text-[10px] font-medium mt-0.5`}
                >
                  {sourceInitials}
                </div>

                {/* Title and Date */}
                <div className="flex-1 min-w-0">
                  <div className="font-medium break-words">{article.title}</div>
                  <div className={`flex items-center gap-1.5 text-[10px] mt-0.5 ${
                    useBlurStyle ? 'text-white/60' : 'text-gray-500'
                  }`}>
                    <span className="truncate">{article.source?.name}</span>
                    <span>•</span>
                    <div className="flex items-center gap-1">
                      <ClockIcon className="w-3 h-3" />
                      <span>{formatDate(article.publishedAt)}</span>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* Load More Button */}
      {!loading && !error && hasMore && (
        <div className="px-2 py-1.5">
          <button
            onClick={handleLoadMore}
            disabled={loadingMore}
            className={`w-full px-3 py-2 text-xs font-medium rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
              useBlurStyle
                ? 'text-white bg-white/10 border border-white/20 hover:bg-white/20'
                : 'text-gray-700 bg-white border border-gray-200 hover:bg-gray-50'
            }`}
          >
            {loadingMore ? 'Loading...' : 'Load More'}
          </button>
        </div>
      )}
    </div>
  );
}

