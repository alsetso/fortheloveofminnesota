'use client';

import { useState, useEffect } from 'react';
import { ClockIcon, ChevronDownIcon, ChevronUpIcon, NewspaperIcon } from '@heroicons/react/24/outline';
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
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
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
      } else {
        setAllArticles([]);
      }
    } catch (err) {
      console.error('Failed to load news:', err);
      setAllArticles([]);
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
    >
      {/* Accordion Header Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between px-2 py-1.5 transition-colors ${
          currentBlurStyle
            ? 'hover:bg-white/10'
            : 'hover:bg-gray-50'
        }`}
      >
        <div className="flex items-center gap-1.5">
          <NewspaperIcon className={`w-5 h-5 ${useWhiteText ? 'text-white/80' : 'text-gray-600'}`} />
          {allArticles.length > 0 && (
            <span className={`text-[8px] px-1 py-0.5 rounded ${useWhiteText ? 'bg-white/20 text-white/80' : 'bg-gray-100 text-gray-600'}`}>
              {allArticles.length}
            </span>
          )}
        </div>
        {isOpen ? (
          <ChevronUpIcon className={`w-3.5 h-3.5 ${useWhiteText ? 'text-white/80' : 'text-gray-600'}`} />
        ) : (
          <ChevronDownIcon className={`w-3.5 h-3.5 ${useWhiteText ? 'text-white/80' : 'text-gray-600'}`} />
        )}
      </button>

      {/* Accordion Content */}
      {isOpen && (
        <div className={`overflow-hidden border-t ${
          currentBlurStyle 
            ? (useWhiteText ? 'border-white/20' : 'border-gray-300/50')
            : 'border-gray-200'
        }`}>
          {loading && allArticles.length === 0 ? (
            <div className="p-2">
              <p className={`text-[10px] ${useWhiteText ? 'text-white/80' : 'text-gray-600'}`}>Loading news...</p>
            </div>
          ) : (
            <div className="space-y-0.5 p-2 max-h-[300px] overflow-y-auto">
              {allArticles.map((article, index) => {
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
              {isAdmin && (
                <div className={`pt-1 border-t ${
                  currentBlurStyle 
                    ? (useWhiteText ? 'border-white/20' : 'border-gray-300/50')
                    : 'border-gray-200'
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
            </div>
          )}
        </div>
      )}
    </div>
  );
}

