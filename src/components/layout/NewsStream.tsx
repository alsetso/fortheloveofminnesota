'use client';

import { useState, useEffect } from 'react';
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

interface NewsStreamProps {
  useBlurStyle?: boolean;
  maxItems?: number;
}

export default function NewsStream({ useBlurStyle = false, maxItems = 5 }: NewsStreamProps) {
  const [allArticles, setAllArticles] = useState<NewsArticle[]>([]);
  const [visibleArticles, setVisibleArticles] = useState<NewsArticle[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isHovered, setIsHovered] = useState(false);
  const [currentBlurStyle, setCurrentBlurStyle] = useState(useBlurStyle);
  const [currentMapStyle, setCurrentMapStyle] = useState<'streets' | 'satellite'>(() => {
    return typeof window !== 'undefined' ? ((window as any).__currentMapStyle || 'streets') : 'streets';
  });
  
  // Use white text when transparent blur + satellite map (same logic as MapTopContainer)
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
        setCurrentIndex(0);
        setVisibleArticles([]);
      } else {
        setAllArticles([]);
        setVisibleArticles([]);
      }
    } catch (err) {
      console.error('Failed to load news:', err);
      setAllArticles([]);
      setVisibleArticles([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNews();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Stream in articles one at a time every 3 seconds
  useEffect(() => {
    if (allArticles.length === 0) {
      return;
    }

    const intervalId = setInterval(() => {
      // Pause streaming when hovering
      if (isHovered) {
        return;
      }

      setCurrentIndex((prevIndex) => {
        if (prevIndex >= allArticles.length) {
          return prevIndex;
        }

        const nextArticle = allArticles[prevIndex];
        
        setVisibleArticles((prev) => {
          // Check if this article is already visible (prevent duplicates)
          const isAlreadyVisible = prev.some(article => article.id === nextArticle.id);
          if (isAlreadyVisible) {
            return prev;
          }

          // If we already have 5 articles, remove the first one (oldest) before adding new one
          if (prev.length >= maxItems) {
            return [...prev.slice(1), nextArticle];
          }
          // Otherwise just add to the end
          return [...prev, nextArticle];
        });

        return prevIndex + 1;
      });
    }, 3000); // Add one article every 3 seconds

    return () => clearInterval(intervalId);
  }, [allArticles, maxItems, isHovered]);

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

  if (loading && visibleArticles.length === 0) {
    return (
      <div className={`w-full max-w-xs rounded-md shadow-lg p-2 ${
        currentBlurStyle 
          ? 'bg-transparent backdrop-blur-md border-2 border-transparent' 
          : 'bg-white border border-gray-200'
      }`}>
        <p className={`text-[10px] ${useWhiteText ? 'text-white/80' : 'text-gray-600'}`}>Loading news...</p>
      </div>
    );
  }

  if (allArticles.length === 0 && !loading) {
    return null;
  }

  return (
    <div 
      className={`w-full max-w-xs rounded-md shadow-lg overflow-hidden ${
        currentBlurStyle 
          ? 'bg-transparent backdrop-blur-md border-2 border-transparent' 
          : 'bg-white border border-gray-200'
      }`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="overflow-hidden">
        <div className="space-y-0.5 p-2">
          {visibleArticles.map((article, index) => {
            // Safely handle missing source
            const sourceName = article.source?.name || 'Unknown';
            const sourceColor = getSourceColor(sourceName);
            const sourceInitials = getSourceInitials(sourceName);

            return (
              <a
                key={`${article.id}-${index}`}
                href={article.link}
                target="_blank"
                rel="noopener noreferrer"
                className={`flex items-center gap-2 px-2 py-1.5 rounded transition-all duration-500 group ${
                  currentBlurStyle
                    ? 'hover:bg-white/10'
                    : 'hover:bg-gray-50'
                }`}
              >
                {/* Source Circle Icon */}
                <div
                  className={`w-4 h-4 rounded-full ${sourceColor.bg} ${sourceColor.text} flex items-center justify-center flex-shrink-0 text-[8px] font-medium`}
                >
                  {sourceInitials}
                </div>

                {/* Title and Timestamp */}
                <div className="flex-1 min-w-0">
                  <div className={`text-[10px] font-medium truncate ${useWhiteText ? 'text-white/90 group-hover:text-white' : 'text-gray-900'}`}>
                    {article.title}
                  </div>
                  <div className={`flex items-center gap-1 text-[8px] mt-0.5 ${useWhiteText ? 'text-white/60' : 'text-gray-500'}`}>
                    <ClockIcon className={`w-2.5 h-2.5 ${useWhiteText ? 'text-white/60' : 'text-gray-500'}`} />
                    <span>{formatDate(article.publishedAt)}</span>
                  </div>
                </div>
              </a>
            );
          })}
        </div>
      </div>
    </div>
  );
}

