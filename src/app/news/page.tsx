'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import NewPageWrapper from '@/components/layout/NewPageWrapper';
import LeftSidebar from '@/components/layout/LeftSidebar';
import RightSidebar from '@/components/layout/RightSidebar';
import { useAppModalContextSafe } from '@/contexts/AppModalContext';
import { useAuthStateSafe } from '@/features/auth';
import { PlusIcon } from '@heroicons/react/24/outline';
import Image from 'next/image';

interface NewsArticle {
  id: string;
  title: string;
  link: string;
  snippet: string | null;
  photo_url: string | null;
  thumbnail_url: string | null;
  published_at: string;
  published_date: string;
  authors: string[];
  source_name: string | null;
  source_logo_url: string | null;
  source_favicon_url: string | null;
  related_topics: string[];
}

export default function NewsPage() {
  const { openWelcome } = useAppModalContextSafe();
  const { account } = useAuthStateSafe();
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isAdmin = account?.role === 'admin';

  useEffect(() => {
    async function fetchNews() {
      try {
        setLoading(true);
        const response = await fetch('/api/news?limit=50', {
          cache: 'no-store',
        });
        if (!response.ok) {
          throw new Error('Failed to fetch news');
        }
        const data = await response.json();
        setArticles(data.articles || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load news');
      } finally {
        setLoading(false);
      }
    }

    fetchNews();
    
    // Refresh news when page becomes visible (user returns from generate page)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchNews();
      }
    };
    
    // Also refresh on focus (when navigating back to tab)
    const handleFocus = () => {
      fetchNews();
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <NewPageWrapper
      leftSidebar={<LeftSidebar />}
      rightSidebar={<RightSidebar />}
    >
      <div className="w-full py-6">
        <div className="max-w-4xl mx-auto px-4 space-y-3">
          <div className="mb-4 flex items-start justify-between">
            <div>
              <h1 className="text-sm font-semibold text-foreground">Minnesota News</h1>
              <p className="text-xs text-foreground-muted mt-0.5">
                Latest news articles about Minnesota
              </p>
            </div>
            {/* Admin-only: Generate news button */}
            {isAdmin && (
              <Link
                href="/news/generate"
                className="flex items-center justify-center w-8 h-8 bg-surface rounded-md border border-border-muted dark:border-white/10 hover:bg-surface-accent dark:hover:bg-white/10 transition-colors"
                aria-label="Generate news (Admin only)"
                title="Generate news (Admin only)"
              >
                <PlusIcon className="w-4 h-4 text-foreground" />
              </Link>
            )}
          </div>

          {loading && (
            <div className="text-center py-8">
              <p className="text-xs text-foreground-muted">Loading news...</p>
            </div>
          )}

          {error && (
            <div className="text-center py-8">
              <p className="text-xs text-red-500">{error}</p>
            </div>
          )}

          {!loading && !error && articles.length === 0 && (
            <div className="text-center py-8">
              <p className="text-xs text-foreground-muted">No news articles available</p>
            </div>
          )}

          {!loading && !error && articles.length > 0 && (
            <div className="space-y-3">
              {articles.map((article) => {
                const imageUrl = article.photo_url || article.thumbnail_url;
                return (
                  <a
                    key={article.id}
                    href={article.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block border border-border-muted dark:border-white/10 rounded-md bg-surface hover:bg-surface-accent dark:hover:bg-white/10 transition-colors p-[10px]"
                  >
                    <div className="flex gap-3">
                      {imageUrl && (
                        <div className="flex-shrink-0 w-20 h-20 rounded overflow-hidden bg-surface-accent dark:bg-white/10">
                          <Image
                            src={imageUrl}
                            alt={article.title}
                            width={80}
                            height={80}
                            className="w-full h-full object-cover"
                            unoptimized
                            onError={(e) => {
                              // Hide image on error
                              const target = e.target as HTMLImageElement;
                              target.style.display = 'none';
                            }}
                          />
                        </div>
                      )}
                      <div className="flex-1 min-w-0 space-y-1.5">
                        <div className="flex items-start justify-between gap-2">
                          <h2 className="text-sm font-semibold text-foreground line-clamp-2">
                            {article.title}
                          </h2>
                        </div>
                        {article.snippet && (
                          <p className="text-xs text-foreground-muted line-clamp-2">
                            {article.snippet}
                          </p>
                        )}
                        <div className="flex items-center gap-2 flex-wrap">
                          {article.source_name && (
                            <span className="text-xs text-foreground-muted">
                              {article.source_name}
                            </span>
                          )}
                          <span className="text-xs text-foreground-muted">•</span>
                          <span className="text-xs text-foreground-muted">
                            {formatDate(article.published_at)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </a>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </NewPageWrapper>
  );
}
