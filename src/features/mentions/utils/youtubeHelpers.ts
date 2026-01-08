/**
 * YouTube URL detection and video ID extraction utilities
 */

/**
 * Extract YouTube video ID from various URL formats
 * Supports:
 * - https://www.youtube.com/watch?v=VIDEO_ID
 * - https://youtu.be/VIDEO_ID
 * - https://www.youtube.com/embed/VIDEO_ID
 * - https://m.youtube.com/watch?v=VIDEO_ID
 * - https://youtube.com/watch?v=VIDEO_ID
 */
export function extractYouTubeVideoId(url: string): string | null {
  if (!url || typeof url !== 'string') return null;

  // Remove any whitespace
  const cleanUrl = url.trim();

  // Pattern 1: youtube.com/watch?v=VIDEO_ID or youtube.com/watch?feature=share&v=VIDEO_ID
  const watchMatch = cleanUrl.match(/(?:youtube\.com\/watch\?v=|youtube\.com\/watch\?.*&v=)([a-zA-Z0-9_-]{11})/);
  if (watchMatch && watchMatch[1]) {
    return watchMatch[1];
  }

  // Pattern 2: youtu.be/VIDEO_ID
  const shortMatch = cleanUrl.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
  if (shortMatch && shortMatch[1]) {
    return shortMatch[1];
  }

  // Pattern 3: youtube.com/embed/VIDEO_ID
  const embedMatch = cleanUrl.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/);
  if (embedMatch && embedMatch[1]) {
    return embedMatch[1];
  }

  // Pattern 4: youtube.com/v/VIDEO_ID
  const vMatch = cleanUrl.match(/youtube\.com\/v\/([a-zA-Z0-9_-]{11})/);
  if (vMatch && vMatch[1]) {
    return vMatch[1];
  }

  return null;
}

/**
 * Check if a string contains a YouTube URL
 */
export function containsYouTubeUrl(text: string): boolean {
  if (!text || typeof text !== 'string') return false;
  
  const youtubePatterns = [
    /youtube\.com\/watch\?v=/,
    /youtu\.be\//,
    /youtube\.com\/embed\//,
    /youtube\.com\/v\//,
  ];

  return youtubePatterns.some(pattern => pattern.test(text));
}

/**
 * Find all YouTube URLs in text and extract video IDs
 */
export function findYouTubeUrls(text: string): Array<{ url: string; videoId: string; startIndex: number; endIndex: number }> {
  if (!text || typeof text !== 'string') return [];

  const results: Array<{ url: string; videoId: string; startIndex: number; endIndex: number }> = [];
  
  // Match various YouTube URL patterns
  const urlPattern = /(?:https?:\/\/)?(?:www\.)?(?:m\.)?(?:youtube\.com\/(?:watch\?v=|embed\/|v\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/g;
  
  let match;
  while ((match = urlPattern.exec(text)) !== null) {
    const videoId = match[1];
    const fullUrl = match[0].startsWith('http') ? match[0] : `https://${match[0]}`;
    
    results.push({
      url: fullUrl,
      videoId,
      startIndex: match.index,
      endIndex: match.index + match[0].length,
    });
  }

  return results;
}

/**
 * Get YouTube embed URL from video ID
 */
export function getYouTubeEmbedUrl(videoId: string): string {
  return `https://www.youtube.com/embed/${videoId}`;
}

/**
 * Get YouTube thumbnail URL from video ID
 */
export function getYouTubeThumbnailUrl(videoId: string, quality: 'default' | 'medium' | 'high' | 'maxres' = 'medium'): string {
  const qualityMap = {
    default: 'default',
    medium: 'mqdefault',
    high: 'hqdefault',
    maxres: 'maxresdefault',
  };
  
  return `https://img.youtube.com/vi/${videoId}/${qualityMap[quality]}.jpg`;
}

/**
 * Get YouTube watch URL from video ID
 */
export function getYouTubeWatchUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

