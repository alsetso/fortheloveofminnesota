'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ClockIcon } from '@heroicons/react/24/outline';
import { useAuthStateSafe } from '@/features/auth';
import { useAppModalContextSafe } from '@/contexts/AppModalContext';
import { getSourceInitials, getSourceColor, formatDate } from '@/features/news/utils/newsHelpers';

interface NewsArticle {
  id: string;
  title: string;
  link: string;
  publishedAt: string;
  source: {
    name: string;
  };
}

interface LatestNewsResponse {
  success: boolean;
  data?: {
    articles: NewsArticle[];
    count?: number; // Legacy support
    pagination?: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
    generatedAt: string;
    createdAt: string;
  };
  error?: string;
}

export default function NewsSecondaryContent() {
  const { user } = useAuthStateSafe();
  const { openWelcome } = useAppModalContextSafe();
  
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isToday, setIsToday] = useState(false);


  // Check if date is today
  const isDateToday = (dateString: string): boolean => {
    const date = new Date(dateString);
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

  // Fetch latest news
  useEffect(() => {
    const fetchLatestNews = async () => {
    setLoading(true);
    setError(null);

    try {
        const response = await fetch('/api/news/latest');
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch news');
      }

        const data: LatestNewsResponse = await response.json();
        
        if (data.success && data.data) {
          setArticles(data.data.articles || []);
          // Check if news was generated today
          const generatedToday = isDateToday(data.data.generatedAt || data.data.createdAt);
          setIsToday(generatedToday);
        } else {
          setArticles([]);
          setIsToday(false);
        }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load news');
      setArticles([]);
        setIsToday(false);
    } finally {
      setLoading(false);
    }
  };

    fetchLatestNews();
  }, []);


  // Require authentication
  if (!user) {
  return (
    <div className="space-y-3">
        <div className="px-2 py-1.5">
      <div className="space-y-2">
            <p className="text-xs font-medium text-gray-900">Sign In Required</p>
            <p className="text-xs text-gray-600">You must be signed in to view news content.</p>
            <button
              onClick={() => openWelcome()}
              className="w-full px-3 py-2 text-xs font-medium text-white bg-gray-900 hover:bg-gray-800 rounded transition-colors"
            >
              Sign In
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div>
        <div className="text-xs text-gray-600 font-medium mb-2">Today's News</div>

      {/* Loading State */}
      {loading && (
          <div className="px-2 py-1.5">
          <p className="text-xs text-gray-600">Loading news...</p>
        </div>
      )}

        {/* Error State or No News Today */}
        {!loading && (!isToday || articles.length === 0) && (
          <div className="px-2 py-1.5">
            <p className="text-xs text-gray-600">Our admin is still asleep.</p>
        </div>
      )}

      {/* Articles */}
        {!loading && isToday && articles.length > 0 && (
          <div className="space-y-0.5">
            {articles.map((article) => {
              const sourceColor = getSourceColor(article.source?.name);
              const sourceInitials = getSourceInitials(article.source?.name);
              
              return (
                <Link
                  key={article.id}
                  href={`/news/${article.id}`}
                  className="flex items-start gap-2 px-2 py-1.5 rounded text-xs text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors"
                >
                  {/* Source Circle */}
                  <div className={`w-5 h-5 rounded-full ${sourceColor.bg} ${sourceColor.text} flex items-center justify-center flex-shrink-0 text-[10px] font-medium mt-0.5`}>
                    {sourceInitials}
                      </div>
                  
                  {/* Title and Date */}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium break-words">{article.title}</div>
                    <div className="flex items-center gap-1.5 text-[10px] text-gray-500 mt-0.5">
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
        </div>

    </div>
  );
}
