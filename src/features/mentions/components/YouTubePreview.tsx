'use client';

import { useState } from 'react';
import { PlayIcon } from '@heroicons/react/24/solid';
import { extractYouTubeVideoId, getYouTubeThumbnailUrl, getYouTubeWatchUrl, getYouTubeEmbedUrl } from '../utils/youtubeHelpers';

interface YouTubePreviewProps {
  url: string;
  className?: string;
  compact?: boolean;
  useTransparentUI?: boolean;
}

/**
 * YouTube video preview component
 * Shows thumbnail with play button, can expand to show embed
 */
export default function YouTubePreview({ url, className = '', compact = false, useTransparentUI = false }: YouTubePreviewProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const videoId = extractYouTubeVideoId(url);

  if (!videoId) return null;

  const thumbnailUrl = getYouTubeThumbnailUrl(videoId, 'medium');
  const watchUrl = getYouTubeWatchUrl(videoId);
  const embedUrl = getYouTubeEmbedUrl(videoId);

  if (isExpanded) {
    return (
      <div className={`${className} max-w-[250px] ${useTransparentUI ? 'bg-white/10 border-white/20' : 'bg-gray-50 border-gray-200'} border rounded-md overflow-hidden`}>
        <div className="relative w-full" style={{ paddingBottom: '56.25%' }}> {/* 16:9 aspect ratio */}
          <iframe
            src={embedUrl}
            className="absolute top-0 left-0 w-full h-full"
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            title="YouTube video"
          />
        </div>
        <button
          onClick={() => setIsExpanded(false)}
          className={`w-full px-2 py-1.5 text-[10px] font-medium transition-colors ${
            useTransparentUI
              ? 'text-white/80 hover:text-white hover:bg-white/10'
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
          }`}
        >
          Collapse
        </button>
      </div>
    );
  }

  return (
    <div className={`${className} max-w-[250px] ${useTransparentUI ? 'bg-white/10 border-white/20' : 'bg-gray-50 border-gray-200'} border rounded-md overflow-hidden`}>
      <a
        href={watchUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="block relative group"
        onClick={(e) => {
          // Allow expanding on click instead of navigating
          e.preventDefault();
          setIsExpanded(true);
        }}
      >
        <div className="relative w-full" style={{ paddingBottom: '56.25%' }}> {/* 16:9 aspect ratio */}
          <img
            src={thumbnailUrl}
            alt="YouTube video thumbnail"
            className="absolute top-0 left-0 w-full h-full object-cover"
          />
          <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/40 transition-colors">
            <div className={`w-10 h-10 ${useTransparentUI ? 'bg-white/90' : 'bg-white'} rounded-full flex items-center justify-center shadow-lg`}>
              <PlayIcon className={`w-5 h-5 ${useTransparentUI ? 'text-gray-900' : 'text-gray-900'} ml-0.5`} />
            </div>
          </div>
        </div>
      </a>
      {!compact && (
        <div className={`px-2 py-1.5 ${useTransparentUI ? 'border-t border-white/20' : 'border-t border-gray-200'}`}>
          <a
            href={watchUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={`text-[10px] font-medium transition-colors ${
              useTransparentUI
                ? 'text-white/80 hover:text-white'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Watch on YouTube
          </a>
        </div>
      )}
    </div>
  );
}

