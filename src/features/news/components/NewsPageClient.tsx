'use client';

import { useState, useEffect } from 'react';
import { ArrowTopRightOnSquareIcon, ClockIcon } from '@heroicons/react/24/outline';
import { useAuthStateSafe } from '@/features/auth';
import Link from 'next/link';

interface NewsArticle {
  id: string;
  title: string;
  link: string;
  snippet: string;
  photoUrl: string | null;
  thumbnailUrl: string | null;
  publishedAt: string;
  authors: string[];
  source: {
    url: string;
    name: string;
    logoUrl: string | null;
    faviconUrl: string | null;
    publicationId: string;
  };
  relatedTopics: string[];
}

interface LatestNewsResponse {
  success: boolean;
  data: {
    articles: NewsArticle[];
    count: number;
    requestId?: string;
    query?: string;
    generatedAt?: string;
    createdAt?: string;
  };
  error?: string;
}

export default function NewsPageClient() {
  const { account, user } = useAuthStateSafe();
  const isAdmin = account?.role === 'admin';

  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [displayedCount, setDisplayedCount] = useState(5);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [query, setQuery] = useState<string | null>(null);

  // Fetch latest news on mount
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

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      
      if (diffDays === 0) {
        return 'Today';
      } else if (diffDays === 1) {
        return 'Yesterday';
      } else if (diffDays < 7) {
        return `${diffDays} days ago`;
      } else if (diffDays < 30) {
        const weeks = Math.floor(diffDays / 7);
        return `${weeks} ${weeks === 1 ? 'week' : 'weeks'} ago`;
      } else {
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      }
    } catch {
      return dateString;
    }
  };

  const getSourceInitials = (sourceName: string): string => {
    if (!sourceName) return 'NEW';
    // Get first 3 letters, uppercase, remove spaces and special chars
    const cleaned = sourceName.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    return cleaned.slice(0, 3) || 'NEW';
  };

  const getSourceColor = (sourceName: string): { bg: string; text: string } => {
    // Soft pastel colors
    const softColors = [
      { bg: 'bg-blue-100', text: 'text-blue-700' },
      { bg: 'bg-green-100', text: 'text-green-700' },
      { bg: 'bg-purple-100', text: 'text-purple-700' },
      { bg: 'bg-pink-100', text: 'text-pink-700' },
      { bg: 'bg-yellow-100', text: 'text-yellow-700' },
      { bg: 'bg-indigo-100', text: 'text-indigo-700' },
      { bg: 'bg-teal-100', text: 'text-teal-700' },
      { bg: 'bg-orange-100', text: 'text-orange-700' },
      { bg: 'bg-cyan-100', text: 'text-cyan-700' },
      { bg: 'bg-rose-100', text: 'text-rose-700' },
      { bg: 'bg-amber-100', text: 'text-amber-700' },
      { bg: 'bg-violet-100', text: 'text-violet-700' },
    ];

    // Simple hash function to get consistent color for same source
    let hash = 0;
    for (let i = 0; i < sourceName.length; i++) {
      hash = sourceName.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % softColors.length;
    return softColors[index];
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
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
      {/* Left Column - Primary Content (Large) */}
      <div className="lg:col-span-8 space-y-3">
        {/* Admin Generate Button */}
        {isAdmin && (
          <div className="bg-white border border-gray-200 rounded-md p-[10px]">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <p className="text-xs font-medium text-gray-900">Admin: Generate News</p>
                <p className="text-xs text-gray-600">
                  {isRecent 
                    ? 'News was generated in the last 24 hours. Please wait before generating again.'
                    : 'Generate news for "Minnesota, MN" from the last 24 hours.'}
                </p>
              </div>
              <button
                onClick={handleGenerate}
                disabled={generating || loading || isRecent}
                className="px-3 py-1.5 text-xs font-medium text-white bg-gray-900 hover:bg-gray-800 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {generating ? 'Generating...' : 'Generate'}
              </button>
            </div>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="bg-white border border-gray-200 rounded-md p-[10px]">
            <p className="text-xs text-gray-600">Loading news...</p>
          </div>
        )}

        {/* Error State */}
        {error && !loading && (
          <div className="bg-white border border-red-200 rounded-md p-[10px]">
            <p className="text-xs text-red-600">{error}</p>
            {!isAdmin && (
              <p className="text-xs text-gray-600 mt-1">
                An admin needs to generate news first.
              </p>
            )}
          </div>
        )}

        {/* Articles List */}
        {!loading && articles.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold text-gray-900">
                Minnesota News ({articles.length})
              </h2>
              <div className="flex items-center gap-2 text-xs text-gray-500">
                {query && <span>{query}</span>}
                {generatedAt && (
                  <>
                    <span>•</span>
                    <div className="flex items-center gap-1">
                      <ClockIcon className="w-3 h-3" />
                      <span>Generated {formatDate(generatedAt)}</span>
                    </div>
                  </>
                )}
              </div>
            </div>
            <div className="space-y-2">
              {articles.slice(0, displayedCount).map((article) => {
                const sourceInitials = getSourceInitials(article.source.name);
                const sourceColor = getSourceColor(article.source.name);
                
                return (
                  <div
                    key={article.id}
                    className="bg-white border border-gray-200 rounded-md p-[10px] hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex gap-2">
                      {/* Source Avatar */}
                      <div className={`flex-shrink-0 w-10 h-10 rounded-full ${sourceColor.bg} flex items-center justify-center border border-gray-200`}>
                        <span className={`text-[10px] font-semibold ${sourceColor.text} leading-none`}>
                          {sourceInitials}
                        </span>
                      </div>
                      
                      {/* Content */}
                      <div className="flex-1 min-w-0 space-y-1.5">
                        <div className="space-y-0.5">
                          <a
                            href={article.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-base font-semibold text-gray-900 hover:text-gray-700 line-clamp-2 flex items-start gap-1 group"
                          >
                            <span className="flex-1">{article.title}</span>
                            <ArrowTopRightOnSquareIcon className="w-4 h-4 text-gray-400 group-hover:text-gray-600 flex-shrink-0 mt-0.5" />
                          </a>
                          {article.snippet && (
                            <p className="text-xs text-gray-600 line-clamp-3">{article.snippet}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <span className="truncate">{article.source.name}</span>
                          <span>•</span>
                          <div className="flex items-center gap-1">
                            <ClockIcon className="w-3 h-3" />
                            <span>{formatDate(article.publishedAt)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            
            {/* Load More Button */}
            {articles.length > displayedCount && (
              <button
                onClick={() => setDisplayedCount(prev => Math.min(prev + 5, articles.length))}
                className="w-full px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-md transition-colors"
              >
                Load More ({articles.length - displayedCount} remaining)
              </button>
            )}
            
            {/* See More News Link */}
            <Link
              href="/news"
              className="inline-flex items-center gap-1 text-xs font-medium text-gray-900 hover:underline transition-colors"
            >
              <span>See More News</span>
              <ArrowTopRightOnSquareIcon className="w-3 h-3" />
            </Link>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && articles.length === 0 && (
          <div className="bg-white border border-gray-200 rounded-md p-[10px]">
            <p className="text-xs text-gray-600">
              {isAdmin 
                ? 'No news available. Click "Generate" to fetch the latest Minnesota news.'
                : 'No news available. An admin needs to generate news first.'}
            </p>
          </div>
        )}
      </div>

      {/* Right Column - Info (Smaller) */}
      <div className="lg:col-span-4 space-y-3">
        {/* Info Card */}
        <div className="bg-white border border-gray-200 rounded-md p-[10px] space-y-3">
          <h3 className="text-xs font-semibold text-gray-900">About This Page</h3>
          <div className="space-y-1.5 text-xs text-gray-600">
            <p>
              This page displays the latest Minnesota news from the last 24 hours.
            </p>
            <p>
              News is generated once per day by an admin and cached for all users to view.
            </p>
            {query && (
              <div className="pt-1.5 border-t border-gray-200">
                <p className="font-medium text-gray-900 mb-0.5">Current Query:</p>
                <p className="text-gray-600">{query}</p>
              </div>
            )}
            {generatedAt && (
              <div className="pt-1.5 border-t border-gray-200">
                <p className="font-medium text-gray-900 mb-0.5">Last Generated:</p>
                <p className="text-gray-600">{formatDate(generatedAt)}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
