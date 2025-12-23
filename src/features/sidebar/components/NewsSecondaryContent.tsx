'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { ArrowTopRightOnSquareIcon, ClockIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { hasRemainingCredits, getRemainingCredits, useCredit } from '@/lib/newsRateLimit';
import { useAuthStateSafe } from '@/features/auth';
import { useAppModalContextSafe } from '@/contexts/AppModalContext';

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

interface NewsResponse {
  requestId: string;
  articles: NewsArticle[];
  count: number;
}

interface QueryOption {
  label: string;
  query: string;
}

const MINNESOTA_QUERIES: QueryOption[] = [
  { label: 'Breaking News', query: 'Breaking news in Minnesota today' },
  { label: 'Today\'s Events', query: 'What happened in Minnesota today' },
  { label: 'Local Updates', query: 'Minnesota local news updates' },
  { label: 'Twin Cities', query: 'Twin Cities breaking news now' },
  { label: 'Incidents', query: 'Minnesota incidents reported today' },
  { label: 'Community Alerts', query: 'Minnesota community alerts and notices' },
  { label: 'Public Safety', query: 'Minnesota public safety news today' },
  { label: 'Government', query: 'Minnesota government and politics news today' },
  { label: 'Major Events', query: 'Major events happening in Minnesota today' },
  { label: 'Latest Headlines', query: 'Latest Minnesota headlines right now' },
];

export default function NewsSecondaryContent() {
  const { account } = useAuthStateSafe();
  const { openUpgrade } = useAppModalContextSafe();
  const isPro = account?.plan === 'pro' || account?.plan === 'plus';
  
  const [selectedQuery, setSelectedQuery] = useState<string | null>(null);
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [remainingCredits, setRemainingCredits] = useState<number>(1);
  const [customSearchQuery, setCustomSearchQuery] = useState<string>('');

  // Update remaining credits on mount and when credits change
  useEffect(() => {
    setRemainingCredits(getRemainingCredits());
  }, []);

  const performSearch = async (query: string) => {
    if (!query.trim()) {
      setError('Please enter a search query');
      return;
    }

    if (selectedQuery === query && articles.length > 0) {
      // If clicking the same query, clear results
      setSelectedQuery(null);
      setArticles([]);
      return;
    }

    // Check rate limit before making request
    if (!hasRemainingCredits()) {
      setError('Daily search limit reached. You have used your 1 free search credit for today.');
      return;
    }

    // Use a credit
    const creditUsed = useCredit();
    if (!creditUsed) {
      setError('Daily search limit reached. You have used your 1 free search credit for today.');
      return;
    }

    // Update remaining credits display
    setRemainingCredits(getRemainingCredits());

    setSelectedQuery(query);
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/news?query=${encodeURIComponent(query)}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch news');
      }

      const data: NewsResponse = await response.json();
      setArticles(data.articles || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load news');
      setArticles([]);
    } finally {
      setLoading(false);
    }
  };

  const handleQueryClick = async (query: string) => {
    await performSearch(query);
  };

  const handleCustomSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    await performSearch(customSearchQuery.trim());
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

  const hasCredits = remainingCredits > 0;

  return (
    <div className="space-y-3">
      {/* Search Queries */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold text-gray-900">Minnesota News</h3>
          <span className="text-xs text-gray-500">
            {remainingCredits} search credit{remainingCredits !== 1 ? 's' : ''}
          </span>
        </div>
        
        {/* Custom Search Input */}
        <form onSubmit={handleCustomSearch} className="space-y-1.5">
          <div className="relative">
            <input
              type="text"
              value={customSearchQuery}
              onChange={(e) => setCustomSearchQuery(e.target.value)}
              placeholder="Search news..."
              disabled={loading || !hasCredits}
              className={`
                w-full px-2 py-1.5 pr-8 rounded-md text-xs border border-gray-200
                focus:outline-none focus:ring-1 focus:ring-gray-300 focus:border-gray-300
                disabled:opacity-50 disabled:cursor-not-allowed
                ${hasCredits ? 'bg-white text-gray-900' : 'bg-gray-50 text-gray-500'}
              `}
            />
            <button
              type="submit"
              disabled={loading || !hasCredits || !customSearchQuery.trim()}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 text-gray-500 hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <MagnifyingGlassIcon className="w-3 h-3" />
            </button>
          </div>
        </form>

        <div className="flex flex-wrap gap-1.5">
          {MINNESOTA_QUERIES.map((option) => {
            const isActive = selectedQuery === option.query;
            const isLoading = loading && selectedQuery === option.query;
            
            return (
              <button
                key={option.query}
                onClick={() => handleQueryClick(option.query)}
                disabled={loading || !hasCredits}
                className={`
                  px-2 py-1 rounded-md text-xs transition-colors
                  ${
                    isActive
                      ? 'bg-gray-200 text-gray-900 font-medium'
                      : 'bg-gray-50 text-gray-600 hover:bg-gray-100 hover:text-gray-900 border border-gray-200'
                  }
                  ${(loading && !isLoading) || !hasCredits ? 'opacity-50 cursor-not-allowed' : ''}
                `}
              >
                {isLoading ? 'Loading...' : option.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="bg-white border border-gray-200 rounded-md p-[10px]">
          <p className="text-xs text-gray-600">Loading news...</p>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="bg-white border border-red-200 rounded-md p-[10px]">
          <p className="text-xs text-red-600">{error}</p>
        </div>
      )}

      {/* Upgrade CTA when credits are used */}
      {!isPro && remainingCredits === 0 && (
        <div className="bg-white border border-gray-200 rounded-md p-[10px]">
          <div className="space-y-2">
            <div>
              <p className="text-xs font-medium text-gray-900">Daily search limit reached</p>
              <p className="text-xs text-gray-600 mt-0.5">You've used your 1 free search credit for today.</p>
            </div>
            <button
              onClick={() => openUpgrade('news-search')}
              className="w-full px-3 py-2 text-xs font-medium text-white bg-gray-900 hover:bg-gray-800 rounded transition-colors"
            >
              Upgrade to Pro for Unlimited Searches
            </button>
          </div>
        </div>
      )}

      {/* Articles */}
      {!loading && articles.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-gray-900">
              Results ({articles.length})
            </h3>
            <span className="text-xs text-gray-500">{selectedQuery}</span>
          </div>
          <div className="space-y-2">
            {articles.map((article) => {
              const imageUrl = article.thumbnailUrl || article.photoUrl;
              
              return (
                <div
                  key={article.id}
                  className="bg-white border border-gray-200 rounded-md p-[10px]"
                >
                  <div className="flex gap-2">
                    {/* Image */}
                    {imageUrl && (
                      <div className="flex-shrink-0 w-16 h-16 relative rounded overflow-hidden bg-gray-100">
                        <Image
                          src={imageUrl}
                          alt={article.title}
                          fill
                          className="object-cover"
                          sizes="64px"
                          unoptimized
                          onError={(e) => {
                            // Hide image on error
                            const target = e.target as HTMLImageElement;
                            target.style.display = 'none';
                          }}
                        />
                      </div>
                    )}
                    
                    {/* Content */}
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <div className="space-y-0.5">
                        <a
                          href={article.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs font-medium text-gray-900 hover:text-gray-700 line-clamp-2 flex items-start gap-1 group"
                        >
                          <span className="flex-1">{article.title}</span>
                          <ArrowTopRightOnSquareIcon className="w-3 h-3 text-gray-400 group-hover:text-gray-600 flex-shrink-0 mt-0.5" />
                        </a>
                        {article.snippet && (
                          <p className="text-xs text-gray-600 line-clamp-2">{article.snippet}</p>
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
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && selectedQuery && articles.length === 0 && (
        <div className="bg-white border border-gray-200 rounded-md p-[10px]">
          <p className="text-xs text-gray-600">No articles found for this query.</p>
        </div>
      )}
    </div>
  );
}

