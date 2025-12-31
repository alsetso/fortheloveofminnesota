/**
 * Shared utility functions for news components
 * Consolidates duplicate helper functions across the codebase
 */

/**
 * Get source initials from source name (first 3 letters, uppercase)
 */
export function getSourceInitials(sourceName: string | undefined | null): string {
  if (!sourceName) return 'NEW';
  const cleaned = sourceName.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  return cleaned.slice(0, 3) || 'NEW';
}

/**
 * Get consistent color for source name using hash function
 */
export function getSourceColor(sourceName: string | undefined | null): { bg: string; text: string } {
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

  if (!sourceName) {
    return softColors[0];
  }

  // Simple hash function to get consistent color for same source
  let hash = 0;
  for (let i = 0; i < sourceName.length; i++) {
    hash = sourceName.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % softColors.length;
  return softColors[index];
}

/**
 * Format date with relative time (Today, Yesterday, X days ago, etc.)
 */
export function formatDate(dateString: string): string {
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
}

import { format } from 'date-fns';

/**
 * Format full date and time with CST timezone
 */
export function formatFullDateTime(dateString: string): string {
  try {
    const date = new Date(dateString);
    return format(date, 'MMMM d, yyyy h:mma') + ' CST';
  } catch {
    return dateString;
  }
}

