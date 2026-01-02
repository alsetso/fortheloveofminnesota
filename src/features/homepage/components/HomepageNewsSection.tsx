'use client';

import { useState, useEffect } from 'react';
import { ClockIcon, NewspaperIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';
import Image from 'next/image';
import type { NewsArticle } from '@/types/news';
import { getSourceInitials, getSourceColor, formatDate, formatFullDateTime } from '@/features/news/utils/newsHelpers';
import { useAuthStateSafe } from '@/features/auth';

interface LatestNewsResponse {
  success: boolean;
  data: {
    articles: NewsArticle[];
    count?: number;
    requestId?: string;
    query?: string;
    generatedAt?: string;
    createdAt?: string;
  };
  error?: string;
}

export default function HomepageNewsSection() {
  const { account } = useAuthStateSafe();
  const isAdmin = account?.role === 'admin';

  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [query, setQuery] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const displayedCount = 8; // Show 8 articles on homepage

  useEffect(() => {
    fetchLatestNews();
  }, []);

  const fetchLatestNews = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/news/latest');
      const data: LatestNewsResponse = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch news');
      }

      if (data.success && data.data) {
        setArticles(data.data.articles || []);
        setGeneratedAt(data.data.generatedAt || data.data.createdAt || null);
        setQuery(data.data.query || null);
      } else {
        setArticles([]);
        setError('No news data available');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load news');
      setArticles([]);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);

    try {
      const response = await fetch('/api/news/generate', {
        method: 'POST',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate news');
      }

      // Refresh the news list after generation
      await fetchLatestNews();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate news');
    } finally {
      setGenerating(false);
    }
  };

  // Check if news was generated in the last 24 hours
  const isRecent = generatedAt ? (() => {
    try {
      const genDate = new Date(generatedAt);
      const now = new Date();
      const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      return genDate >= twentyFourHoursAgo;
    } catch {
      return false;
    }
  })() : false;

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <NewspaperIcon className="w-4 h-4 text-gray-700" />
          <h2 className="text-sm font-semibold text-gray-900">NEWS</h2>
        </div>
        {isAdmin && !isRecent && (
          <button
            onClick={handleGenerate}
            disabled={generating || loading}
            className="px-3 py-1.5 text-xs font-medium text-white bg-gray-900 hover:bg-gray-800 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {generating ? 'Generating...' : 'Generate'}
          </button>
        )}
      </div>

      <p className="text-xs text-gray-600">
        Latest Minnesota news from the last 24 hours. Stay informed about what's happening across the state.
      </p>

      {loading ? (
        <div className="bg-white border border-gray-200 rounded-md p-[10px]">
          <p className="text-xs text-gray-600">Loading news...</p>
        </div>
      ) : error ? (
        <div className="bg-white border border-red-200 rounded-md p-[10px]">
          <p className="text-xs text-red-600">{error}</p>
          {!isAdmin && (
            <p className="text-xs text-gray-600 mt-1">
              An admin needs to generate news first.
            </p>
          )}
        </div>
      ) : articles.length > 0 ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-gray-500">
            {query && <span>{query}</span>}
            {generatedAt && (
              <div className="flex items-center gap-1">
                <ClockIcon className="w-3 h-3" />
                <span>Generated {formatDate(generatedAt)}</span>
              </div>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2">
            {articles.slice(0, displayedCount).map((article) => {
              const sourceInitials = getSourceInitials(article.source.name);
              const sourceColor = getSourceColor(article.source.name);
              
              return (
                <Link
                  key={article.id}
                  href={`/news/${article.id}`}
                  className="bg-white border border-gray-200 rounded-md overflow-hidden hover:bg-gray-50 transition-colors"
                >
                  {/* Photo Image */}
                  {article.photoUrl ? (
                    <div className="relative w-full aspect-video overflow-hidden bg-gray-100">
                      <Image
                        src={article.photoUrl}
                        alt={article.title}
                        fill
                        className="object-cover"
                        sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 25vw"
                        unoptimized
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                        }}
                      />
                    </div>
                  ) : (
                    <div className={`w-full aspect-video ${sourceColor.bg} flex items-center justify-center border-b border-gray-200`}>
                      <span className={`text-xs font-semibold ${sourceColor.text} leading-none`}>
                        {sourceInitials}
                      </span>
                    </div>
                  )}
                    
                  {/* Content */}
                  <div className="p-[10px] space-y-1.5">
                    <h3 className="text-xs font-semibold text-gray-900 line-clamp-2 leading-snug">
                      {article.title}
                    </h3>
                    <div className="flex items-center gap-1 text-[10px] text-gray-500">
                      <ClockIcon className="w-3 h-3 flex-shrink-0" />
                      <span className="line-clamp-1">{formatFullDateTime(article.publishedAt)}</span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
          
          {articles.length > displayedCount && (
            <div className="text-center pt-2">
              <Link
                href="/news"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 bg-white hover:bg-gray-50 rounded transition-colors border border-gray-200"
              >
                <span>View All News ({articles.length})</span>
              </Link>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-md p-[10px]">
          <p className="text-xs text-gray-600">
            {isAdmin 
              ? 'No news available. Click "Generate" to fetch the latest Minnesota news.'
              : 'No news available. An admin needs to generate news first.'}
          </p>
        </div>
      )}
    </section>
  );
}

