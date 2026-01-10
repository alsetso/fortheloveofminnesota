'use client';

import { useState, useEffect, useRef } from 'react';
import { ClockIcon } from '@heroicons/react/24/outline';
import { getSourceInitials, getSourceColor, formatDate } from '@/features/news/utils/newsHelpers';
import { useAuthStateSafe } from '@/features/auth';
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

interface NewsStreamProps {
  useBlurStyle?: boolean;
  maxItems?: number;
}

export default function NewsStream({ useBlurStyle = false, maxItems = 5 }: NewsStreamProps) {
  const { account } = useAuthStateSafe();
  const isAdmin = account?.role === 'admin';
  
  const [allArticles, setAllArticles] = useState<NewsArticle[]>([]);
  const [visibleArticles, setVisibleArticles] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [currentBlurStyle, setCurrentBlurStyle] = useState(useBlurStyle);
  const [currentMapStyle, setCurrentMapStyle] = useState<'streets' | 'satellite'>(() => {
    return typeof window !== 'undefined' ? ((window as any).__currentMapStyle || 'streets') : 'streets';
  });
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const articleQueueRef = useRef<NewsArticle[]>([]);
  const feedIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isUserScrollingRef = useRef(false);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Use white text when transparent blur + satellite map
  const useWhiteText = currentBlurStyle && currentMapStyle === 'satellite';

  // Listen for blur style and map style changes
  useEffect(() => {
    const handleBlurStyleChange = (e: CustomEvent) => {
      setCurrentBlurStyle(e.detail.useBlurStyle);
    };
    
    const handleMapStyleChange = (e: CustomEvent) => {
      setCurrentMapStyle(e.detail.mapStyle);
    };
    
    window.addEventListener('blur-style-change', handleBlurStyleChange as EventListener);
    window.addEventListener('map-style-change', handleMapStyleChange as EventListener);
    
    return () => {
      window.removeEventListener('blur-style-change', handleBlurStyleChange as EventListener);
      window.removeEventListener('map-style-change', handleMapStyleChange as EventListener);
    };
  }, []);

  const fetchNews = async () => {
    setLoading(true);

    try {
      const response = await fetch(`/api/news/all?offset=0&limit=50`);
      const data: NewsResponse = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch news');
      }

      if (data.success && data.data) {
        setAllArticles(data.data.articles);
        // Initialize queue with all articles
        articleQueueRef.current = [...data.data.articles];
      } else {
        setAllArticles([]);
        articleQueueRef.current = [];
      }
    } catch (err) {
      console.error('Failed to load news:', err);
      setAllArticles([]);
      articleQueueRef.current = [];
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNews();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Listen for generate news event to refresh
  useEffect(() => {
    const handleGenerateNews = async () => {
      await fetchNews();
    };

    window.addEventListener('generate-news', handleGenerateNews);
    return () => {
      window.removeEventListener('generate-news', handleGenerateNews);
    };
  }, []);

  const handleGenerateNews = async () => {
    setGenerating(true);
    try {
      const response = await fetch('/api/news/generate', {
        method: 'POST',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate news');
      }

      // Refresh the news list after generation
      await fetchNews();
    } catch (err) {
      console.error('Failed to generate news:', err);
    } finally {
      setGenerating(false);
    }
  };

  // Feed articles one at a time into the visible list
  useEffect(() => {
    if (allArticles.length === 0 || loading) {
      // Clear any existing interval
      if (feedIntervalRef.current) {
        clearInterval(feedIntervalRef.current);
        feedIntervalRef.current = null;
      }
      return;
    }

    // Start with first article if visible list is empty
    if (visibleArticles.length === 0 && articleQueueRef.current.length > 0) {
      const firstArticle = articleQueueRef.current.shift();
      if (firstArticle) {
        setVisibleArticles([firstArticle]);
      }
    }

    // Feed articles one at a time every 1-2 seconds
    const feedNextArticle = () => {
      if (articleQueueRef.current.length === 0) {
        // Reset queue when empty
        articleQueueRef.current = [...allArticles];
      }

      if (articleQueueRef.current.length > 0) {
        const nextArticle = articleQueueRef.current.shift();
        if (nextArticle) {
          setVisibleArticles(prev => {
            const updated = [...prev, nextArticle];
            // Keep only the last maxItems articles
            if (updated.length > maxItems) {
              return updated.slice(-maxItems);
            }
            return updated;
          });

          // Auto-scroll to bottom if user isn't manually scrolling
          if (!isUserScrollingRef.current && scrollContainerRef.current) {
            requestAnimationFrame(() => {
              if (scrollContainerRef.current) {
                scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
              }
            });
          }
        }
      }
    };

    // Random interval between 1-2 seconds
    const getRandomInterval = () => Math.random() * 1000 + 1000; // 1000-2000ms

    const scheduleNext = () => {
      if (feedIntervalRef.current) {
        clearTimeout(feedIntervalRef.current);
      }
      feedIntervalRef.current = setTimeout(() => {
        feedNextArticle();
        scheduleNext();
      }, getRandomInterval());
    };

    scheduleNext();

    return () => {
      if (feedIntervalRef.current) {
        clearTimeout(feedIntervalRef.current);
        feedIntervalRef.current = null;
      }
    };
  }, [allArticles, loading, maxItems, visibleArticles.length]);

  // Track user scrolling
  useEffect(() => {
    if (!scrollContainerRef.current) return;

    const container = scrollContainerRef.current;
    
    const handleScroll = () => {
      isUserScrollingRef.current = true;
      
      // Clear existing timeout
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
      
      // Reset user scrolling flag after 2 seconds of no scrolling
      scrollTimeoutRef.current = setTimeout(() => {
        isUserScrollingRef.current = false;
      }, 2000);
    };

    container.addEventListener('scroll', handleScroll);

    return () => {
      container.removeEventListener('scroll', handleScroll);
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  if (allArticles.length === 0 && !loading) {
    return null;
  }

  return (
    <div 
      className="absolute top-14 right-0 z-10 max-w-xs pointer-events-auto"
      style={{
        maxHeight: 'calc(100vh - 200px)',
      }}
    >
      <div 
        ref={scrollContainerRef}
        data-news-scroll
        className="space-y-2 overflow-y-auto"
        style={{
          scrollbarWidth: 'none', // Firefox
          msOverflowStyle: 'none', // IE/Edge
          maxHeight: '400px',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {loading && visibleArticles.length === 0 ? (
          <div className="p-2">
            <p className={`text-[10px] ${useWhiteText ? 'text-white/80' : 'text-gray-600'}`}>Loading news...</p>
          </div>
        ) : (
          <>
            {visibleArticles.map((article, index) => {
              // Safely handle missing source
              const sourceName = article.source?.name || 'Unknown';
              const sourceColor = getSourceColor(sourceName);
              const sourceInitials = getSourceInitials(sourceName);

              // Last visible article is always 50% transparent
              const isLast = index === visibleArticles.length - 1;
              const opacity = isLast ? 0.5 : 1;

              return (
                <a
                  key={`${article.id}-${index}-${Date.now()}`}
                  data-news-item
                  href={article.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`flex items-start gap-2 px-2 py-1.5 rounded transition-all duration-200 group ${
                    useWhiteText
                      ? 'hover:bg-white/10'
                      : 'hover:bg-white/80'
                  }`}
                  style={{ opacity }}
                >
                  {/* Source Circle Icon */}
                  <div
                    className={`w-4 h-4 rounded-full ${sourceColor.bg} ${sourceColor.text} flex items-center justify-center flex-shrink-0 text-[8px] font-medium`}
                  >
                    {sourceInitials}
                  </div>

                  {/* Title and Timestamp */}
                  <div className="flex-1 min-w-0 overflow-hidden">
                    <div className={`text-[10px] font-medium ${useWhiteText ? 'text-white/90 group-hover:text-white' : 'text-gray-900'}`}>
                      {article.title.length > 40 ? `${article.title.substring(0, 40)}...` : article.title}
                    </div>
                    <div className={`flex items-center gap-1 text-[8px] mt-0.5 truncate ${useWhiteText ? 'text-white/60' : 'text-gray-500'}`}>
                      <ClockIcon className={`w-2.5 h-2.5 flex-shrink-0 ${useWhiteText ? 'text-white/60' : 'text-gray-500'}`} />
                      <span className="truncate">{formatDate(article.publishedAt)}</span>
                    </div>
                  </div>
                </a>
              );
            })}
            {isAdmin && visibleArticles.length > 0 && (
              <div className={`pt-1 border-t ${
                useWhiteText ? 'border-white/20' : 'border-gray-200/50'
              }`}>
                <button
                  onClick={handleGenerateNews}
                  disabled={generating}
                  className={`text-[9px] ${useWhiteText ? 'text-white/80 hover:text-white' : 'text-gray-600 hover:text-gray-900'} transition-colors disabled:opacity-50`}
                >
                  {generating ? 'Generating...' : 'Generate more news'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
